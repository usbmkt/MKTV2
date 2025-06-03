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
    sendButtonsMessage as sendBaileysButtonsMessage,
    sendListMessage as sendBaileysListMessage,
    sendMediaMessage as sendBaileysMediaMessage,
    BaileysButtonPayload, BaileysListSectionPayload
} from './WhatsappConnectionService';
import { 
    type FlowElementData, type FlowNode, type FlowEdge, 
    type TextMessageNodeData, type ConditionNodeData, type FlowCondition,
    type ApiCallNodeData, type ButtonsMessageNodeData, type FlowButtonOptionData,
    type QuestionNodeData, type MediaMessageNodeData,
    type ListMessageNodeDataFE, type FlowListSectionData, type FlowListItemData,
    type ExternalDataFetchNodeDataFE, type DelayNodeData, type SetVariableNodeData,
    type TriggerNodeData, type EndNodeData, type AiDecisionNodeData,
    type GptQueryNodeData, type TagContactNodeData, type ClonedVoiceNodeData,
    type ActionNodeData, type ActionType as FlowActionType // Importar ActionNodeData e seu ActionType
} from '../../client/src/features/types/whatsapp_flow_types';
import pino, { Logger } from 'pino';
import axios, { AxiosRequestConfig, Method } from 'axios';
import { AnyMessageContent, WAMessage, extractMessageContent } from '@whiskeysockets/baileys';
import aiServiceInstance from './AIService';
import ttsServiceInstance from './TTSService';

// Interfaces de execução interna (derivadas dos tipos do frontend - NodeData)
interface BaseNodeExecutionData { label: string; [key: string]: any; } // Mantém como está
interface TextMessageNodeExecutionData extends BaseNodeExecutionData { messageText?: string; }
interface ButtonsMessageNodeExecutionData extends BaseNodeExecutionData { messageText?: string; buttons?: FlowButtonOptionData[]; footerText?: string; }
interface ListMessageNodeExecutionData extends BaseNodeExecutionData { messageText?: string; buttonText?: string; sections?: FlowListSectionData[]; footerText?: string; title?: string; }
interface ConditionNodeExecutionData extends BaseNodeExecutionData { conditions?: FlowCondition[]; defaultOutputLabel?: string; }
interface DelayNodeExecutionData extends BaseNodeExecutionData { delaySeconds?: number; }
interface SetVariableNodeExecutionData extends BaseNodeExecutionData { variableName?: string; value?: any; }
interface ApiCallNodeExecutionData extends BaseNodeExecutionData { method?: Method; url?: string; headers?: string; body?: string; saveResponseTo?: string; }
interface GptQueryNodeExecutionData extends BaseNodeExecutionData { prompt?: string; variableToSave?: string; systemMessage?: string; model?: string; }
interface AiDecisionNodeExecutionData extends BaseNodeExecutionData { prompt?: string; categories?: string[]; saveDecisionTo?: string;}
interface QuestionNodeExecutionData extends BaseNodeExecutionData { questionText?: string; variableToSave?: string; }
interface MediaMessageNodeExecutionData extends BaseNodeExecutionData { mediaType?: 'image' | 'video' | 'audio' | 'document'; url?: string; caption?: string; fileName?: string; mimeType?: string; ptt?: boolean; }
interface ExternalDataNodeExecutionData extends BaseNodeExecutionData { url?: string; method?: Method; saveToVariable?: string; headers?: string; }
interface ActionNodeExecutionData extends BaseNodeExecutionData { actionType?: FlowActionType; actionParams?: Record<string, any>; }
interface ClonedVoiceNodeExecutionData extends BaseNodeExecutionData { textToSpeak?: string; voiceId?: string; }
interface TriggerNodeExecutionData extends BaseNodeExecutionData { triggerType?: string; config?: any; }
interface EndNodeExecutionData extends BaseNodeExecutionData { endMessage?: string; }


