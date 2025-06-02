// zap/server/services/WhatsappFlowEngine.ts
import { zapDb } from '../db';
import { 
    whatsappFlows, 
    whatsappFlowUserStates, 
    NewWhatsappFlowUserState, 
    ZapMessage, 
    WhatsappFlow,
    ZapFlowUserState
} from '../../shared/zap_schema';
import { eq, and } from 'drizzle-orm';
import { 
    getOrCreateWhatsappConnection, 
    sendMessage as sendBaileysTextMessage,
    sendButtonsMessage as sendBaileysButtonsMessage, // Assinatura existe
    sendListMessage as sendBaileysListMessage,     // Assinatura existe
    sendMediaMessage as sendBaileysMediaMessage
} from './WhatsappConnectionService';
import { type FlowElementData, type FlowNode, type FlowEdge, type ListSectionData, type ListItemData } from '../../client/src/features/types/whatsapp_flow_types';
import pino, { Logger } from 'pino';
import axios, { AxiosRequestConfig } from 'axios';
import { AnyMessageContent, WAMessage } from '@whiskeysockets/baileys'; // Adicionado WAMessage

// Tipos de dados para nós de execução (como antes, adicionar novos se necessário)
interface BaseNodeData { label: string; [key: string]: any; }
interface TextMessageNodeExecutionData extends BaseNodeData { messageText: string; }
interface ButtonOptionFE { id: string; label: string; value?: string; }
interface ButtonsMessageNodeExecutionData extends BaseNodeData { messageText: string; buttons: ButtonOptionFE[]; footerText?: string; }
interface ListItemFE { id: string; title: string; description?: string; } // FE para Frontend
interface ListSectionFE { title: string; rows: ListItemFE[]; } // FE para Frontend
interface ListMessageNodeExecutionData extends BaseNodeData { messageText: string; buttonText: string; sections: ListSectionFE[]; footerText?: string; title?: string; }
interface Condition { id: string; variable?: string; operator?: string; value?: string; outputLabel?: string; }
interface ConditionNodeExecutionData extends BaseNodeData { conditions?: Condition[]; defaultOutputLabel?: string; }
interface DelayNodeExecutionData extends BaseNodeData { delaySeconds: number; }
interface SetVariableNodeExecutionData extends BaseNodeData { variableName: string; value: any; } // value pode ser qualquer tipo após interpolação
interface ApiCallNodeExecutionData extends BaseNodeData { method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; url: string; headers?: string; body?: string; saveResponseTo: string; }
interface GptQueryNodeExecutionData extends BaseNodeData { prompt: string; variableToSave: string; systemMessage?: string; model?: string; }
interface QuestionNodeExecutionData extends BaseNodeData { questionText: string; variableToSave: string; }
interface MediaMessageNodeExecutionData extends BaseNodeData { mediaType: 'image' | 'video' | 'audio' | 'document'; url?: string; caption?: string; fileName?: string; mimeType?: string; ptt?: boolean; }
interface ExternalDataNodeExecutionData extends BaseNodeData { url: string; method?: 'GET'; saveToVariable: string; headers?: string; }


class WhatsappFlowEngine {
    private logger: Logger;
    constructor() { /* ... como antes ... */ }
    private interpolateVariables(data: any, variables: Record<string, any>): any { /* ... como antes ... */ }

