// server/mcp_handler.ts
import { storage } from "./storage";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GEMINI_API_KEY } from './config';
import { InsertCampaign, ChatMessage, ChatSession, User, Campaign } from "../shared/schema";
import { ZodError } from "zod";


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

interface MCPContext {
  lastCreatedCampaignId?: number | null;
  lastMentionedCampaignId?: number | null; // Para quando o usuário consulta detalhes
  // Outros estados de conversa podem ser adicionados aqui
}

interface MCPResponsePayload {
  reply: string;
  sessionId: number;
  action?: string;
  payload?: any;
  mcpContextForNextTurn?: MCPContext | null; // Contexto para ser armazenado no cliente
}

async function getCampaignNameFromMessage(message: string): Promise<string | null> {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const promptForName = `O usuário disse: "${message}". Qual é o NOME da campanha que ele quer criar? Responda APENAS com o nome da campanha. Se não conseguir identificar um nome claro, responda "NOME_NAO_IDENTIFICADO".`;
    const result = await model.generateContent(promptForName);
    const campaignName = result.response.text().trim();
    if (campaignName && campaignName !== "NOME_NAO_IDENTIFICADO" && campaignName.length > 0 && campaignName.length < 256) { // Limitar tamanho do nome
      return campaignName;
    }
    return null;
  } catch (error) {
    console.error("[MCP_HANDLER_GEMINI] Erro ao extrair nome da campanha:", error);
    return null;
  }
}