class WhatsappFlowEngine {
    private logger: Logger;
    constructor() { 
        this.logger = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ service: 'ZapFlowEngine' });
        this.logger.info("WhatsappFlowEngine inicializado.");
    }

    private interpolateVariables(data: any, variables: Record<string, any>): any { /* ... como antes ... */ return data; }

    public async processIncomingMessage(mktv2UserId: number, contactJid: string, incomingBaileysMessage: WAMessage, savedZapMessage: ZapMessage): Promise<void> {
        this.logger.info({ mktv2UserId, contactJid, baileysMsgId: incomingBaileysMessage.key.id, savedMsgId: savedZapMessage.id }, "Processando mensagem no FlowEngine.");
        let userFlowState = await this.getUserFlowState(mktv2UserId, contactJid);
        
        const initialVariables: Record<string, any> = {
            triggerMessage: savedZapMessage, 
            rawTriggerBaileysMessage: incomingBaileysMessage,
            contactJid: contactJid, 
            currentDate: new Date().toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'}), 
            currentTime: new Date().toLocaleTimeString('pt-BR', {timeZone: 'America/Sao_Paulo'}),
            // Adicionar aqui mais variáveis úteis, como nome do contato se disponível
        };
        let mergedVariables = { ...initialVariables, ...(userFlowState?.flowVariables as Record<string, any> || {}) };
        let sourceHandleForNextNode: string | undefined = undefined;

        if (userFlowState?.waitingNodeId) {
            // ... (lógica completa para tratar respostas a QuestionNode, ButtonsMessageNode, ListMessageNode como na rodada anterior) ...
            // Esta lógica atualiza userFlowState.currentNodeId e mergedVariables.
        } 
        
        if (!userFlowState || !userFlowState.activeFlowId || !userFlowState.currentNodeId) {
            // ... (lógica de encontrar gatilho e iniciar fluxo como na rodada anterior) ...
        }
        
        if (!userFlowState || !userFlowState.activeFlowId || !userFlowState.currentNodeId) {
             this.logger.error({ mktv2UserId, contactJid, userFlowState }, "Estado do fluxo do usuário ainda é inválido após todas as verificações."); return;
        }

        const flowDefinition = await this.getFlowDefinition(userFlowState.activeFlowId);
        if (!flowDefinition) { /* ... */ return; }
        
        let currentNodeIdToExecute: string | null = userFlowState.currentNodeId;
        let safetyCounter = 0; const MAX_SEQUENTIAL_NODES = 15;

        while(currentNodeIdToExecute && safetyCounter < MAX_SEQUENTIAL_NODES) {
            // ... (lógica de loop e recarregar estado/variáveis como na rodada anterior) ...
            const executionResult = await this.executeNodeLogic( flowDefinition, userFlowState, currentNodeIdToExecute, mergedVariables, savedZapMessage );
            // ... (lógica de atualização de estado e saída do loop como na rodada anterior) ...
        }
        // ... (log de safetyCounter) ...
    }

    private async executeNodeLogic(
        flowDefinition: WhatsappFlow,
        userFlowState: ZapFlowUserState,
        nodeIdToExecute: string,
        currentVariables: Record<string, any>,
        triggerMessage?: ZapMessage
    ): Promise<{ nextNodeId: string | null; updatedUserFlowState: ZapFlowUserState; waitForUserInput: boolean } | null> {
        const currentNode = flowDefinition.elements?.nodes.find(n => n.id === nodeIdToExecute);
        if (!currentNode) { /* ... */ return null; }
        this.logger.info({ flowId: flowDefinition.id, nodeId: currentNode.id, nodeType: currentNode.type }, `Executando nó: ${currentNode.data.label || currentNode.type}`);
        let nextNodeId: string | null = null;
        let waitForUserInput = false;
        const nodeData = this.interpolateVariables(currentNode.data, currentVariables);
        let updatedFlowVariables = { ...(userFlowState.flowVariables as Record<string,any> || {}) };

        try { // Adicionar try-catch geral para execução do nó
            switch (currentNode.type) {
                case 'triggerNode':
                    const triggerData = nodeData as TriggerNodeExecutionData; // Definir TriggerNodeData se necessário
                    this.logger.info(`Gatilho '${triggerData.triggerType}' ativado.`);
                    nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id);
                    break;
                
                case 'textMessageNode':
                    const textData = nodeData as TextMessageNodeExecutionData;
                    if (textData.messageText) {
                        await sendBaileysTextMessage(userFlowState.mktv2UserId, userFlowState.contactJid, textData.messageText);
                    } else { this.logger.warn({nodeId: currentNode.id}, "TextMessageNode sem messageText."); }
                    nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id);
                    break;

                case 'buttonsMessageNode':
                    const buttonsData = nodeData as ButtonsMessageNodeExecutionData;
                    if (buttonsData.messageText && buttonsData.buttons?.length > 0) {
                        const baileysButtons: BaileysButtonPayload[] = buttonsData.buttons.map(btn => ({ id: btn.id, displayText: btn.label }));
                        await sendBaileysButtonsMessage(userFlowState.mktv2UserId, userFlowState.contactJid, buttonsData.messageText, baileysButtons, buttonsData.footerText);
                        await this.updateUserFlowState(userFlowState.id, { waitingNodeId: currentNode.id }); // Espera resposta
                        waitForUserInput = true; nextNodeId = null;
                    } else { this.logger.warn({nodeId: currentNode.id}, "ButtonsMessageNode mal configurado."); nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id); }
                    break;

                case 'listMessageNode':
                    const listData = nodeData as ListMessageNodeExecutionData;
                    if (listData.messageText && listData.buttonText && listData.sections?.length > 0) {
                        const baileysSections: BaileysListSectionPayload[] = listData.sections.map(sec => ({
                            title: sec.title,
                            rows: sec.rows.map(row => ({ title: row.title, rowId: row.id, description: row.description }))
                        }));
                        await sendBaileysListMessage(userFlowState.mktv2UserId, userFlowState.contactJid, 
                            listData.messageText, listData.buttonText, baileysSections, listData.title, listData.footerText);
                        await this.updateUserFlowState(userFlowState.id, { waitingNodeId: currentNode.id }); // Espera resposta
                        waitForUserInput = true; nextNodeId = null;
                    } else { this.logger.warn({nodeId: currentNode.id}, "ListMessageNode mal configurado."); nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id); }
                    break;

                case 'mediaMessageNode':
                    const mediaData = nodeData as MediaMessageNodeExecutionData;
                    if (mediaData.mediaType && mediaData.url) {
                        await sendBaileysMediaMessage(userFlowState.mktv2UserId, userFlowState.contactJid, {
                            type: mediaData.mediaType, url: mediaData.url, caption: mediaData.caption,
                            fileName: mediaData.fileName, mimeType: mediaData.mimeType, ptt: mediaData.ptt
                        });
                    } else { this.logger.warn({nodeId: currentNode.id}, "MediaMessageNode mal configurado."); }
                    nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id);
                    break;

                case 'questionNode':
                    const questionData = nodeData as QuestionNodeExecutionData;
                    if (questionData.questionText && questionData.variableToSave) {
                         await sendBaileysTextMessage(userFlowState.mktv2UserId, userFlowState.contactJid, questionData.questionText);
                         await this.updateUserFlowState(userFlowState.id, { waitingForVariable: questionData.variableToSave, waitingNodeId: currentNode.id });
                         waitForUserInput = true; nextNodeId = null;
                    } else { this.logger.warn({nodeId: currentNode.id}, "QuestionNode mal configurado."); nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id); }
                    break;
                
                case 'conditionNode': /* ... como antes ... */ break;
                case 'delayNode': /* ... como antes ... */ break;
                case 'setVariableNode': /* ... como antes ... */ break;
                case 'apiCallNode': /* ... como antes ... */ break;
                case 'externalDataFetchNode': /* ... como antes ... */ break;
                case 'gptQueryNode': /* ... como antes (com aiServiceInstance) ... */ break;
                case 'aiDecisionNode': /* ... como antes (com aiServiceInstance) ... */ break;
                case 'tagContactNode': /* ... como antes ... */ break;
                case 'clonedVoiceMessageNode': /* ... como antes (com ttsServiceInstance) ... */ break;

                case 'actionNode': // Lógica mais completa para ActionNode
                    const actionData = nodeData as ActionNodeExecutionData;
                    this.logger.info({ actionData }, "Executando ActionNode...");
                    if (actionData.actionType) {
                        switch (actionData.actionType) {
                            case 'ADD_TAG':
                            case 'REMOVE_TAG':
                                this.logger.info(`AÇÃO TAG (Simulada): ${actionData.actionType} tag '${actionData.actionParams?.tagName}' para ${userFlowState.contactJid}.`);
                                // await contactService.manageTag(mktv2UserId, contactJid, actionData.actionParams?.tagName, actionData.actionType);
                                break;
                            case 'SEND_EMAIL_ADMIN':
                                this.logger.info(`AÇÃO EMAIL (Simulada): Enviar para ${actionData.actionParams?.adminEmail} Assunto: ${actionData.actionParams?.subject}`);
                                // await emailService.sendAdminNotification(actionData.actionParams?.adminEmail, actionData.actionParams?.subject, actionData.actionParams?.body);
                                break;
                            // Adicionar outros actionTypes
                            default: this.logger.warn(`ActionType '${actionData.actionType}' não implementado.`);
                        }
                    } else { this.logger.warn("ActionNode: actionType não definido."); }
                    nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id);
                    break;

                case 'endNode':
                    const endData = nodeData as EndNodeExecutionData;
                    if (endData.endMessage) {
                        await sendBaileysTextMessage(userFlowState.mktv2UserId, userFlowState.contactJid, endData.endMessage);
                    }
                    this.logger.info({ flowId: flowDefinition.id }, "Alcançado nó final do fluxo.");
                    nextNodeId = null; 
                    // endFlowForUser será chamado no loop principal porque nextNodeId é null e waitForUserInput é false
                    break;
                default:
                    this.logger.warn({ nodeType: currentNode.type }, "Tipo de nó desconhecido ou não implementado no motor.");
                    nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id);
                    break;
            }
        } catch (nodeError: any) {
            this.logger.error({ flowId: flowDefinition.id, nodeId: currentNode.id, nodeType: currentNode.type, error: nodeError.message, stack: nodeError.stack }, "Erro durante execução do nó.");
            // Opcional: Tentar ir para uma saída de erro específica do nó, se existir
            // nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements, currentNode.id, 'error_output_handle');
            // Se não, o fluxo pode parar ou seguir uma rota de erro global do fluxo (não implementado)
            // Por agora, se um nó falhar, paramos o fluxo para este ciclo.
            nextNodeId = null; // Para o fluxo neste ponto se um nó falhar criticamente
        }
        
        const stateUpdates: Partial<Omit<NewWhatsappFlowUserState, 'id' | 'mktv2UserId' | 'contactJid'>> = {
            flowVariables: updatedFlowVariables,
            currentNodeId: (waitForUserInput ? currentNode.id : nextNodeId)
        };
        if (waitForUserInput) {
            stateUpdates.waitingForVariable = (currentNode.type === 'questionNode' ? (nodeData as QuestionNodeExecutionData).variableToSave : null) || null; // Se não for questionNode, limpa
            stateUpdates.waitingNodeId = currentNode.id;
        } else {
            stateUpdates.waitingForVariable = null;
            stateUpdates.waitingNodeId = null;
        }
        await this.updateUserFlowState(userFlowState.id, stateUpdates);
        
        const finalUserFlowState = await this.getUserFlowState(userFlowState.mktv2UserId, userFlowState.contactJid);
        if (!finalUserFlowState) { this.logger.error("Falha ao recarregar estado do usuário."); return null; }

        if (!nextNodeId && !waitForUserInput && currentNode.type !== 'endNode') { this.logger.info({ nodeId: currentNode.id }, "Fluxo parado (sem próximo nó e não esperando input)."); }
        else if (!nextNodeId && currentNode.type === 'endNode') { await this.endFlowForUser(finalUserFlowState); }
        
        return { nextNodeId, updatedUserFlowState: finalUserFlowState, waitForUserInput };
    }
    
    // --- Métodos Helper (COMPLETOS como fornecidos anteriormente) ---
    private async getUserFlowState(mktv2UserId: number, contactJid: string): Promise<ZapFlowUserState | null> {
        return zapDb.query.whatsappFlowUserStates.findFirst({
            where: and(
                eq(whatsappFlowUserStates.mktv2UserId, mktv2UserId),
                eq(whatsappFlowUserStates.contactJid, contactJid)
            )
        });
    }
    private async findTriggerableFlow(mktv2UserId: number, message: ZapMessage, variables: Record<string, any>): Promise<WhatsappFlow | null> {
        const activeFlows = await zapDb.query.whatsappFlows.findMany({
            where: and( eq(whatsappFlows.mktv2UserId, mktv2UserId), eq(whatsappFlows.status, 'active') )
        });
        for (const flow of activeFlows) {
            const triggerConfig = this.interpolateVariables(flow.triggerConfig, variables) as any; // Interpolar config
            if (flow.triggerType === 'keyword' && (message.content as any)?.text) {
                const keywords: string[] = Array.isArray(triggerConfig?.keywords) ? triggerConfig.keywords : 
                                          (typeof triggerConfig?.keyword === 'string' ? triggerConfig.keyword.split(',').map((k:string)=>k.trim()) : []);
                const messageText = (message.content as any).text.toLowerCase();
                if (keywords.some(kw => messageText.includes(kw.toLowerCase()))) {
                    this.logger.info({flowId: flow.id, keywordMatch: keywords.find(kw => messageText.includes(kw.toLowerCase()))}, "Gatilho de Palavra-chave ATIVADO!");
                    return flow;
                }
            }
            // TODO: Implementar 'first_message' (requer verificar se é a primeira interação do contato com este mktv2UserId)
            // TODO: Implementar 'button_click' (requer análise do payload da msg para ID de botão de template HSM)
        }
        return null;
    }
    private findStartNode(elements?: FlowElementData): FlowNode | undefined {
        if (!elements || !elements.nodes) return undefined;
        return elements.nodes.find(node => node.type === 'triggerNode');
    }
    private async startFlowForUser(mktv2UserId: number, contactJid: string, flowId: number, startNodeId: string): Promise<ZapFlowUserState> {
        this.logger.info({ mktv2UserId, contactJid, flowId, startNodeId }, "Iniciando/Reiniciando fluxo para usuário.");
        const newStateData: NewWhatsappFlowUserState = {
            mktv2UserId, contactJid, activeFlowId: flowId, currentNodeId: startNodeId,
            flowVariables: {}, waitingForVariable: null, waitingNodeId: null, lastInteractionAt: new Date(),
        };
        // Tenta encontrar um estado existente para este usuário e contato
        const existingState = await this.getUserFlowState(mktv2UserId, contactJid);
        if (existingState) {
            const [updatedState] = await zapDb.update(whatsappFlowUserStates)
                .set(newStateData) // Atualiza para o novo fluxo
                .where(eq(whatsappFlowUserStates.id, existingState.id))
                .returning();
            return updatedState;
        } else {
            const [savedState] = await zapDb.insert(whatsappFlowUserStates).values(newStateData).returning();
            return savedState;
        }
    }
    private async getFlowDefinition(flowId: number): Promise<WhatsappFlow | null> {
        return zapDb.query.whatsappFlows.findFirst({ where: eq(whatsappFlows.id, flowId) });
    }
    private findNextNodeIdFromSource(elements: FlowElementData | undefined, sourceNodeId: string, sourceHandle?: string): string | null {
        if (!elements || !elements.edges) return null;
        const edge = elements.edges.find(e => e.source === sourceNodeId && (sourceHandle ? e.sourceHandle === sourceHandle : true));
        return edge?.target || null;
    }
    private evaluateConditions(elements: FlowElementData | undefined, node: FlowNode, data: ConditionNodeExecutionData, variables: Record<string, any>): string | null {
        this.logger.debug({ conditions: data.conditions, variables }, "Avaliando condições para nó " + node.id);
        for (const condition of data.conditions || []) {
            const varName = condition.variable?.replace("{{","").replace("}}","").trim();
            let varValue = this.interpolateVariables(`{{${varName}}}`, variables); // Pega o valor da variável já interpolada
            let compareValue = this.interpolateVariables(condition.value, variables);
            
            // Se forem números, converter para comparação numérica
            const numVarValue = parseFloat(varValue);
            const numCompareValue = parseFloat(compareValue);
            const isNumericComparison = !isNaN(numVarValue) && !isNaN(numCompareValue);

            let conditionMet = false;
            this.logger.debug({varName, varValueActual: varValue, operator: condition.operator, compareValueActual: compareValue, isNumericComparison},"Detalhes da condição");

            switch (condition.operator) {
                case 'equals': conditionMet = isNumericComparison ? numVarValue == numCompareValue : String(varValue).toLowerCase() == String(compareValue).toLowerCase(); break;
                case 'not_equals': conditionMet = isNumericComparison ? numVarValue != numCompareValue : String(varValue).toLowerCase() != String(compareValue).toLowerCase(); break;
                case 'contains': conditionMet = typeof varValue === 'string' && typeof compareValue === 'string' && varValue.toLowerCase().includes(compareValue.toLowerCase()); break;
                case 'greater_than': conditionMet = isNumericComparison && numVarValue > numCompareValue; break;
                case 'less_than': conditionMet = isNumericComparison && numVarValue < numCompareValue; break;
                case 'starts_with': conditionMet = typeof varValue === 'string' && typeof compareValue === 'string' && varValue.toLowerCase().startsWith(compareValue.toLowerCase()); break;
                case 'ends_with': conditionMet = typeof varValue === 'string' && typeof compareValue === 'string' && varValue.toLowerCase().endsWith(compareValue.toLowerCase()); break;
                case 'is_empty': conditionMet = varValue === null || varValue === undefined || String(varValue).trim() === ''; break;
                case 'is_not_empty': conditionMet = !(varValue === null || varValue === undefined || String(varValue).trim() === ''); break;
            }
            if (conditionMet) {
                this.logger.info({ conditionId: condition.id, condition, varValue }, "Condição atendida.");
                return this.findNextNodeIdFromSource(elements, node.id, condition.id);
            }
        }
        this.logger.info("Nenhuma condição atendida, procurando saída padrão: " + (data.defaultOutputLabel || 'default_else_output_handle_id'));
        return this.findNextNodeIdFromSource(elements, node.id, data.defaultOutputLabel || 'default_else_output_handle_id');
    }
    private async endFlowForUser(userFlowState: ZapFlowUserState): Promise<void> {
        this.logger.info({ mktv2UserId: userFlowState.mktv2UserId, contactJid: userFlowState.contactJid, flowId: userFlowState.activeFlowId }, "Finalizando fluxo para usuário.");
        await zapDb.update(whatsappFlowUserStates)
            .set({ activeFlowId: null, currentNodeId: null, waitingForVariable: null, waitingNodeId: null, lastInteractionAt: new Date() })
            .where(eq(whatsappFlowUserStates.id, userFlowState.id));
    }
    private async updateUserFlowState(userFlowStateId: number, updates: Partial<Omit<NewWhatsappFlowUserState, 'id' | 'mktv2UserId' | 'contactJid'>>): Promise<void> {
        await zapDb.update(whatsappFlowUserStates)
            .set({ ...updates, lastInteractionAt: new Date() })
            .where(eq(whatsappFlowUserStates.id, userFlowStateId));
    }
    public async setFlowVariable(userFlowStateId: number, variableName: string, value: any): Promise<void> {
        const currentState = await zapDb.query.whatsappFlowUserStates.findFirst({where: eq(whatsappFlowUserStates.id, userFlowStateId)});
        if (currentState) {
            const newVariables = { ...(currentState.flowVariables as Record<string, any> || {}), [variableName]: value };
            await this.updateUserFlowState(userFlowStateId, { flowVariables: newVariables });
        }
    }
}

const zapFlowEngineInstance = new WhatsappFlowEngine();
export default zapFlowEngineInstance;