    public async processIncomingMessage(mktv2UserId: number, contactJid: string, incomingBaileysMessage: WAMessage, savedZapMessage: ZapMessage): Promise<void> {
        this.logger.info({ mktv2UserId, contactJid, baileysMsgId: incomingBaileysMessage.key.id }, "Processando mensagem no FlowEngine.");
        let userFlowState = await this.getUserFlowState(mktv2UserId, contactJid);
        
        const initialVariables: Record<string, any> = {
            triggerMessage: savedZapMessage, // Usar a mensagem já formatada e salva
            contactJid: contactJid, 
            currentDate: new Date().toLocaleDateString('pt-BR'), 
            currentTime: new Date().toLocaleTimeString('pt-BR'),
        };
        let mergedVariables = { ...initialVariables, ...(userFlowState?.flowVariables as Record<string, any> || {}) };
        let sourceHandleForNextNode: string | undefined = undefined; // Para respostas de botões/listas

        if (userFlowState?.waitingNodeId) { // Estava esperando por algo
            const waitingNodeId = userFlowState.waitingNodeId;
            const flowDef = userFlowState.activeFlowId ? await this.getFlowDefinition(userFlowState.activeFlowId) : null;
            const waitingNodeDefinition = flowDef?.elements?.nodes.find(n => n.id === waitingNodeId);

            if (waitingNodeDefinition) {
                if (userFlowState.waitingForVariable && waitingNodeDefinition.type === 'questionNode') {
                    const variableName = userFlowState.waitingForVariable;
                    const answerText = (savedZapMessage.content as any)?.text || (savedZapMessage.messageType !== 'text' ? `[${savedZapMessage.messageType}_recebido]` : '[RESPOSTA_VAZIA]');
                    this.logger.info({ variableName, answerText }, `Resposta para '${variableName}' recebida.`);
                    mergedVariables[variableName] = answerText;
                    userFlowState.flowVariables = { ...(userFlowState.flowVariables as any || {}), [variableName]: answerText };
                    sourceHandleForNextNode = undefined; // Saída padrão do QuestionNode
                } 
                // Verificar se é uma resposta a um ButtonsMessageNode
                else if (waitingNodeDefinition.type === 'buttonsMessageNode' && incomingBaileysMessage.message?.buttonsResponseMessage) {
                    const selectedButtonId = incomingBaileysMessage.message.buttonsResponseMessage.selectedButtonId;
                    this.logger.info({ selectedButtonId }, "Resposta de ButtonsMessage recebida.");
                    if (selectedButtonId) {
                        mergedVariables['selectedButtonId'] = selectedButtonId;
                        sourceHandleForNextNode = selectedButtonId; // O ID do botão é o ID do handle de saída
                    }
                }
                // Verificar se é uma resposta a um ListMessageNode
                else if (waitingNodeDefinition.type === 'listMessageNode' && incomingBaileysMessage.message?.listResponseMessage) {
                    const selectedRowId = incomingBaileysMessage.message.listResponseMessage.singleSelectReply?.selectedRowId;
                    this.logger.info({ selectedRowId }, "Resposta de ListMessage recebida.");
                    if (selectedRowId) {
                        mergedVariables['selectedRowId'] = selectedRowId;
                        sourceHandleForNextNode = selectedRowId; // O ID do item da lista é o ID do handle de saída
                    }
                } else {
                     this.logger.info({waitingNodeId, waitingForVariable: userFlowState.waitingForVariable}, "Mensagem recebida, mas não corresponde a uma resposta esperada específica (botão/lista/pergunta). Retomando fluxo se possível ou tentando gatilho.");
                }
                
                // Limpa o estado de espera e define o próximo nó
                await this.updateUserFlowState(userFlowState.id, { 
                    waitingForVariable: null, waitingNodeId: null, flowVariables: userFlowState.flowVariables 
                });
                userFlowState.currentNodeId = waitingNodeDefinition ? this.findNextNodeIdFromSource(flowDef?.elements as FlowElementData | undefined, waitingNodeDefinition.id, sourceHandleForNextNode) : null;

                if(userFlowState.currentNodeId) {
                    await this.updateUserFlowState(userFlowState.id, { currentNodeId: userFlowState.currentNodeId });
                } else { 
                    this.logger.warn({waitingNodeId, sourceHandleForNextNode}, "Nó que esperava input não tem saída correspondente. Finalizando."); 
                    await this.endFlowForUser(userFlowState); return; 
                }
            } else { // Nó de espera não encontrado, limpar estado e tentar gatilho
                 this.logger.warn({waitingNodeId}, "Nó que estava esperando input não foi encontrado na definição do fluxo. Limpando estado.");
                 await this.updateUserFlowState(userFlowState.id, { waitingForVariable: null, waitingNodeId: null, activeFlowId: null, currentNodeId: null });
                 userFlowState = null; // Força a busca por gatilho
            }
        }
        
        if (!userFlowState || !userFlowState.activeFlowId || !userFlowState.currentNodeId) {
            const triggeredFlow = await this.findTriggerableFlow(mktv2UserId, savedZapMessage, mergedVariables);
            if (triggeredFlow) { /* ... (iniciar fluxo como antes, atualizando userFlowState e mergedVariables) ... */ } 
            else { this.logger.info({ mktv2UserId, contactJid }, "Nenhum gatilho."); return; }
        }
        
        if (!userFlowState || !userFlowState.activeFlowId || !userFlowState.currentNodeId) {
             this.logger.error({ userFlowState }, "Estado do fluxo inválido."); return;
        }

        const flowDefinition = await this.getFlowDefinition(userFlowState.activeFlowId);
        if (!flowDefinition) { this.logger.error({ flowId: userFlowState.activeFlowId }, "Definição do fluxo não encontrada."); await this.endFlowForUser(userFlowState); return; }
        
        let currentNodeIdToExecute: string | null = userFlowState.currentNodeId;
        let safetyCounter = 0; const MAX_SEQUENTIAL_NODES = 15;

        while(currentNodeIdToExecute && safetyCounter < MAX_SEQUENTIAL_NODES) {
            safetyCounter++;
            userFlowState = await this.getUserFlowState(mktv2UserId, contactJid);
            if (!userFlowState) { this.logger.error("Estado do usuário desapareceu."); currentNodeIdToExecute = null; break; }
            mergedVariables = { ...initialVariables, ...(userFlowState.flowVariables as Record<string, any> || {}) };
            
            const executionResult = await this.executeNodeLogic( flowDefinition, userFlowState, currentNodeIdToExecute, mergedVariables, savedZapMessage );
            if (!executionResult) { currentNodeIdToExecute = null; break; }

            userFlowState = executionResult.updatedUserFlowState;
            currentNodeIdToExecute = executionResult.nextNodeId;

            if (executionResult.waitForUserInput) { this.logger.info({ node: userFlowState.currentNodeId }, "Aguardando input do usuário."); break; }
            if (!currentNodeIdToExecute) { this.logger.info({ flowId: flowDefinition.id }, "Fim do fluxo ou sem próximo nó."); await this.endFlowForUser(userFlowState); break; }
        }
        if (safetyCounter >= MAX_SEQUENTIAL_NODES) { this.logger.warn({ flowId: flowDefinition.id }, "Limite de nós sequenciais atingido."); }
    }

