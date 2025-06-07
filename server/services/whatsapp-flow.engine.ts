// usbmkt/mktv2/MKTV2-mktv5/server/services/whatsapp-flow.engine.ts
import { storage } from '../storage.js';
import { WhatsappConnectionService } from './whatsapp-connection.service.js';
import { externalDataService } from './external-data.service.js';
// Não vamos importar mcp_handler aqui para evitar dependência circular, simplificaremos a chamada de IA
import { logger } from '../logger.js';
import type * as schema from '../../shared/schema.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

// Tipos locais para evitar dependência de libs de frontend
interface FlowNode { id: string; type?: string; data: any; position: { x: number; y: number };[key: string]: any; }
interface FlowEdge { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null;[key: string]: any; }
type FlowElements = { nodes: FlowNode[]; edges: FlowEdge[] };

// Função simples para IA (para remover dependência direta do mcp_handler)
async function getSimpleAiResponse(prompt: string, systemMessage?: string): Promise<string> {
    if (!config.GEMINI_API_KEY) return 'Serviço de IA indisponível.';
    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const fullPrompt = systemMessage ? `${systemMessage}\n\n${prompt}` : prompt;
    const result = await model.generateContent(fullPrompt);
    return result.response.text();
}

export class WhatsappFlowEngine {

  private getWhatsappService(userId: number): WhatsappConnectionService {
    // Retorna a instância existente ou cria uma nova, se necessário.
    // Esta lógica deve estar no seu serviço de conexão.
    return new WhatsappConnectionService(userId);
  }

