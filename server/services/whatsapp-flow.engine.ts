// server/services/whatsapp-flow.engine.ts
import { storage } from '../storage';
import { WhatsappConnectionService } from './whatsapp-connection.service';
import * as schema from '../../shared/schema';
import { Edge, Node } from '@xyflow/react';

export class WhatsappFlowEngine {

  public async processMessage(userId: number, contactJid: string, messageContent: string): Promise<void> {
    console.log(`[FlowEngine] Processando mensagem de ${contactJid} para usuário ${userId}`);
    
    // 1. Obtém ou cria o estado do usuário no fluxo
    let userState = await storage.getFlowUserState(userId, contactJid);
    let flow: schema.Flow | undefined;

    // Se não há estado, é a primeira interação. Tenta iniciar um fluxo.
    if (!userState) {
        const triggerFlow = await storage.findTriggerFlow(userId, messageContent);
        if (!triggerFlow || !triggerFlow.elements || triggerFlow.elements.nodes.length === 0) {
            console.warn(`[FlowEngine] Nenhum fluxo de gatilho ativo ou válido encontrado para ${userId}. Ignorando.`);
            return;
        }
        flow = triggerFlow;
        const firstNode = this.findStartNode(flow);
        if (!firstNode) {
            console.error(`[FlowEngine] Fluxo ${flow.id} não possui um nó inicial.`);
            return;
        }
        userState = await storage.createFlowUserState({ userId, contactJid, activeFlowId: flow.id, currentNodeId: firstNode.id, flowVariables: {} });
        console.log(`[FlowEngine] Novo estado criado para ${contactJid}. Iniciando fluxo ${flow.id} no nó ${firstNode.id}`);
        
        // Como é uma nova interação, não há input a ser processado, então limpamos o messageContent
        messageContent = ''; 
    } else {
        if (!userState.activeFlowId) {
             await storage.deleteFlowUserState(userState.id);
             console.error(`[FlowEngine] Estado de usuário órfão encontrado para ${contactJid}. Estado limpo.`);
             return;
        }
        flow = await storage.getFlow(userState.activeFlowId, userId);
    }
    
    if (!flow || !userState.currentNodeId) {
        console.error(`[FlowEngine] Estado inválido para ${contactJid}. Fluxo ou nó não encontrado. Resetando.`);
        if (userState) await storage.deleteFlowUserState(userState.id);
        return;
    }

    // 2. Processa a resposta do usuário, se houver, para o nó de espera atual
    let currentNode = this.findNodeById(flow, userState.currentNodeId);
    let nextNodeId: string | null = currentNode?.id ?? null;

    if (currentNode && this.isWaitingNode(currentNode.type) && messageContent) {
        console.log(`[FlowEngine] Processando input "${messageContent}" para o nó de espera ${currentNode.id}`);
        nextNodeId = await this.processInput(userState, currentNode, flow.elements.edges, messageContent);
    }

    // 3. Executa em loop todos os nós de ação sequenciais
    while (nextNodeId) {
        const nodeToExecute = this.findNodeById(flow, nextNodeId);
        if (!nodeToExecute) {
            console.error(`[FlowEngine] Próximo nó ${nextNodeId} não encontrado no fluxo. Encerrando.`);
            break;
        }

        if (this.isWaitingNode(nodeToExecute.type)) {
            console.log(`[FlowEngine] Atingiu nó de espera ${nodeToExecute.id}. Enviando pergunta e pausando.`);
            await storage.updateFlowUserState(userState.id, { currentNodeId: nodeToExecute.id });
            await this.executeWaitingNode(userState, nodeToExecute);
            return; // Pausa a execução e aguarda a próxima mensagem do usuário
        }
        
        console.log(`[FlowEngine] Executando nó de ação ${nodeToExecute.id}`);
        nextNodeId = await this.executeActionNode(userState, nodeToExecute, flow.elements.edges);
    }

    // 4. Se o loop terminar, o fluxo chegou ao fim. Limpa o estado.
    if (!nextNodeId) {
        console.log(`[FlowEngine] Fim do fluxo para ${contactJid}.`);
        await storage.deleteFlowUserState(userState.id);
    }
  }

  private findStartNode(flow: schema.Flow): Node | undefined {
    return flow.elements.nodes.find(n => !flow.elements.edges.some(e => e.target === n.id));
  }

  private findNodeById(flow: schema.Flow, nodeId: string): Node | undefined {
    return flow.elements.nodes.find(n => n.id === nodeId);
  }

  private isWaitingNode(type: string | undefined): boolean {
    return type === 'buttonMessage' || type === 'waitInput';
  }

  private async processInput(userState: schema.WhatsappFlowUserState, node: Node, edges: Edge[], messageContent: string): Promise<string | null> {
    switch (node.type) {
        case 'buttonMessage':
            const button = node.data.buttons.find((b: any) => b.text === messageContent);
            if (button) {
                const edge = edges.find(e => e.source === node.id && e.sourceHandle === button.id);
                return edge?.target || null;
            }
            break;
        
        case 'waitInput':
            const variableName = node.data.variableName;
            if (variableName) {
                const newVariables = { ...userState.flowVariables, [variableName]: messageContent };
                await storage.updateFlowUserState(userState.id, { flowVariables: newVariables });
                console.log(`[FlowEngine] Variável "${variableName}" salva para ${userState.contactJid}.`);
            }
            const edge = edges.find(e => e.source === node.id); // 'waitInput' tem apenas uma saída
            return edge?.target || null;
    }
    return null;
  }

  private async executeWaitingNode(userState: schema.WhatsappFlowUserState, node: Node): Promise<void> {
    switch (node.type) {
      case 'buttonMessage':
        const buttonPayload = {
          text: node.data.text || 'Escolha uma opção:',
          footer: node.data.footer,
          buttons: node.data.buttons.map((btn: any) => ({
            buttonId: btn.id,
            buttonText: { displayText: btn.text },
            type: 1
          })),
          headerType: 1
        };
        await WhatsappConnectionService.sendMessageForUser(userState.userId, userState.contactJid, buttonPayload);
        break;
      
      case 'waitInput':
        if (node.data.message) {
            await WhatsappConnectionService.sendMessageForUser(userState.userId, userState.contactJid, { text: node.data.message });
        }
        break;
    }
  }

  private async executeActionNode(userState: schema.WhatsappFlowUserState, node: Node, edges: Edge[]): Promise<string | null> {
    switch (node.type) {
      case 'textMessage':
        const messageText = node.data.text || '...';
        await WhatsappConnectionService.sendMessageForUser(userState.userId, userState.contactJid, { text: messageText });
        const edge = edges.find(e => e.source === node.id);
        return edge?.target || null;
    }
    return null;
  }
}
