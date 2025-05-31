// server/mcp_handler.ts
import { storage } from "./storage";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GEMINI_API_KEY } from './config';
import { InsertCampaign, ChatMessage, ChatSession, User, Campaign } from "../shared/schema";

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("[MCP_HANDLER_GEMINI] SDK do Gemini inicializado com sucesso.");
  } catch (error) {
    console.error("[MCP_HANDLER_GEMINI] Falha ao inicializar o SDK do Gemini:", error);
    genAI = null;
  }
} else {
  console.warn("[MCP_HANDLER_GEMINI] Chave da API do Gemini (GEMINI_API_KEY) não configurada.");
}

interface MCPResponsePayload {
  reply: string;
  sessionId: number;
  action?: string;
  payload?: any;
  // Poderíamos adicionar um campo para contexto da conversa se quisermos reter informações entre chamadas
  // mcpContext?: Record<string, any>; 
}

async function getCampaignNameFromMessage(message: string): Promise<string | null> {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const promptForName = `O usuário disse: "${message}". Qual é o NOME da campanha que ele quer criar? Responda APENAS com o nome da campanha. Se não conseguir identificar um nome claro, responda "NOME_NAO_IDENTIFICADO".`;
    const result = await model.generateContent(promptForName);
    const campaignName = result.response.text().trim();
    if (campaignName && campaignName !== "NOME_NAO_IDENTIFICADO" && campaignName.length > 0) {
      return campaignName;
    }
    return null;
  } catch (error) {
    console.error("[MCP_HANDLER_GEMINI] Erro ao extrair nome da campanha:", error);
    return null;
  }
}

// COORDENADA 2: Função para extrair ID da campanha da mensagem
async function getCampaignIdFromMessage(message: string): Promise<string | null> {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    // Tentativa de Regex simples primeiro para IDs numéricos diretos
    const idRegex = /(?:id|ID|número)\s*[:=\s]*#?(\d+)/i;
    const match = message.match(idRegex);
    if (match && match[1]) {
      return match[1];
    }

    // Se não encontrar por regex, tenta com Gemini
    const promptForId = `O usuário disse: "${message}". Ele mencionou um ID ou número de campanha? Se sim, responda APENAS com o número do ID. Se não, responda "ID_NAO_IDENTIFICADO".`;
    const result = await model.generateContent(promptForId);
    const campaignIdStr = result.response.text().trim();
    if (campaignIdStr && campaignIdStr !== "ID_NAO_IDENTIFICADO" && /^\d+$/.test(campaignIdStr)) {
      return campaignIdStr;
    }
    return null;
  } catch (error) {
    console.error("[MCP_HANDLER_GEMINI] Erro ao extrair ID da campanha:", error);
    return null;
  }
}


function formatCampaignDetailsForChat(campaign: Campaign): string { // Alterado para aceitar Campaign
  let details = `Detalhes da Campanha:
  - ID: ${campaign.id}
  - Nome: ${campaign.name}
  - Status: ${campaign.status}`;
  if (campaign.description) details += `\n  - Descrição: ${campaign.description}`;
  if (campaign.budget) details += `\n  - Orçamento: ${campaign.budget}`;
  if (campaign.platforms && campaign.platforms.length > 0) details += `\n  - Plataformas: ${campaign.platforms.join(', ')}`;
  return details;
}


