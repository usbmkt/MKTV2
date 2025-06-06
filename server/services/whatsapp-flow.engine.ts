// server/services/whatsapp-flow.engine.ts
import { storage } from '../storage';
import { WhatsappConnectionService } from './whatsapp-connection.service';
import * as schema from '../../shared/schema';
import { Edge, Node } from '@xyflow/react';

export class WhatsappFlowEngine {

  public async processMessage(userId: number, contactJid: string, messageContent: string): Promise<void> {
    console.log(`[FlowEngine] Processando mensagem de ${contactJid} para usuário ${userId}`);

    let userState = await storage.getFlowUserState(userId, contactJid);

    // Se não há estado, é a primeira interação ou uma interação nova.
    if (!userState) {
      const triggerFlow = await storage.findTriggerFlow(userId, messageContent);
      
      if (!triggerFlow || !triggerFlow.elements || triggerFlow.elements.nodes.length === 0) {
        console.warn(`[FlowEngine] Nenhum fluxo de gatilho ativo ou válido encontrado para usuário ${userId}. Ignorando mensagem.`);
        return;
      }

      // O primeiro nó é geralmente o que não tem 'target' em nenhuma aresta
      const firstNode = triggerFlow.elements.nodes.find(n => 
         !triggerFlow.elements.edges.some(e => e.target === n.id)
      );

      if (!firstNode) {
        console.error(`[FlowEngine] Fluxo ${triggerFlow.id} não tem um nó inicial definido.`);
        return;
      }
      
      console.log(`[FlowEngine] Iniciando novo fluxo ${triggerFlow.id} para ${contactJid} no nó ${firstNode.id}`);
      userState = await storage.createFlowUserState({
        userId,
        contactJid,
        activeFlowId: triggerFlow.id,
        currentNodeId: firstNode.id,
        flowVariables: {},
        lastInteractionAt: new Date()
      });
    }

    if (!userState.activeFlowId || !userState.currentNodeId) {
        console.log(`[FlowEngine] Usuário ${contactJid} está sem fluxo ativo ou nó atual. Finalizando interação.`);
        await storage.deleteFlowUserState(userState.id);
        return;
    }

    const flow = await storage.getFlow(userState.activeFlowId, userId);
    if (!flow || !flow.elements) {
        console.error(`[FlowEngine] Fluxo ID ${userState.activeFlowId} não encontrado ou está vazio.`);
        await storage.deleteFlowUserState(userState.id);
        return;
    }

    const currentNode = flow.elements.nodes.find((n: Node) => n.id === userState!.currentNodeId);
    if (!currentNode) {
        console.error(`[FlowEngine] Nó atual ID ${userState.currentNodeId} não encontrado no fluxo ${flow.id}. Resetando estado.`);
        await storage.deleteFlowUserState(userState.id);
        return;
    }

    console.log(`[FlowEngine] Executando nó ${currentNode.id} (tipo: ${currentNode.type}) para ${contactJid}`);
    
    // Lógica para executar o nó atual
    await this.executeNode(userState, currentNode, flow.elements.edges, messageContent);
  }

  private async executeNode(userState: schema.WhatsappFlowUserState, node: Node, edges: Edge[], messageContent: string): Promise<void> {
    let nextNodeId: string | null = null;
    
    try {
      switch (node.type) {
        case 'textMessage':
          const messageText = node.data?.text || 'Mensagem de texto vazia.';
          
          await WhatsappConnectionService.sendMessageForUser(userState.userId, userState.contactJid, { text: messageText });
          
          const outgoingEdge = edges.find(e => e.source === node.id);
          nextNodeId = outgoingEdge?.target || null;
          
          console.log(`[FlowEngine] Mensagem de texto enviada. Próximo nó: ${nextNodeId}`);
          break;

        default:
          console.warn(`[FlowEngine] Tipo de nó "${node.type}" não implementado. Finalizando fluxo para este usuário.`);
          await storage.deleteFlowUserState(userState.id);
          return;
      }
      
      if (nextNodeId) {
        await storage.updateFlowUserState(userState.id, { currentNodeId: nextNodeId });
      } else {
        console.log(`[FlowEngine] Fim do fluxo para ${userState.contactJid}.`);
        await storage.deleteFlowUserState(userState.id);
      }

    } catch (error) {
      console.error(`[FlowEngine] Erro ao executar nó ${node.id} para ${userState.contactJid}:`, error);
      await storage.deleteFlowUserState(userState.id); // Limpa o estado em caso de erro para evitar loops
    }
  }
}