    private async executeNodeLogic(
        flowDefinition: WhatsappFlow,
        userFlowState: ZapFlowUserState,
        nodeIdToExecute: string,
        currentVariables: Record<string, any>,
        triggerMessage?: ZapMessage // Mensagem que originou este ciclo de execução (pode ser a mesma que disparou o fluxo)
    ): Promise<{ nextNodeId: string | null; updatedUserFlowState: ZapFlowUserState; waitForUserInput: boolean } | null> {
        const currentNode = flowDefinition.elements?.nodes.find(n => n.id === nodeIdToExecute);
        if (!currentNode) { /* ... erro ... */ return null; }
        this.logger.info({ flowId: flowDefinition.id, nodeId: currentNode.id, nodeType: currentNode.type }, "Executando nó.");
        let nextNodeId: string | null = null;
        let waitForUserInput = false;
        const nodeData = this.interpolateVariables(currentNode.data, currentVariables); // Interpola ANTES de usar
        let updatedFlowVariables = { ...(userFlowState.flowVariables as Record<string,any> || {}) };

        switch (currentNode.type) {
            case 'triggerNode': /* ... */ break;
            case 'textMessageNode': /* ... */ break;
            case 'buttonsMessageNode':
                const buttonsData = nodeData as ButtonsMessageNodeExecutionData;
                if (buttonsData.messageText && buttonsData.buttons?.length > 0) {
                    const baileysButtons = buttonsData.buttons.map(btn => ({ id: btn.id, display_text: btn.label })); // Formato simplificado para exemplo Baileys
                    // await sendBaileysButtonsMessage(userFlowState.mktv2UserId, userFlowState.contactJid, buttonsData.messageText, baileysButtons, buttonsData.footerText);
                    this.logger.warn("Envio real de ButtonsMessage TODO: WhatsappConnectionService precisa do formato Baileys correto.");
                    await this.updateUserFlowState(userFlowState.id, { waitingNodeId: currentNode.id }); // Indica que este nó está esperando
                    waitForUserInput = true; nextNodeId = null;
                } else { this.logger.warn({nodeId: currentNode.id}, "ButtonsMessageNode mal configurado."); }
                break;
            case 'listMessageNode':
                const listData = nodeData as ListMessageNodeExecutionData;
                if (listData.messageText && listData.buttonText && listData.sections?.length > 0) {
                    // const baileysSections = listData.sections.map(sec => ({ title: sec.title, rows: sec.rows.map(row => ({ title: row.title, rowId: row.id, description: row.description })) }));
                    // await sendBaileysListMessage(userFlowState.mktv2UserId, userFlowState.contactJid, listData.messageText, listData.buttonText, baileysSections, listData.title, listData.footerText);
                    this.logger.warn("Envio real de ListMessage TODO: WhatsappConnectionService precisa do formato Baileys correto.");
                    await this.updateUserFlowState(userFlowState.id, { waitingNodeId: currentNode.id }); // Indica que este nó está esperando
                    waitForUserInput = true; nextNodeId = null;
                } else { this.logger.warn({nodeId: currentNode.id}, "ListMessageNode mal configurado."); }
                break;
            case 'mediaMessageNode': /* ... como antes ... */ break;
            case 'conditionNode': /* ... como antes ... */ break;
            case 'delayNode':
                const delayData = nodeData as DelayNodeExecutionData;
                const delayMs = (delayData.delaySeconds || 0) * 1000;
                this.logger.info(`Nó de Delay: aguardando ${delayData.delaySeconds}s.`);
                if (delayMs > 0) {
                    // NÂO use await new Promise aqui em um servidor real pois bloquearia o event loop.
                    // Em produção: agendar uma tarefa (ex: BullMQ, node-cron com persistência)
                    // para re-chamar processIncomingMessage ou uma função específica de continuação do fluxo
                    // para este usuário/contato APÓS o delay, passando o próximo nó.
                    // Por agora, simularemos que o fluxo continua imediatamente para fins de teste da estrutura.
                    this.logger.warn("Delay real requer um sistema de agendamento/fila para não bloquear o servidor.");
                }
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;
            case 'setVariableNode':
                const varData = nodeData as SetVariableNodeExecutionData;
                if (varData.variableName) { // value pode ser string vazia
                    const interpolatedValue = this.interpolateVariables(varData.value, currentVariables); // Interpola o valor a ser setado
                    this.logger.info(`Definindo variável: ${varData.variableName} = '${interpolatedValue}'`);
                    updatedFlowVariables[varData.variableName] = interpolatedValue;
                    currentVariables[varData.variableName] = interpolatedValue; 
                } else { this.logger.warn({nodeId: currentNode.id}, "SetVariableNode sem variableName."); }
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;
            case 'questionNode': /* ... como antes, mas agora o processIncomingMessage lida com a resposta ... */ break;
            case 'apiCallNode': /* ... como antes ... */ break;
            case 'externalDataFetchNode': /* ... como antes ... */ break;
            case 'gptQueryNode': /* ... como antes ... */ break;
            case 'endNode': /* ... como antes ... */ break;
            default: /* ... como antes ... */ break;
        }
        
        await this.updateUserFlowState(userFlowState.id, { 
            flowVariables: updatedFlowVariables, 
            currentNodeId: (waitForUserInput ? currentNode.id : nextNodeId),
            // waitingForVariable e waitingNodeId são setados pelo questionNode ou limpos pelo processIncomingMessage
        });
        
        const finalUserFlowState = await this.getUserFlowState(userFlowState.mktv2UserId, userFlowState.contactJid);
        if (!finalUserFlowState) { this.logger.error("Falha ao recarregar estado do usuário."); return null; }

        if (!nextNodeId && !waitForUserInput && currentNode.type !== 'endNode') { /* ... */ }
        else if (!nextNodeId && currentNode.type === 'endNode') { await this.endFlowForUser(finalUserFlowState); }
        
        return { nextNodeId, updatedUserFlowState: finalUserFlowState, waitForUserInput };
    }
    