  private interpolate(text: string, variables: Record<string, any>): string {
    if (!text) return '';
    return text.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (match: string, key: string) => {
      const value = key.split('.').reduce((o: any, i: any) => (o ? o[i] : undefined), variables);
      return value !== undefined ? String(value) : match;
    });
  }

  public async processMessage(userId: number, contactJid: string, messageContent: string): Promise<void> {
    logger.info({ contactJid, userId, messageContent }, `Processando mensagem.`);
    
    let userState = await storage.getFlowUserState(userId, contactJid);
    let flow: schema.Flow | undefined;
    let isNewSession = false;

    if (!userState) {
        isNewSession = true;
        const triggerFlow = await storage.findTriggerFlow(userId, messageContent);
        if (!triggerFlow || !triggerFlow.elements || !Array.isArray((triggerFlow.elements as FlowElements).nodes)) {
            logger.warn({ userId }, `Nenhum fluxo de gatilho ativo ou válido encontrado.`);
            return;
        }
        flow = triggerFlow;
        const firstNode = this.findStartNode(flow);
        if (!firstNode) {
            logger.error({ flowId: flow.id }, `Fluxo não possui um nó inicial.`);
            return;
        }
        userState = await storage.createFlowUserState({ userId, contactJid, activeFlowId: flow.id, currentNodeId: firstNode.id, flowVariables: {} });
        logger.info({ contactJid, flowId: flow.id, startNodeId: firstNode.id }, `Novo estado criado. Iniciando fluxo.`);
    } else {
        if (!userState.activeFlowId) {
             if (userState.id) await storage.deleteFlowUserState(userState.id);
             logger.error({ contactJid }, `Estado de usuário órfão encontrado. Estado limpo.`);
             return;
        }
        flow = await storage.getFlow(userState.activeFlowId, userId);
    }
    
    if (!flow || !userState.currentNodeId) {
        logger.error({ contactJid }, `Estado inválido. Fluxo ou nó não encontrado. Resetando.`);
        if (userState?.id) await storage.deleteFlowUserState(userState.id);
        return;
    }
    
    // Garantir que flow.elements é um objeto válido com 'nodes' e 'edges'
    const flowElements = flow.elements as FlowElements | null;
    if (!flowElements || !Array.isArray(flowElements.nodes) || !Array.isArray(flowElements.edges)) {
        logger.error({ flowId: flow.id }, "Estrutura de 'elements' do fluxo é inválida ou ausente.");
        return;
    }

    let currentNode = this.findNodeById(flow, userState.currentNodeId);
    let nextNodeId: string | null = currentNode?.id ?? null;

    if (currentNode && this.isWaitingNode(currentNode.type) && !isNewSession) {
        logger.info({ contactJid, node: currentNode.id }, `Processando input para o nó de espera.`);
        const updatedState = await storage.getFlowUserState(userId, contactJid);
        if(!updatedState) return;
        nextNodeId = await this.processInput(updatedState, currentNode, flowElements.edges, messageContent);
    }

    while (nextNodeId) {
        const nodeToExecute = this.findNodeById(flow, nextNodeId);
        if (!nodeToExecute) {
            logger.error({ flowId: flow.id, nodeId: nextNodeId }, `Próximo nó não encontrado. Encerrando.`);
            break;
        }

        const currentState = await storage.getFlowUserState(userId, contactJid);
        if (!currentState) {
            logger.warn({ contactJid }, "Estado do usuário foi removido durante a execução. Encerrando.");
            return;
        }

        if (this.isWaitingNode(nodeToExecute.type)) {
            logger.info({ contactJid, nodeId: nodeToExecute.id }, `Atingiu nó de espera. Pausando.`);
            await storage.updateFlowUserState(currentState.id, { currentNodeId: nodeToExecute.id });
            await this.executeWaitingNode(currentState, nodeToExecute);
            return; 
        }
        
        logger.info({ contactJid, nodeId: nodeToExecute.id, type: nodeToExecute.type }, `Executando nó de ação.`);
        nextNodeId = await this.executeActionNode(currentState, nodeToExecute, flowElements.edges);
    }

    if (nextNodeId === null) {
        logger.info({ contactJid }, `Fim do fluxo ou caminho sem saída.`);
        if (userState?.id) await storage.deleteFlowUserState(userState.id);
    }
  }

  private findStartNode = (flow: schema.Flow): FlowNode | undefined => {
    const elements = flow.elements as FlowElements;
    return elements.nodes.find((n: FlowNode) => !elements.edges.some((e: FlowEdge) => e.target === n.id));
  }
  private findNodeById = (flow: schema.Flow, nodeId: string): FlowNode | undefined => {
    const elements = flow.elements as FlowElements;
    return elements.nodes.find((n: FlowNode) => n.id === nodeId);
  }
  private isWaitingNode = (type?: string): boolean => ['buttonMessage', 'waitInput'].includes(type || '');
  
  private async processInput(userState: schema.WhatsappFlowUserState, node: FlowNode, edges: FlowEdge[], messageContent: string): Promise<string | null> {
    let nextNodeId: string | null = null;
    try {
      switch (node.type) {
        case 'buttonMessage': {
          const button = (node.data.buttons || []).find((b: any) => b.text === messageContent);
          if (button) {
            const edge = edges.find(e => e.source === node.id && e.sourceHandle === button.id);
            nextNodeId = edge?.target || null;
          }
          break;
        }
        case 'waitInput': {
          const variableName = node.data.variableName;
          if (variableName) {
            const currentVariables = userState.flowVariables && typeof userState.flowVariables === 'object' ? userState.flowVariables : {};
            const newVariables = { ...currentVariables, [variableName]: messageContent };
            if (userState.id) await storage.updateFlowUserState(userState.id, { flowVariables: newVariables });
            logger.info({ contactJid: userState.contactJid, variable: variableName }, `Variável salva.`);
          }
          const edge = edges.find(e => e.source === node.id);
          nextNodeId = edge?.target || null;
          break;
        }
      }
    } catch (err: any) {
        logger.error({ contactJid: userState.contactJid, nodeId: node.id, error: err.message }, "Erro ao processar input.");
    }
    return nextNodeId;
  }

  private async executeWaitingNode(userState: schema.WhatsappFlowUserState, node: FlowNode): Promise<void> {
    const whatsappService = this.getWhatsappService(userState.userId);
    try {
      switch (node.type) {
        case 'buttonMessage': {
          const flowVars = (userState.flowVariables && typeof userState.flowVariables === 'object') ? userState.flowVariables : {};
          const interpolatedText = node.data.text ? this.interpolate(node.data.text, flowVars) : 'Escolha uma opção:';
          const buttonPayload = {
            text: interpolatedText, footer: node.data.footer,
            buttons: (node.data.buttons || []).map((btn: any) => ({ buttonId: btn.id, buttonText: { displayText: btn.text }, type: 1 })),
            headerType: 1
          };
          await whatsappService.sendMessage(userState.contactJid, buttonPayload);
          break;
        }
        case 'waitInput': {
            const flowVars = (userState.flowVariables && typeof userState.flowVariables === 'object') ? userState.flowVariables : {};
          const promptMessage = node.data.message ? this.interpolate(node.data.message, flowVars) : '';
          if (promptMessage) {
            await whatsappService.sendMessage(userState.contactJid, { text: promptMessage });
          }
          break;
        }
      }
    } catch (err: any) {
      logger.error({ contactJid: userState.contactJid, nodeId: node.id, error: err.message }, "Erro ao executar nó de espera.");
    }
  }

  private async executeActionNode(userState: schema.WhatsappFlowUserState, node: FlowNode, edges: FlowEdge[]): Promise<string | null> {
    let success = true;
    const whatsappService = this.getWhatsappService(userState.userId);
    const flowVars = (userState.flowVariables && typeof userState.flowVariables === 'object') ? userState.flowVariables : {};
    
    try {
        switch (node.type) {
            case 'textMessage': {
                const messageText = this.interpolate(node.data.text || '...', flowVars);
                await whatsappService.sendMessage(userState.contactJid, { text: messageText });
                break;
            }
            case 'apiCall': {
                const { apiUrl, method, headers, body, saveResponseTo } = node.data;
                const interpolatedUrl = this.interpolate(apiUrl, flowVars);
                const interpolatedHeaders = headers ? JSON.parse(this.interpolate(headers, flowVars)) : undefined;
                const interpolatedBody = body ? JSON.parse(this.interpolate(body, flowVars)) : undefined;
                const response = await externalDataService.request(interpolatedUrl, { method, headers: interpolatedHeaders, body: interpolatedBody });
                if (saveResponseTo) {
                    const newVariables = { ...flowVars, [saveResponseTo]: response.data };
                    if(userState.id) await storage.updateFlowUserState(userState.id, { flowVariables: newVariables });
                }
                break;
            }
            case 'gptQuery': {
                const { prompt, systemMessage, saveResponseTo } = node.data;
                const interpolatedPrompt = this.interpolate(prompt, flowVars);
                const aiResponse = await getSimpleAiResponse(interpolatedPrompt, systemMessage);
                if (saveResponseTo) {
                    const newVariables = { ...flowVars, [saveResponseTo]: aiResponse };
                    if(userState.id) await storage.updateFlowUserState(userState.id, { flowVariables: newVariables });
                }
                break;
            }
            default: {
                logger.warn({ type: node.type }, "Tipo de nó de ação não implementado.");
                return null;
            }
        }
    } catch (err: any) {
        logger.error({ contactJid: userState.contactJid, nodeId: node.id, error: err.message }, "Erro ao executar nó de ação.");
        success = false;
    }
    
    const sourceHandleId = success ? 'source-success' : 'source-error';
    const edge = edges.find(e => e.source === node.id && e.sourceHandle === sourceHandleId) || edges.find(e => e.source === node.id && (!e.sourceHandle || e.sourceHandle === 'source-bottom'));
    
    return edge?.target || null;
  }
}
