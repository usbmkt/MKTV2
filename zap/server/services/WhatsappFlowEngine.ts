// zap/server/services/WhatsappFlowEngine.ts
import { zapDb } from '../db';
import { 
    whatsappFlows, 
    whatsappFlowUserStates, 
    NewWhatsappFlowUserState, 
    ZapMessage, 
    selectZapUserSchema,
    WhatsappFlow // Adicionado para tipo explícito
} from '../../shared/zap_schema';
import { eq, and } from 'drizzle-orm';
import { getOrCreateWhatsappConnection, sendMessage as sendBaileysMessage } from './WhatsappConnectionService';
import { type FlowElementData, type FlowNode, type FlowEdge } from '../../client/src/features/types/whatsapp_flow_types';
import pino, { Logger } from 'pino';
import { AnyMessageContent } from '@whiskeysockets/baileys';

// Tipos de dados para nós de execução (precisam ser expandidos)
interface BaseNodeData {
    label: string;
    [key: string]: any;
}
interface TextMessageNodeExecutionData extends BaseNodeData {
    messageText: string;
}
interface Condition { // Reutilizando do ConditionNode.tsx (idealmente, de um shared/types)
  id: string;
  variable?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty';
  value?: string;
  outputLabel?: string;
}
interface ConditionNodeExecutionData extends BaseNodeData {
    conditions?: Condition[];
    defaultOutputLabel?: string; // Para o "else" / padrão
}
interface DelayNodeExecutionData extends BaseNodeData {
    delaySeconds: number;
}
interface SetVariableNodeExecutionData extends BaseNodeData {
    variableName: string;
    value: string; // Pode ser uma string que permite interpolação ou um valor direto
}
// Adicionar mais interfaces para outros tipos de nós: AiDecisionNodeData, ApiCallNodeData, etc.

class WhatsappFlowEngine {
    private logger: Logger;

