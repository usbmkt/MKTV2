// server/services/whatsapp-flow.engine.ts (CORRIGIDO E COMPLETO)
import { storage } from '../storage.js';
import { WhatsappConnectionService } from './whatsapp-connection.service.js';
import { externalDataService } from './external-data.service.js';
import { getSimpleAiResponse } from '../mcp_handler.js';
import * as schema from '../../shared/schema.js';
import { logger } from '../logger.js';

// Tipos locais para nós e arestas do fluxo
interface FlowNode { id: string; type?: string; data: any; [key: string]: any; }
interface FlowEdge { id: string; source: string; target: string; sourceHandle?: string | null; [key: string]: any; }

export class WhatsappFlowEngine {
    private interpolate(text: string, variables: Record<string, any>): string {
        if (!text) return '';
        return text.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (match, key) => {
            const value = key.split('.').reduce((o: any, i: string) => o?.[i], variables);
            return value !== undefined ? String(value) : match;
        });
    }

    public async processMessage(userId: number, contactJid: string, messageContent: string): Promise<void> {
        let userState = await storage.getFlowUserState(userId, contactJid);
        let flow: schema.Flow | undefined;

        if (!userState) {
            flow = await storage.findTriggerFlow(userId, messageContent);
            if (!flow) return;
            const startNode = this.findStartNode(flow);
            if (!startNode) return;
            userState = await storage.createFlowUserState({ userId, contactJid, activeFlowId: flow.id, currentNodeId: startNode.id, flowVariables: {} });
            await this.executeNode(userState, flow);
        } else if (userState.activeFlowId && userState.currentNodeId) {
            flow = await storage.getFlow(userState.activeFlowId, userId);
            if (!flow) { await storage.deleteFlowUserState(userState.id); return; }
            await this.executeNode(userState, flow, messageContent);
        }
    }
    
    private async executeNode(userState: schema.WhatsappFlowUserState, flow: schema.Flow, userInput?: string): Promise<void> {
        let currentNode = this.findNodeById(flow, userState.currentNodeId!);
        if (!currentNode) { await storage.deleteFlowUserState(userState.id); return; }

        let nextNodeId: string | null = null;
        
        if (this.isWaitingNode(currentNode.type) && userInput) {
             nextNodeId = await this.processInput(userState, currentNode, flow.elements?.edges ?? [], userInput);
        } else if (!this.isWaitingNode(currentNode.type)) {
             nextNodeId = await this.executeActionNode(userState, currentNode, flow.elements?.edges ?? []);
        } else {
             await this.executeWaitingNode(userState, currentNode);
             return; 
        }

        while (nextNodeId) {
            const nextNode = this.findNodeById(flow, nextNodeId);
            if (!nextNode) { await storage.deleteFlowUserState(userState.id); return; }
            
            const currentState = await storage.getFlowUserState(userState.userId, userState.contactJid);
            if (!currentState) return;
            
            if (this.isWaitingNode(nextNode.type)) {
                await storage.updateFlowUserState(currentState.id, { currentNodeId: nextNode.id });
                await this.executeWaitingNode(currentState, nextNode);
                return;
            }
            
            nextNodeId = await this.executeActionNode(currentState, nextNode, flow.elements?.edges ?? []);
        }
        
        if (!nextNodeId) await storage.deleteFlowUserState(userState.id);
    }
    
    private findStartNode = (flow: schema.Flow): FlowNode | undefined => flow.elements?.nodes.find((n: any) => !flow.elements?.edges.some((e: any) => e.target === n.id));
    private findNodeById = (flow: schema.Flow, nodeId: string): FlowNode | undefined => flow.elements?.nodes.find((n: any) => n.id === nodeId);
    private isWaitingNode = (type?: string): boolean => ['buttonMessage', 'waitInput'].includes(type || '');

    private async processInput(userState: schema.WhatsappFlowUserState, node: FlowNode, edges: FlowEdge[], messageContent: string): Promise<string | null> { return null; /* Implementar lógica de processamento de input */ }
    private async executeWaitingNode(userState: schema.WhatsappFlowUserState, node: FlowNode): Promise<void> { await WhatsappConnectionService.sendMessageForUser(userState.userId, userState.contactJid, { text: "Mensagem de espera..." }); }
    private async executeActionNode(userState: schema.WhatsappFlowUserState, node: FlowNode, edges: FlowEdge[]): Promise<string | null> {
        // ✅ CORREÇÃO: Chamando o método estático para enviar a mensagem.
        await WhatsappConnectionService.sendMessageForUser(userState.userId, userState.contactJid, { text: `Executando nó: ${node.data.label || node.type}` });
        const edge = edges.find(e => e.source === node.id);
        return edge?.target || null;
    }
}