export async function handleMCPConversation(
  userId: number,
  message: string,
  currentSessionId: number | null | undefined,
  attachmentUrl?: string | null
  // mcpPrevContext?: Record<string, any> // Contexto da conversa anterior, se quisermos persistir
): Promise<MCPResponsePayload> {
  console.log(`[MCP_HANDLER] User ${userId} disse: "${message || '[Anexo]'}" (Session: ${currentSessionId || 'Nova'})`);

  let activeSession: ChatSession | undefined;
  if (currentSessionId) {
    activeSession = await storage.getChatSession(currentSessionId, userId);
  }

  if (!activeSession) {
    const newSessionTitle = message ? `Conversa sobre "${message.substring(0, 20)}..."` : `Nova Conversa ${new Date().toLocaleDateString('pt-BR')}`;
    activeSession = await storage.createChatSession(userId, newSessionTitle);
  }

  await storage.addChatMessage({
    sessionId: activeSession.id,
    sender: 'user',
    text: message || (attachmentUrl ? `Anexo: ${attachmentUrl}` : 'Mensagem vazia.'),
    attachmentUrl: attachmentUrl || null,
  });

  let agentReplyText: string;
  const responsePayload: Partial<MCPResponsePayload> = { sessionId: activeSession.id };
  // let newMcpContext = { ...mcpPrevContext }; // Para gerenciar contexto entre turnos

  if (genAI && message) {
    const intentModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    // COORDENADA 1: Prompt de intenção atualizado
    const promptForIntent = `O usuário perguntou: "${message}".
    Ele está pedindo para NAVEGAR para alguma seção da plataforma, para DETALHES de um item específico (como campanha por ID), OU para EXECUTAR ALGUMA AÇÃO como CRIAR algo?
    Responda com um dos seguintes códigos de intenção:
    - Rota de navegação geral (ex: /dashboard, /campaigns, /creatives)
    - "navigate_to_campaign_detail" (se pedir para ver detalhes de uma campanha específica por nome ou ID)
    - "create_campaign" (se for sobre criar campanha)
    - "NÃO" (se não for nenhuma das anteriores).
    Exemplos:
    - "Me leve para campanhas" -> /campaigns
    - "Criar uma campanha chamada Fim de Ano" -> create_campaign
    - "Quero ver os detalhes da campanha com ID 123" -> navigate_to_campaign_detail
    - "Mostrar informações da campanha Marketing de Verão" -> navigate_to_campaign_detail
    - "me leve ate la" OU "navegue ate la" -> NÃO (a menos que o contexto anterior seja claro, por enquanto trate como NÃO)
    `;

    const intentResult = await intentModel.generateContent(promptForIntent);
    const intentResponse = intentResult.response.text().trim();
    const validRoutes = [
      "/dashboard", "/campaigns", "/creatives", "/budget", "/landingpages",
      "/whatsapp", "/copy", "/funnel", "/metrics", "/alerts", "/export", "/integrations"
    ];

    if (validRoutes.includes(intentResponse)) {
      console.log(`[MCP_HANDLER] Intenção de navegação GERAL detectada: ${intentResponse}`);
      agentReplyText = `Claro! Navegando para ${intentResponse.replace('/', '') || 'o Dashboard'}...`;
      responsePayload.action = "navigate";
      responsePayload.payload = intentResponse;
    } else if (intentResponse === 'create_campaign') {
      console.log(`[MCP_HANDLER] Intenção de CRIAR CAMPANHA detectada.`);
      const campaignName = await getCampaignNameFromMessage(message);
      if (campaignName) {
        try {
          const newCampaignData: InsertCampaign = {
            userId: userId, name: campaignName, status: 'draft', platforms: [], objectives: [],
          };
          const createdCampaign = await storage.createCampaign(newCampaignData);
          // delete newMcpContext?.lastAction; // Limpa contexto após ação
          // newMcpContext = { ...newMcpContext, lastCreatedCampaignId: createdCampaign.id };
          agentReplyText = `Campanha "${createdCampaign.name}" (ID: ${createdCampaign.id}) criada com sucesso como rascunho!`;
          const campaignDetailsMessage = formatCampaignDetailsForChat(createdCampaign);
          await storage.addChatMessage({ sessionId: activeSession.id, sender: 'agent', text: agentReplyText });
          agentReplyText += `\n\n${campaignDetailsMessage}`;
        } catch (creationError: any) {
          agentReplyText = `Houve um problema ao tentar criar a campanha "${campaignName}". Detalhes: ${creationError.message || 'Erro desconhecido.'}`;
        }
      } else {
        agentReplyText = "Entendi que você quer criar uma nova campanha, mas não consegui identificar o nome. Poderia me dizer qual nome você gostaria de dar para a nova campanha?";
        // newMcpContext = { ...newMcpContext, lastAction: 'prompt_campaign_name_for_creation' };
      }
    } else if (intentResponse === 'navigate_to_campaign_detail') { // COORDENADA 3: Lógica para navigate_to_campaign_detail
      console.log(`[MCP_HANDLER] Intenção de NAVEGAR PARA DETALHES DA CAMPANHA detectada.`);
      const campaignIdStr = await getCampaignIdFromMessage(message);
      if (campaignIdStr) {
        const campaignIdNum = parseInt(campaignIdStr);
        const campaign = await storage.getCampaign(campaignIdNum, userId);
        if (campaign) {
          agentReplyText = `Ok, mostrando detalhes da campanha "${campaign.name}" (ID: ${campaign.id})...`;
          responsePayload.action = "navigate";
          responsePayload.payload = `/campaigns/${campaign.id}`; // Assumindo que essa rota existirá no frontend
          
                          // Adicionar detalhes da campanha na resposta do chat também
          const campaignDetailsMessage = formatCampaignDetailsForChat(campaign);
          await storage.addChatMessage({ sessionId: activeSession.id, sender: 'agent', text: agentReplyText });
          agentReplyText += `\n\n${campaignDetailsMessage}`;

        } else {
          agentReplyText = `Não encontrei uma campanha com o ID "${campaignIdStr}" associada a você.`;
        }
      } else {
        // Se não conseguiu ID, poderia tentar extrair nome e buscar, mas por agora pede ID.
        agentReplyText = "Não consegui identificar o ID da campanha. Por favor, forneça o ID numérico da campanha que você gostaria de ver.";
        // newMcpContext = { ...newMcpContext, lastAction: 'prompt_campaign_id_for_navigation' };
      }
    } else { // Resposta geral da IA
      console.log(`[MCP_HANDLER] Nenhuma ação específica ou rota detectada ("${intentResponse}"). Usando IA geral.`);
      // delete newMcpContext?.lastAction; 
      const model = genAI!.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const messagesFromDb: ChatMessage[] = await storage.getChatMessages(activeSession.id, userId);
      const historyForGemini = messagesFromDb.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
      const systemPrompt = { role: "user", parts: [{ text: "Você é o Agente MCP. Responda em Português do Brasil, de forma concisa e amigável." }] };
      const chat = model.startChat({
        history: [systemPrompt, ...historyForGemini.slice(0, -1)],
         safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            // ...outras configurações de segurança
          ],
      });
      const result = await chat.sendMessage(message);
      agentReplyText = result.response.text();
    }
  } else { // Sem Gemini ou sem mensagem de texto
    agentReplyText = `Recebido: "${message || 'Anexo'}". ${!genAI ? 'O serviço de IA não está configurado.' : 'Por favor, envie uma mensagem de texto para interagir com as funcionalidades avançadas.'}`;
    // delete newMcpContext?.lastAction;
  }

  // Salva a resposta final do agente
  // Se a resposta já foi parcialmente salva (ex: confirmação + detalhes), esta mensagem pode ser apenas a parte final ou a mensagem inteira.
  // A lógica de formatCampaignDetailsForChat e como ela é adicionada a agentReplyText garante que os detalhes sejam incluídos.
  await storage.addChatMessage({
    sessionId: activeSession.id,
    sender: 'agent',
    text: agentReplyText,
  });

  responsePayload.reply = agentReplyText;
  // responsePayload.mcpContext = newMcpContext; // Se estivéssemos retornando contexto para o cliente
  return responsePayload as MCPResponsePayload;
}