    private async getUserFlowState(mktv2UserId: number, contactJid: string): Promise<ZapFlowUserState | null> { /* ... */ return null; }
    private async findTriggerableFlow(mktv2UserId: number, message: ZapMessage, variables: Record<string, any>): Promise<WhatsappFlow | null> { /* ... */ return null; }
    private findStartNode(elements?: FlowElementData): FlowNode | undefined { /* ... */ return undefined; }
    private async startFlowForUser(mktv2UserId: number, contactJid: string, flowId: number, startNodeId: string): Promise<ZapFlowUserState> { /* ... */ return {} as ZapFlowUserState; }
    private async getFlowDefinition(flowId: number): Promise<WhatsappFlow | null> { /* ... */ return null; }
    private findNextNodeIdFromSource(elements: FlowElementData | undefined, sourceNodeId: string, sourceHandle?: string): string | null { /* ... */ return null; }
    private evaluateConditions(elements: FlowElementData | undefined, node: FlowNode, data: ConditionNodeExecutionData, variables: Record<string, any>): string | null { /* ... */ return null; }
    private async endFlowForUser(userFlowState: ZapFlowUserState): Promise<void> { /* ... */ }
    private async updateUserFlowState(userFlowStateId: number, updates: Partial<Omit<NewWhatsappFlowUserState, 'id' | 'mktv2UserId' | 'contactJid'>>): Promise<void> { /* ... */ }
    public async setFlowVariable(userFlowStateId: number, variableName: string, value: any): Promise<void> { /* ... */ }
}

const zapFlowEngineInstance = new WhatsappFlowEngine();
export default zapFlowEngineInstance;