    constructor() {
        this.logger = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ service: 'ZapFlowEngine' });
        this.logger.info("WhatsappFlowEngine inicializado.");
    }

    /**
     * Interpola variáveis no formato {{variavel}} em uma string ou estrutura de dados.
     */
    private interpolateVariables(data: any, variables: Record<string, any>): any {
        if (typeof data === 'string') {
            return data.replace(/\{\{(.*?)\}\}/g, (_, key) => {
                const trimmedKey = key.trim();
                // Suporte para acesso a propriedades de objeto, ex: {{triggerMessage.content.text}}
                const value = trimmedKey.split('.').reduce((obj, part) => obj && obj[part], variables);
                return value !== undefined && value !== null ? String(value) : ''; // Retorna string vazia se variável não encontrada
            });
        }
        if (Array.isArray(data)) {
            return data.map(item => this.interpolateVariables(item, variables));
        }
        if (typeof data === 'object' && data !== null) {
            const newData: Record<string, any> = {};
            for (const key in data) {
                newData[key] = this.interpolateVariables(data[key], variables);
            }
            return newData;
        }
        return data;
    }

    public async processIncomingMessage(
        mktv2UserId: number,
        contactJid: string,
        incomingMessage: ZapMessage // A mensagem já salva no nosso DB
    ): Promise<void> {
        this.logger.info({ mktv2UserId, contactJid, msgId: incomingMessage.baileysMessageId }, "Processando mensagem no FlowEngine.");

        let userFlowState = await this.getUserFlowState(mktv2UserId, contactJid);
        const mergedVariables = { // Variáveis disponíveis para o fluxo
            ...(userFlowState?.flowVariables as Record<string, any> || {}),
            triggerMessage: incomingMessage, // Mensagem que disparou/continuou o fluxo
            contactJid: contactJid,
            // Adicionar outras variáveis globais aqui (data, hora, etc.)
            currentDate: new Date().toLocaleDateString('pt-BR'),
            currentTime: new Date().toLocaleTimeString('pt-BR'),
        };


        if (!userFlowState || !userFlowState.activeFlowId || !userFlowState.currentNodeId) {
            this.logger.info({ mktv2UserId, contactJid }, "Nenhum fluxo ativo. Tentando encontrar gatilho...");
            const triggeredFlow = await this.findTriggerableFlow(mktv2UserId, incomingMessage, mergedVariables);
            if (triggeredFlow) {
                this.logger.info({ flowId: triggeredFlow.id }, `Fluxo '${triggeredFlow.name}' disparado.`);
                const startNode = this.findStartNode(triggeredFlow.elements as FlowElementData | undefined); // Cast
                if (startNode) {
                    userFlowState = await this.startFlowForUser(mktv2UserId, contactJid, triggeredFlow.id, startNode.id);
                    // Atualiza mergedVariables com o novo estado (que pode ter variáveis iniciais do fluxo)
                    Object.assign(mergedVariables, userFlowState.flowVariables as Record<string, any> || {});
                } else {
                    this.logger.error({ flowId: triggeredFlow.id }, "Fluxo disparado não possui nó inicial (triggerNode).");
                    return;
                }
            } else {
                this.logger.info({ mktv2UserId, contactJid }, "Nenhum fluxo de gatilho encontrado.");
                return;
            }
        }
        
        if (!userFlowState || !userFlowState.activeFlowId || !userFlowState.currentNodeId) {
             this.logger.error({ userFlowState }, "Estado do fluxo do usuário inválido após tentativa de gatilho.");
             return;
        }

        const flowDefinition = await this.getFlowDefinition(userFlowState.activeFlowId);
        if (!flowDefinition) {
            this.logger.error({ flowId: userFlowState.activeFlowId }, "Definição do fluxo não encontrada.");
            await this.endFlowForUser(userFlowState);
            return;
        }
        
        // Loop de execução para nós que não esperam input do usuário
        let currentNodeIdToExecute: string | null = userFlowState.currentNodeId;
        let safetyCounter = 0; // Para evitar loops infinitos
        const MAX_SEQUENTIAL_NODES = 10;

        while(currentNodeIdToExecute && safetyCounter < MAX_SEQUENTIAL_NODES) {
            safetyCounter++;
            const executionResult = await this.executeNodeLogic(
                flowDefinition, 
                userFlowState, 
                currentNodeIdToExecute, 
                mergedVariables, 
                triggerMessage // Passa a msg que disparou para o contexto do nó atual
            );
            
            if (!executionResult) { // Erro ou fim inesperado
                currentNodeIdToExecute = null;
                break;
            }

            userFlowState = executionResult.updatedUserFlowState; // Atualiza o estado para o próximo loop
            Object.assign(mergedVariables, userFlowState.flowVariables as Record<string, any> || {}); // Atualiza variáveis
            currentNodeIdToExecute = executionResult.nextNodeId;

            if (executionResult.waitForUserInput) {
                this.logger.info({ nodeId: userFlowState.currentNodeId }, "Nó executado, aguardando input do usuário.");
                break; // Sai do loop se o nó espera por input
            }
            if (!currentNodeIdToExecute) {
                 this.logger.info({ flowId: flowDefinition.id }, "Fim do fluxo alcançado ou sem próximo nó.");
                 await this.endFlowForUser(userFlowState); // Garante que o fluxo termine se não houver próximo nó
                 break;
            }
        }
        if (safetyCounter >= MAX_SEQUENTIAL_NODES) {
            this.logger.warn({ flowId: flowDefinition.id }, "Limite de nós sequenciais atingido. Fluxo pausado para evitar loop.");
        }

    }

    private async executeNodeLogic(
        flowDefinition: WhatsappFlow, // Usar o tipo completo
        userFlowState: typeof whatsappFlowUserStates.$inferSelect,
        nodeIdToExecute: string,
        currentVariables: Record<string, any>,
        triggerMessage?: ZapMessage
    ): Promise<{ nextNodeId: string | null; updatedUserFlowState: typeof whatsappFlowUserStates.$inferSelect; waitForUserInput: boolean } | null> {
        
        const currentNode = flowDefinition.elements?.nodes.find(n => n.id === nodeIdToExecute);
        if (!currentNode) {
            this.logger.error({ flowId: flowDefinition.id, currentNodeId: nodeIdToExecute }, "Nó atual não encontrado na definição do fluxo.");
            await this.endFlowForUser(userFlowState);
            return null;
        }

        this.logger.info({ flowId: flowDefinition.id, nodeId: currentNode.id, nodeType: currentNode.type }, "Executando nó.");
        let nextNodeId: string | null = null;
        let waitForUserInput = false; // Por padrão, o fluxo tenta continuar

        const nodeData = this.interpolateVariables(currentNode.data, currentVariables);

        switch (currentNode.type) {
            case 'triggerNode':
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;
            
            case 'textMessageNode':
                const textData = nodeData as TextMessageNodeExecutionData;
                if (textData.messageText) {
                    await sendBaileysMessage(userFlowState.mktv2UserId, userFlowState.contactJid, { text: textData.messageText });
                } else { this.logger.warn({nodeId: currentNode.id}, "TextMessageNode sem messageText."); }
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;

            case 'conditionNode':
                const conditionData = nodeData as ConditionNodeExecutionData;
                nextNodeId = this.evaluateConditions(flowDefinition.elements as FlowElementData | undefined, currentNode, conditionData, currentVariables);
                break;

            case 'delayNode': // Conceitual: delay real seria assíncrono
                const delayData = nodeData as DelayNodeExecutionData;
                this.logger.info(`Nó de Delay: aguardando ${delayData.delaySeconds || 0}s (simulado).`);
                // Em uma implementação real, você agendaria a próxima execução
                // ou usaria await new Promise(resolve => setTimeout(resolve, (delayData.delaySeconds || 0) * 1000));
                // Cuidado: isso bloquearia o worker. O ideal é um sistema de filas/scheduler para delays.
                // Por agora, apenas avança para o próximo nó.
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;

            case 'setVariableNode':
                const varData = nodeData as SetVariableNodeExecutionData;
                if (varData.variableName && varData.value !== undefined) {
                    const interpolatedValue = this.interpolateVariables(varData.value, currentVariables);
                    this.logger.info(`Definindo variável: ${varData.variableName} = ${interpolatedValue}`);
                    // Atualiza as variáveis no estado do usuário
                    const newVars = { ...(userFlowState.flowVariables as Record<string, any> || {}), [varData.variableName]: interpolatedValue };
                    await this.updateUserFlowState(userFlowState.id, { flowVariables: newVars });
                    // Atualiza currentVariables para o próximo nó no mesmo ciclo de execução
                    currentVariables[varData.variableName] = interpolatedValue; 
                } else { this.logger.warn({ nodeId: currentNode.id }, "SetVariableNode sem variableName ou value."); }
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;
            
            case 'questionNode': // Exemplo de nó que espera input
                const questionData = nodeData as any; // Defina QuestionNodeExecutionData
                if (questionData.questionText) {
                     await sendBaileysMessage(userFlowState.mktv2UserId, userFlowState.contactJid, { text: questionData.questionText });
                }
                waitForUserInput = true; // Para aqui e espera a próxima mensagem do usuário
                // O próximo nó será determinado pela resposta do usuário, não por uma edge direta daqui (geralmente)
                // Ou, se houver uma edge de "timeout" ou "sem resposta", ela poderia ser seguida.
                // Por enquanto, se não houver resposta, o fluxo para aqui.
                nextNodeId = null; // Não avança automaticamente
                break;


            case 'endNode':
                this.logger.info({ flowId: flowDefinition.id }, "Alcançado nó final do fluxo.");
                // Poderia enviar uma mensagem final aqui se configurado no endNode.data
                // await this.endFlowForUser(userFlowState); // endFlowForUser será chamado no loop principal se nextNodeId for null
                nextNodeId = null; // Sinaliza fim
                break;

            default:
                this.logger.warn({ nodeType: currentNode.type }, "Tipo de nó desconhecido ou não implementado.");
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;
        }

        const finalUserFlowState = await this.getUserFlowState(userFlowState.mktv2UserId, userFlowState.contactJid); // Pega o estado mais recente
        if (finalUserFlowState && nextNodeId) {
            await this.updateUserFlowState(finalUserFlowState.id, { currentNodeId: nextNodeId });
            finalUserFlowState.currentNodeId = nextNodeId; // Atualiza para retorno
        } else if (!nextNodeId) { // Se não há próximo nó (endNode ou nó sem saída conectada)
            await this.endFlowForUser(finalUserFlowState || userFlowState);
            if(finalUserFlowState) finalUserFlowState.currentNodeId = null; // Garante que está nulo
        }
        
        return { nextNodeId, updatedUserFlowState: finalUserFlowState || userFlowState, waitForUserInput };
    }


    private async getUserFlowState(mktv2UserId: number, contactJid: string): Promise<typeof whatsappFlowUserStates.$inferSelect | null> { /* ... como antes ... */ }
    private async findTriggerableFlow(mktv2UserId: number, message: ZapMessage, variables: Record<string, any>): Promise<WhatsappFlow | null> {
        const activeFlows = await zapDb.query.whatsappFlows.findMany({
            where: and( eq(whatsappFlows.mktv2UserId, mktv2UserId), eq(whatsappFlows.status, 'active') )
        });

        for (const flow of activeFlows) {
            if (flow.triggerType === 'keyword') {
                const configKeywords = (flow.triggerConfig as any)?.keyword || (flow.triggerConfig as any)?.keywords;
                const keywords: string[] = Array.isArray(configKeywords) ? configKeywords : (typeof configKeywords === 'string' ? configKeywords.split(',').map(k=>k.trim()) : []);
                
                const messageText = (message.content as any)?.text?.toLowerCase() || '';
                if (keywords.some(kw => messageText.includes(kw.toLowerCase()))) {
                    this.logger.info({flowId: flow.id, keyword: keywords}, "Keyword trigger match!");
                    return flow;
                }
            }
            // TODO: Implementar outros tipos de gatilho (first_message, button_click (requer análise do payload da msg), api_call, scheduled)
        }
        return null;
    }
    private findStartNode(elements?: FlowElementData): FlowNode | undefined { /* ... como antes ... */ }
    private async startFlowForUser(mktv2UserId: number, contactJid: string, flowId: number, startNodeId: string): Promise<typeof whatsappFlowUserStates.$inferSelect> { /* ... como antes ... */ }
    private async getFlowDefinition(flowId: number): Promise<WhatsappFlow | null> { /* ... como antes ... */ }
    private findNextNodeIdFromSource(elements: FlowElementData | undefined, sourceNodeId: string, sourceHandle?: string): string | null { /* ... como antes ... */ }
    private evaluateConditions(elements: FlowElementData | undefined, node: FlowNode, data: ConditionNodeExecutionData, variables: Record<string, any>): string | null {
        // ... (lógica de evaluateConditions como antes, mas use `variables` que já inclui `triggerMessage`) ...
        this.logger.debug({ conditions: data.conditions, variables }, "Avaliando condições");
        for (const condition of data.conditions || []) {
            const varName = condition.variable?.replace("{{","").replace("}}","").trim(); // Simplificado: {{var}} -> var
            const varValue = this.interpolateVariables(`{{${varName}}}`, variables); // Interpola para pegar o valor
            const compareValue = this.interpolateVariables(condition.value, variables);
            let conditionMet = false;
            this.logger.debug({varName, varValue, operator: condition.operator, compareValue},"Detalhes da condição");

            switch (condition.operator) {
                case 'equals': conditionMet = String(varValue) == String(compareValue); break;
                case 'not_equals': conditionMet = String(varValue) != String(compareValue); break;
                case 'contains': conditionMet = typeof varValue === 'string' && typeof compareValue === 'string' && varValue.toLowerCase().includes(compareValue.toLowerCase()); break;
                case 'greater_than': conditionMet = !isNaN(parseFloat(varValue)) && !isNaN(parseFloat(compareValue)) && parseFloat(varValue) > parseFloat(compareValue); break;
                case 'less_than': conditionMet = !isNaN(parseFloat(varValue)) && !isNaN(parseFloat(compareValue)) && parseFloat(varValue) < parseFloat(compareValue); break;
                case 'starts_with': conditionMet = typeof varValue === 'string' && typeof compareValue === 'string' && varValue.toLowerCase().startsWith(compareValue.toLowerCase()); break;
                case 'ends_with': conditionMet = typeof varValue === 'string' && typeof compareValue === 'string' && varValue.toLowerCase().endsWith(compareValue.toLowerCase()); break;
                case 'is_empty': conditionMet = varValue === null || varValue === undefined || String(varValue).trim() === ''; break;
                case 'is_not_empty': conditionMet = !(varValue === null || varValue === undefined || String(varValue).trim() === ''); break;
            }
            if (conditionMet) {
                this.logger.info({ conditionId: condition.id, condition, varValue }, "Condição atendida.");
                return this.findNextNodeIdFromSource(elements, node.id, condition.id); // Usa o ID da condição como sourceHandle
            }
        }
        this.logger.info("Nenhuma condição atendida, procurando saída padrão/else.");
        return this.findNextNodeIdFromSource(elements, node.id, data.defaultOutputLabel || 'default_else_output');
    }
    private async endFlowForUser(userFlowState: typeof whatsappFlowUserStates.$inferSelect): Promise<void> { /* ... como antes ... */ }
    private async updateUserFlowState(userFlowStateId: number, updates: Partial<Omit<NewWhatsappFlowUserState, 'mktv2UserId' | 'contactJid'>>): Promise<void> { /* ... como antes ... */ }
    public async setFlowVariable(userFlowStateId: number, variableName: string, value: any): Promise<void> { /* ... como antes ... */ }
}

const zapFlowEngineInstance = new WhatsappFlowEngine();
export default zapFlowEngineInstance;