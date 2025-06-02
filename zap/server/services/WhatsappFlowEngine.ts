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
    sendMediaMessage as sendBaileysMediaMessage,
    sendListMessage as sendBaileysListMessage // Importado
} from './WhatsappConnectionService';
import { type FlowElementData, type FlowNode, type FlowEdge, type ListSectionData, type ListItemData } from '../../client/src/features/types/whatsapp_flow_types'; // Tipos do frontend
import pino, { Logger } from 'pino';
import axios, { AxiosRequestConfig } from 'axios';
import { AnyMessageContent } from '@whiskeysockets/baileys';

// Tipos de dados para nós de execução
interface BaseNodeData { label: string; [key: string]: any; }
interface TextMessageNodeExecutionData extends BaseNodeData { messageText: string; }
interface ButtonOptionFE { id: string; label: string; value?: string; }
interface ButtonsMessageNodeExecutionData extends BaseNodeData { messageText: string; buttons: ButtonOptionFE[]; footerText?: string; }
interface Condition { id: string; variable?: string; operator?: string; value?: string; outputLabel?: string; }
interface ConditionNodeExecutionData extends BaseNodeData { conditions?: Condition[]; defaultOutputLabel?: string; }
interface DelayNodeExecutionData extends BaseNodeData { delaySeconds: number; }
interface SetVariableNodeExecutionData extends BaseNodeData { variableName: string; value: string; }
interface ApiCallNodeExecutionData extends BaseNodeData { method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; url: string; headers?: string; body?: string; saveResponseTo: string; }
interface GptQueryNodeExecutionData extends BaseNodeData { prompt: string; variableToSave: string; systemMessage?: string; model?: string; }
interface QuestionNodeExecutionData extends BaseNodeData { questionText: string; variableToSave: string; }
interface MediaMessageNodeExecutionData extends BaseNodeData { mediaType: 'image' | 'video' | 'audio' | 'document'; url?: string; caption?: string; fileName?: string; mimeType?: string; ptt?: boolean; }
interface ListMessageNodeExecutionData extends BaseNodeData { messageText: string; buttonText: string; sections: ListSectionData[]; footerText?: string; title?: string; }
interface ExternalDataNodeExecutionData extends BaseNodeData { url: string; method?: 'GET'; saveToVariable: string; headers?: string; /* Adicionar body se suportar POST */ }