async function getCampaignIdFromMessage(message: string): Promise<string | null> {
  if (!genAI) return null;
  // Tentativa de Regex simples primeiro para IDs numéricos diretos
  const idRegex = /(?:id|ID|número|numero)\s*[:=\s]*#?(\d+)/i;
  const match = message.match(idRegex);
  if (match && match[1]) {
    return match[1];
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const promptForId = `O usuário disse: "${message}". Ele mencionou um ID ou NÚMERO de campanha? Se sim, responda APENAS com o número do ID. Se não, responda "ID_NAO_IDENTIFICADO".`;
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

function formatCampaignDetailsForChat(campaign: Campaign): string {
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
  attachmentUrl?: string | null,
  mcpContextFromClient?: MCPContext | null // Contexto recebido do cliente
): Promise<MCPResponsePayload> {
  console.log(`[MCP_HANDLER] User ${userId} disse: "${message || '[Anexo]'}" (Session: ${currentSessionId || 'Nova'}, Contexto Cliente: ${JSON.stringify(mcpContextFromClient)})`);

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
  let nextTurnContext: MCPContext | null = null; // Contexto a ser enviado de volta para o cliente

  if (genAI && message) {
    const intentModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    const contextHint = mcpContextFromClient?.lastCreatedCampaignId 
        ? `Contexto: A última campanha criada/mencionada foi ID ${mcpContextFromClient.lastCreatedCampaignId}.` 
        : mcpContextFromClient?.lastMentionedCampaignId
        ? `Contexto: A última campanha visualizada/mencionada foi ID ${mcpContextFromClient.lastMentionedCampaignId}.`
        : 'Contexto: Nenhum item específico em foco recente.';

    const promptForIntent = `Considerando o seguinte:
    Usuário disse: "${message}"
    ${contextHint}
    Qual a intenção principal? Responda APENAS com um dos seguintes códigos:
    - Rota de navegação geral (ex: /dashboard, /campaigns)
    - "navigate_to_campaign_detail_from_context" (se o usuário disser "me leve até lá", "abra ela", "veja essa campanha" E o contexto indicar um ID de campanha relevante)
    - "navigate_to_campaign_detail_by_identifier" (se o usuário pedir detalhes de uma campanha específica por nome ou ID na mensagem ATUAL)
    - "create_campaign"
    - "NÃO" (para outros casos, incluindo perguntas genéricas)

    Exemplos:
    - (Contexto: Campanha ID 4 criada) Usuário disse: "me leve ate la" -> navigate_to_campaign_detail_from_context
    - (Contexto: Campanha ID 5 visualizada) Usuário disse: "abra ela" -> navigate_to_campaign_detail_from_context
    - (Contexto: Nenhum) Usuário disse: "me leve ate la" -> NÃO
    - "Ver detalhes da campanha 5" -> navigate_to_campaign_detail_by_identifier
    - "Mostrar informações da campanha Marketing de Verão" -> navigate_to_campaign_detail_by_identifier
    - "Nova campanha Super Vendas" -> create_campaign
    - "Ir para criativos" -> /creatives
    `;

    const intentResult = await intentModel.generateContent(promptForIntent);
    const intentResponse = intentResult.response.text().trim();
    const validRoutes = [
      "/dashboard", "/campaigns", "/creatives", "/budget", "/landingpages",
      "/whatsapp", "/copy", "/funnel", "/metrics", "/alerts", "/export", "/integrations"
    ];

    if (validRoutes.includes(intentResponse)) {
      agentReplyText = `Claro! Navegando para ${intentResponse.replace('/', '') || 'o Dashboard'}...`;
      responsePayload.action = "navigate";
      responsePayload.payload = intentResponse;
      nextTurnContext = null; // Limpa contexto após navegação geral
    } else if (intentResponse === 'create_campaign') {
      const campaignName = await getCampaignNameFromMessage(message);
      if (campaignName) {
        try {
          const newCampaignData: InsertCampaign = { userId, name: campaignName, status: 'draft', platforms: [], objectives: [] };
          const createdCampaign = await storage.createCampaign(newCampaignData);
          agentReplyText = `Campanha "${createdCampaign.name}" (ID: ${createdCampaign.id}) criada com sucesso como rascunho!`;
          const campaignDetailsMessage = formatCampaignDetailsForChat(createdCampaign);
          await storage.addChatMessage({ sessionId: activeSession.id, sender: 'agent', text: agentReplyText });
          agentReplyText += `\n\n${campaignDetailsMessage}`;
          nextTurnContext = { lastCreatedCampaignId: createdCampaign.id, lastMentionedCampaignId: createdCampaign.id };
        } catch (creationError: any) {
          agentReplyText = `Houve um problema ao tentar criar a campanha "${campaignName}". Detalhes: ${creationError.message || 'Erro desconhecido.'}`;
          if (creationError instanceof ZodError) {
             agentReplyText += ` Detalhes: ${creationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
          }
          nextTurnContext = null;
        }
      } else {
        agentReplyText = "Entendi que você quer criar uma nova campanha, mas não consegui identificar o nome. Poderia me dizer qual nome você gostaria de dar para a nova campanha?";
        // Poderia setar um contexto para esperar o nome: nextTurnContext = { awaiting: 'campaign_name_for_creation' };
        nextTurnContext = null; // Por ora, simplificamos.
      }
    } else if (intentResponse === 'navigate_to_campaign_detail_by_identifier') {
      const campaignIdStr = await getCampaignIdFromMessage(message);
      if (campaignIdStr) {
        const campaignIdNum = parseInt(campaignIdStr);
        const campaign = await storage.getCampaign(campaignIdNum, userId);
        if (campaign) {
          agentReplyText = `Ok, mostrando detalhes da campanha "${campaign.name}" (ID: ${campaign.id})...`;
          responsePayload.action = "navigate";
          responsePayload.payload = `/campaigns/${campaign.id}`;
          const campaignDetailsMessage = formatCampaignDetailsForChat(campaign);
          await storage.addChatMessage({ sessionId: activeSession.id, sender: 'agent', text: agentReplyText });
          agentReplyText += `\n\n${campaignDetailsMessage}`;
          nextTurnContext = { lastMentionedCampaignId: campaign.id };
        } else {
          agentReplyText = `Não encontrei uma campanha com o ID "${campaignIdStr}" associada a você.`;
          nextTurnContext = null;
        }
      } else {
        agentReplyText = "Não consegui identificar o ID da campanha na sua mensagem. Por favor, forneça o ID numérico da campanha que você gostaria de ver.";
        nextTurnContext = null;
      }
    } else if (intentResponse === 'navigate_to_campaign_detail_from_context') {
      const campaignIdToNavigate = mcpContextFromClient?.lastCreatedCampaignId || mcpContextFromClient?.lastMentionedCampaignId;
      if (campaignIdToNavigate) {
        const campaign = await storage.getCampaign(campaignIdToNavigate, userId);
        if(campaign) {
            agentReplyText = `Entendido! Navegando para a campanha "${campaign.name}" (ID: ${campaignIdToNavigate})...`;
            responsePayload.action = "navigate";
            responsePayload.payload = `/campaigns/${campaignIdToNavigate}`;
            nextTurnContext = { lastMentionedCampaignId: campaignIdToNavigate }; // Mantém como lastMentioned
        } else {
            agentReplyText = `Hmm, eu tinha um ID de campanha (${campaignIdToNavigate}) em mente, mas não consigo encontrá-la agora. Poderia especificar novamente?`;
            nextTurnContext = null; // Limpa contexto se não encontrar
        }
      } else {
        agentReplyText = "Desculpe, não entendi a qual campanha 'lá' você se refere. Poderia especificar o nome ou ID?";
        nextTurnContext = null;
      }
    } else { // NÃO ou outra resposta não tratada -> Resposta geral da IA
      console.log(`[MCP_HANDLER] Intenção não reconhecida ou "NÃO" ("${intentResponse}"). Usando IA geral.`);
      nextTurnContext = null; // Limpa contexto para respostas gerais
      const model = genAI!.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const messagesFromDb: ChatMessage[] = await storage.getChatMessages(activeSession.id, userId);
      const historyForGemini = messagesFromDb.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
      const systemPrompt = { role: "user", parts: [{ text: "Você é o Agente MCP. Responda em Português do Brasil, de forma concisa e amigável, ajudando com marketing digital e a plataforma." }] };
      const chat = model.startChat({
        history: [systemPrompt, ...historyForGemini.slice(0, -1)],
         safetySettings: [ /* ... */ ],
      });
      const result = await chat.sendMessage(message);
      agentReplyText = result.response.text();
    }
  } else {
    agentReplyText = `Recebido: "${message || 'Anexo'}". ${!genAI ? 'O serviço de IA não está configurado.' : 'Por favor, envie uma mensagem de texto para interagir.'}`;
    nextTurnContext = null;
  }

  await storage.addChatMessage({
    sessionId: activeSession.id,
    sender: 'agent',
    text: agentReplyText,
  });

  responsePayload.reply = agentReplyText;
  responsePayload.mcpContextForNextTurn = nextTurnContext;
  return responsePayload as MCPResponsePayload;
}