class WhatsappFlowEngine {
    private logger: Logger;
    constructor() { 
        this.logger = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ service: 'ZapFlowEngine' });
        this.logger.info("WhatsappFlowEngine inicializado.");
    }

    private interpolateVariables(data: any, variables: Record<string, any>): any {
        if (typeof data === 'string') {
            return data.replace(/\{\{(.*?)\}\}/g, (_, key) => {
                const trimmedKey = key.trim();
                const value = trimmedKey.split('.').reduce((obj: any, part: string) => obj && obj[part], variables);
                return value !== undefined && value !== null ? String(value) : '';
            });
        }
        if (Array.isArray(data)) { return data.map(item => this.interpolateVariables(item, variables)); }
        if (typeof data === 'object' && data !== null) {
            const newData: Record<string, any> = {};
            for (const key in data) { newData[key] = this.interpolateVariables(data[key], variables); }
            return newData;
        }
        return data;
    }

    public async processIncomingMessage(mktv2UserId: number, contactJid: string, incomingMessage: ZapMessage): Promise<void> {
        this.logger.info({ mktv2UserId, contactJid, msgId: incomingMessage.baileysMessageId }, "Processando mensagem no FlowEngine.");
        let userFlowState = await this.getUserFlowState(mktv2UserId, contactJid);
        
        const initialVariables: Record<string, any> = {
            triggerMessage: incomingMessage, contactJid, 
            currentDate: new Date().toLocaleDateString('pt-BR'), 
            currentTime: new Date().toLocaleTimeString('pt-BR'),
        };
        let mergedVariables = { ...initialVariables, ...(userFlowState?.flowVariables as Record<string, any> || {}) };

        if (userFlowState?.waitingForVariable && userFlowState.waitingNodeId) {
            const variableName = userFlowState.waitingForVariable;
            const waitingNodeId = userFlowState.waitingNodeId;
            const answerText = (incomingMessage.content as any)?.text || (incomingMessage.messageType !== 'text' ? `[${incomingMessage.messageType}_recebido]` : '[RESPOSTA_VAZIA]');
            
            this.logger.info({ variableName, answerText }, `Resposta para '${variableName}' recebida.`);
            mergedVariables[variableName] = answerText;
            userFlowState.flowVariables = { ...(userFlowState.flowVariables as any || {}), [variableName]: answerText };
            
            await this.updateUserFlowState(userFlowState.id, { waitingForVariable: null, waitingNodeId: null, flowVariables: userFlowState.flowVariables });

            const flowDef = await this.getFlowDefinition(userFlowState.activeFlowId!);
            if (flowDef) {
                const questionNode = flowDef.elements?.nodes.find(n => n.id === waitingNodeId);
                userFlowState.currentNodeId = questionNode ? this.findNextNodeIdFromSource(flowDef.elements as FlowElementData | undefined, questionNode.id) : null;
                if(userFlowState.currentNodeId) await this.updateUserFlowState(userFlowState.id, { currentNodeId: userFlowState.currentNodeId });
                else { this.logger.warn({waitingNodeId}, "Nó de pergunta não tem saída. Finalizando."); await this.endFlowForUser(userFlowState); return; }
            } else { await this.endFlowForUser(userFlowState); return; }
        } 
        else if (!userFlowState || !userFlowState.activeFlowId || !userFlowState.currentNodeId) {
            const triggeredFlow = await this.findTriggerableFlow(mktv2UserId, incomingMessage, mergedVariables);
            if (triggeredFlow) { 
                this.logger.info({ flowId: triggeredFlow.id }, `Fluxo '${triggeredFlow.name}' disparado.`);
                const startNode = this.findStartNode(triggeredFlow.elements as FlowElementData | undefined);
                if (startNode) {
                    userFlowState = await this.startFlowForUser(mktv2UserId, contactJid, triggeredFlow.id, startNode.id);
                    Object.assign(mergedVariables, userFlowState.flowVariables as Record<string, any> || {});
                } else { this.logger.error({ flowId: triggeredFlow.id }, "Fluxo não possui nó inicial."); return; }
            } 
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
            userFlowState = await this.getUserFlowState(mktv2UserId, contactJid); // Recarrega estado
            if (!userFlowState) { this.logger.error("Estado do usuário desapareceu."); currentNodeIdToExecute = null; break; }
            mergedVariables = { ...initialVariables, ...(userFlowState.flowVariables as Record<string, any> || {}) };
            
            const executionResult = await this.executeNodeLogic( flowDefinition, userFlowState, currentNodeIdToExecute, mergedVariables, incomingMessage );
            if (!executionResult) { currentNodeIdToExecute = null; break; }

            userFlowState = executionResult.updatedUserFlowState;
            currentNodeIdToExecute = executionResult.nextNodeId;

            if (executionResult.waitForUserInput) { this.logger.info({ node: userFlowState.currentNodeId }, "Aguardando input."); break; }
            if (!currentNodeIdToExecute) { this.logger.info({ flowId: flowDefinition.id }, "Fim do fluxo ou sem próximo nó."); await this.endFlowForUser(userFlowState); break; }
        }
        if (safetyCounter >= MAX_SEQUENTIAL_NODES) { this.logger.warn({ flowId: flowDefinition.id }, "Limite de nós sequenciais."); }
    }

    private async executeNodeLogic(
        flowDefinition: WhatsappFlow,
        userFlowState: ZapFlowUserState,
        nodeIdToExecute: string,
        currentVariables: Record<string, any>,
        triggerMessage?: ZapMessage
    ): Promise<{ nextNodeId: string | null; updatedUserFlowState: ZapFlowUserState; waitForUserInput: boolean } | null> {
        
        const currentNode = flowDefinition.elements?.nodes.find(n => n.id === nodeIdToExecute);
        if (!currentNode) { this.logger.error({ flowId: flowDefinition.id, currentNodeId: nodeIdToExecute }, "Nó atual não encontrado."); await this.endFlowForUser(userFlowState); return null; }

        this.logger.info({ flowId: flowDefinition.id, nodeId: currentNode.id, nodeType: currentNode.type }, "Executando nó.");
        let nextNodeId: string | null = null;
        let waitForUserInput = false;
        const nodeData = this.interpolateVariables(currentNode.data, currentVariables);
        let updatedFlowVariables = { ...(userFlowState.flowVariables as Record<string,any> || {}) };

        switch (currentNode.type) {
            case 'triggerNode':
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;
            
            case 'textMessageNode':
                const textData = nodeData as TextMessageNodeExecutionData;
                if (textData.messageText) {
                    await sendBaileysTextMessage(userFlowState.mktv2UserId, userFlowState.contactJid, { text: textData.messageText });
                } else { this.logger.warn({nodeId: currentNode.id}, "TextMessageNode sem messageText."); }
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;

            case 'buttonsMessageNode':
                const buttonsData = nodeData as ButtonsMessageNodeExecutionData;
                if (buttonsData.messageText && buttonsData.buttons?.length > 0) {
                    const baileysButtons = buttonsData.buttons.map(btn => ({
                        buttonId: btn.id, // ID para callback, Baileys espera 'id'
                        buttonText: { displayText: btn.label },
                        type: 1 // Tipo 1 para BOTÃO DE RESPOSTA RÁPIDA.
                    }));
                    // await sendBaileysButtonsMessage(userFlowState.mktv2UserId, userFlowState.contactJid, buttonsData.messageText, baileysButtons, buttonsData.footerText);
                    this.logger.warn("Envio real de ButtonsMessage TODO: chamar WhatsappConnectionService com payload Baileys formatado.");
                    waitForUserInput = true; nextNodeId = null;
                } else { this.logger.warn({nodeId: currentNode.id}, "ButtonsMessageNode mal configurado."); }
                break;

            case 'listMessageNode':
                const listData = nodeData as ListMessageNodeExecutionData;
                if (listData.messageText && listData.buttonText && listData.sections?.length > 0) {
                    const baileysSections = listData.sections.map(sec => ({
                        title: sec.title,
                        rows: sec.rows.map(row => ({ title: row.title, rowId: row.id, description: row.description }))
                    }));
                    // await sendBaileysListMessage(userFlowState.mktv2UserId, userFlowState.contactJid, 
                    //     listData.messageText, listData.buttonText, baileysSections, listData.title, listData.footerText);
                    this.logger.warn("Envio real de ListMessage TODO: chamar WhatsappConnectionService com payload Baileys formatado.");
                    waitForUserInput = true; nextNodeId = null;
                } else { this.logger.warn({nodeId: currentNode.id}, "ListMessageNode mal configurado."); }
                break;

            case 'mediaMessageNode':
                const mediaData = nodeData as MediaMessageNodeExecutionData;
                this.logger.info({ mediaData }, "Enviando MediaMessageNode...");
                if (mediaData.mediaType && mediaData.url) {
                    // await sendBaileysMediaMessage(userFlowState.mktv2UserId, userFlowState.contactJid, {
                    //     type: mediaData.mediaType, url: mediaData.url, caption: mediaData.caption,
                    //     fileName: mediaData.fileName, mimeType: mediaData.mimeType, ptt: mediaData.ptt
                    // });
                    this.logger.warn("Envio real de MediaMessage TODO: chamar WhatsappConnectionService.");
                } else { this.logger.warn({nodeId: currentNode.id}, "MediaMessageNode mal configurado."); }
                nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id);
                break;

            case 'conditionNode': /* ... como antes ... */ break;
            case 'delayNode': /* ... como antes ... */ break;
            case 'setVariableNode': /* ... como antes ... */ break;
            case 'questionNode': /* ... como antes ... */ break;
            
            case 'apiCallNode':
                const apiData = nodeData as ApiCallNodeExecutionData;
                this.logger.info({ apiData }, "Executando ApiCallNode");
                try {
                    const headers = apiData.headers ? JSON.parse(apiData.headers) : {};
                    const body = (apiData.method !== 'GET' && apiData.body) ? JSON.parse(apiData.body) : undefined;
                    const config: AxiosRequestConfig = { method: apiData.method, url: apiData.url, headers, data: body, timeout: 15000 }; // Aumentado timeout
                    const response = await axios(config);
                    this.logger.info({ status: response.status, dataPreview: JSON.stringify(response.data).substring(0,100) }, "Resposta da API recebida.");
                    if (apiData.saveResponseTo) {
                        updatedFlowVariables[apiData.saveResponseTo] = response.data;
                        currentVariables[apiData.saveResponseTo] = response.data;
                    }
                    nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id, 'success');
                } catch (error: any) { /* ... como antes, tratando erro e pegando 'failure' path ... */ }
                break;
            
            case 'externalDataFetchNode': // Similar ao ApiCallNode, mas geralmente mais simples (GET)
                const fetchData = nodeData as ExternalDataNodeExecutionData;
                this.logger.info({ fetchData }, "Executando ExternalDataFetchNode");
                try {
                    if (!fetchData.url || !fetchData.saveToVariable) {
                        this.logger.warn("ExternalDataFetchNode: URL ou saveToVariable não definidos.");
                        nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id, 'failure');
                        break;
                    }
                    const headers = fetchData.headers ? JSON.parse(fetchData.headers) : {};
                    const config: AxiosRequestConfig = { method: fetchData.method || 'GET', url: fetchData.url, headers, timeout: 10000 };
                    const response = await axios(config);
                    this.logger.info({ status: response.status }, "Resposta da API externa (fetch) recebida.");
                    updatedFlowVariables[fetchData.saveToVariable] = response.data;
                    currentVariables[fetchData.saveToVariable] = response.data;
                    nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id, 'success');
                } catch (error: any) {
                    this.logger.error({ errMsg: error.message, status: error.response?.status, fetchData }, "Erro no ExternalDataFetchNode.");
                    updatedFlowVariables[fetchData.saveToVariable] = { error: true, message: error.message, status: error.response?.status };
                    currentVariables[fetchData.saveToVariable] = updatedFlowVariables[fetchData.saveToVariable];
                    nextNodeId = this.findNextNodeIdFromSource(flowDefinition.elements as FlowElementData | undefined, currentNode.id, 'failure');
                }
                break;

            case 'gptQueryNode': /* ... (simulado como antes) ... */ break;
            case 'endNode': /* ... como antes ... */ break;
            default: /* ... como antes ... */ break;
        }
        
        await this.updateUserFlowState(userFlowState.id, { 
            flowVariables: updatedFlowVariables, 
            currentNodeId: (waitForUserInput ? currentNode.id : nextNodeId), // Se espera input, mantém o nó atual, senão avança
            waitingForVariable: waitForUserInput && (nodeData as QuestionNodeExecutionData)?.variableToSave ? (nodeData as QuestionNodeExecutionData).variableToSave : null,
            waitingNodeId: waitForUserInput ? currentNode.id : null
        });
        
        const finalUserFlowState = await this.getUserFlowState(userFlowState.mktv2UserId, userFlowState.contactJid);
        if (!finalUserFlowState) { this.logger.error("Falha ao recarregar estado do usuário."); return null; }

        if (!nextNodeId && !waitForUserInput && currentNode.type !== 'endNode') { this.logger.info({ nodeId: currentNode.id }, "Fluxo parado."); }
        else if (!nextNodeId && currentNode.type === 'endNode') { await this.endFlowForUser(finalUserFlowState); }
        
        return { nextNodeId, updatedUserFlowState: finalUserFlowState, waitForUserInput };
    }
    
    private async getUserFlowState(mktv2UserId: number, contactJid: string): Promise<ZapFlowUserState | null> {
        return zapDb.query.whatsappFlowUserStates.findFirst({
            where: and(
                eq(whatsappFlowUserStates.mktv2UserId, mktv2UserId),
                eq(whatsappFlowUserStates.contactJid, contactJid)
            )
        });
    }
    private async findTriggerableFlow(mktv2UserId: number, message: ZapMessage, variables: Record<string, any>): Promise<WhatsappFlow | null> {
        // ... (lógica como antes, pode usar `variables` para gatilhos mais complexos)
        return null; // Placeholder
    }
    private findStartNode(elements?: FlowElementData): FlowNode | undefined {
        return elements?.nodes.find(node => node.type === 'triggerNode');
    }
    private async startFlowForUser(mktv2UserId: number, contactJid: string, flowId: number, startNodeId: string): Promise<ZapFlowUserState> {
        this.logger.info({ mktv2UserId, contactJid, flowId, startNodeId }, "Iniciando fluxo.");
        const newStateData: NewWhatsappFlowUserState = {
            mktv2UserId, contactJid, activeFlowId: flowId, currentNodeId: startNodeId,
            flowVariables: {}, waitingForVariable: null, waitingNodeId: null, lastInteractionAt: new Date(),
        };
        const [savedState] = await zapDb.insert(whatsappFlowUserStates)
            .values(newStateData)
            .onConflictDoUpdate({ target: [whatsappFlowUserStates.mktv2UserId, whatsappFlowUserStates.contactJid], set: newStateData })
            .returning();
        return savedState;
    }
    private async getFlowDefinition(flowId: number): Promise<WhatsappFlow | null> {
        return zapDb.query.whatsappFlows.findFirst({ where: eq(whatsappFlows.id, flowId) });
    }
    private findNextNodeIdFromSource(elements: FlowElementData | undefined, sourceNodeId: string, sourceHandle?: string): string | null {
        if (!elements) return null;
        const outgoingEdge = elements.edges.find(edge => 
            edge.source === sourceNodeId && 
            (sourceHandle ? edge.sourceHandle === sourceHandle : true) // Se sourceHandle for dado, confere, senão pega a primeira saída
        );
        return outgoingEdge?.target || null;
    }
    private evaluateConditions(elements: FlowElementData | undefined, node: FlowNode, data: ConditionNodeExecutionData, variables: Record<string, any>): string | null {
         // ... (lógica como antes, mas agora retorna o ID do handle da condição, ex: condition.id) ...
        this.logger.debug({ conditions: data.conditions, variables }, "Avaliando condições");
        for (const condition of data.conditions || []) {
            const varName = condition.variable?.replace("{{","").replace("}}","").trim();
            const varValue = this.interpolateVariables(`{{${varName}}}`, variables);
            const compareValue = this.interpolateVariables(condition.value, variables);
            let conditionMet = false;
            this.logger.debug({varName, varValue, operator: condition.operator, compareValue},"Detalhes da condição");

            switch (condition.operator) { /* ... (todos os operadores como antes) ... */ }
            if (conditionMet) {
                this.logger.info({ conditionId: condition.id, condition, varValue }, "Condição atendida.");
                return this.findNextNodeIdFromSource(elements, node.id, condition.id); // Usa o ID da condição como sourceHandle