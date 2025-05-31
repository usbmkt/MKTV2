// server/mcp_handler.ts
import { storage } from "./storage";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GEMINI_API_KEY } from './config';
import { InsertCampaign, ChatMessage, ChatSession, User, Campaign } from "../shared/schema";
import { ZodError } from "zod";


let genAI: GoogleGenerativeAI | null = null;
// COORDENADA 1: Inicialização do Gemini SDK com try-catch
try {
  if (GEMINI_API_KEY && GEMINI_API_KEY !== "SUA_CHAVE_API_GEMINI_AQUI" && GEMINI_API_KEY.length > 10) { // Checagem básica da chave
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("[MCP_HANDLER_GEMINI] SDK do Gemini inicializado com sucesso.");
  } else {
    console.warn("[MCP_HANDLER_GEMINI] Chave da API do Gemini (GEMINI_API_KEY) não configurada ou é placeholder. MCP terá funcionalidade de IA limitada.");
    genAI = null;
  }
} catch (error) {
  console.error("[MCP_HANDLER_GEMINI] Falha CRÍTICA ao inicializar o SDK do Gemini:", error);
  genAI = null; // Garante que genAI é null e o restante do módulo pode carregar
}


interface MCPContext {
  lastCreatedCampaignId?: number | null;
  lastMentionedCampaignId?: number | null;
}

interface MCPResponsePayload {
  reply: string;
  sessionId: number;
  action?: string;
  payload?: any;
  mcpContextForNextTurn?: MCPContext | null;
}

async function getCampaignNameFromMessage(message: string): Promise<string | null> {
  if (!genAI) {
    console.warn("[MCP_HANDLER_GEMINI] Tentativa de extrair nome da campanha sem SDK do Gemini inicializado.");
    // Fallback simples se Gemini não estiver disponível
    const match = message.match(/(?:campanha|campaign)\s+(?:chamada\s+|intitulada\s+)?(?:de\s+|como\s+)?['"]?([^'"\n\r]+?)['"]?(?:\s+com|$)/i);
    return match && match[1] ? match[1].trim() : null;
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const promptForName = `O usuário disse: "${message}". Qual é o NOME da campanha que ele quer criar? Responda APENAS com o nome da campanha. Se não conseguir identificar um nome claro, responda "NOME_NAO_IDENTIFICADO".`;
    const result = await model.generateContent(promptForName);
    const campaignName = result.response.text().trim();
    if (campaignName && campaignName !== "NOME_NAO_IDENTIFICADO" && campaignName.length > 0 && campaignName.length < 256) {
      return campaignName;
    }
    return null;
  } catch (error) {
    console.error("[MCP_HANDLER_GEMINI] Erro ao extrair nome da campanha:", error);
    return null;
  }
}

async function getCampaignIdFromMessage(message: string): Promise<string | null> {
  const idRegex = /(?:id|ID|número|numero)\s*[:=\s]*#?(\d+)/i;
  const regexMatch = message.match(idRegex);
  if (regexMatch && regexMatch[1]) {
    return regexMatch[1];
  }
  if (!genAI) {
    console.warn("[MCP_HANDLER_GEMINI] Tentativa de extrair ID da campanha sem SDK do Gemini inicializado.");
    return null;
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
  mcpContextFromClient?: MCPContext | null
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
  let nextTurnContext: MCPContext | null = null;

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
      nextTurnContext = null; 
    } else if (intentResponse === 'create_campaign') {
      const campaignName = await getCampaignNameFromMessage(message);
      if (campaignName) {
        try {
          const newCampaignData: InsertCampaign = { userId, name: campaignName, status: 'draft', platforms: [], objectives: [] };
          const createdCampaign = await storage.createCampaign(newCampaignData);
          agentReplyText = `Campanha "${createdCampaign.name}" (ID: ${createdCampaign.id}) criada com sucesso como rascunho!`;
          const campaignDetailsMessage = formatCampaignDetailsForChat(createdCampaign);
          await storage.addChatMessage({ sessionId: activeSession.id, sender: 'agent', text: agentReplyText }); // Salva a confirmação
          agentReplyText += `\n\n${campaignDetailsMessage}`; // Adiciona detalhes para a resposta final ao usuário
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
        nextTurnContext = null;
      }
    } else if (intentResponse === 'navigate_to_campaign_detail_by_identifier') {
      const campaignIdStr = await getCampaignIdFromMessage(message);
      if (campaignIdStr) {
        const campaignIdNum = parseInt(campaignIdStr);
        const campaign = await storage.getCampaign(campaignIdNum, userId);
        if (campaign) {
          agentReplyText = `Ok, aqui estão os detalhes da campanha "${campaign.name}" (ID: ${campaign.id}):`;
          const campaignDetailsMessage = formatCampaignDetailsForChat(campaign);
          // Não salvar a primeira parte "Ok, mostrando..." no histórico, apenas os detalhes
          // A resposta final ao usuário terá ambas.
          await storage.addChatMessage({ sessionId: activeSession.id, sender: 'agent', text: campaignDetailsMessage }); // Salva só os detalhes
          agentReplyText = `Ok, mostrando detalhes da campanha "${campaign.name}" (ID: ${campaign.id})...\n\n${campaignDetailsMessage}`;

          responsePayload.action = "navigate"; // A navegação ainda é desejada
          responsePayload.payload = `/campaigns/${campaign.id}`;
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
            // Opcional: mostrar detalhes no chat também
            const campaignDetailsMessage = formatCampaignDetailsForChat(campaign);
            await storage.addChatMessage({ sessionId: activeSession.id, sender: 'agent', text: agentReplyText });
            agentReplyText += `\n\n${campaignDetailsMessage}`;
            nextTurnContext = { lastMentionedCampaignId: campaignIdToNavigate };
        } else {
            agentReplyText = `Hmm, eu tinha um ID de campanha (${campaignIdToNavigate}) em mente, mas não consigo encontrá-la agora. Poderia especificar novamente?`;
            nextTurnContext = null; 
        }
      } else {
        agentReplyText = "Desculpe, não entendi a qual campanha 'lá' você se refere. Poderia especificar o nome ou ID?";
        nextTurnContext = null;
      }
    } else { 
      console.log(`[MCP_HANDLER] Intenção não reconhecida ou "NÃO" ("${intentResponse}"). Usando IA geral.`);
      nextTurnContext = null; 
      const model = genAI!.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const messagesFromDb: ChatMessage[] = await storage.getChatMessages(activeSession.id, userId);
      const historyForGemini = messagesFromDb.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
      const systemPrompt = { role: "user", parts: [{ text: "Você é o Agente MCP. Responda em Português do Brasil, de forma concisa e amigável, ajudando com marketing digital e a plataforma." }] };
      const chat = model.startChat({
        history: [systemPrompt, ...historyForGemini.slice(0, -1)], // Exclui a última mensagem do usuário
         safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          ],
      });
      const result = await chat.sendMessage(message);
      agentReplyText = result.response.text();
    }
  } else {
    agentReplyText = `Recebido: "${message || 'Anexo'}". ${!genAI ? 'O serviço de IA não está configurado corretamente.' : 'Por favor, envie uma mensagem de texto para interagir.'}`;
    nextTurnContext = null;
  }

  // Salva a resposta final do agente no histórico do chat
  // A lógica acima já cuida de salvar respostas parciais se necessário (como confirmação de criação + detalhes).
  // Esta chamada garante que a ÚLTIMA `agentReplyText` (que pode ser a geral ou a composta) seja salva.
  // Se a mesma mensagem já foi salva por uma etapa anterior (ex: ao mostrar detalhes de campanha),
  // esta chamada pode ser redundante ou sobrescrever. É preciso cuidado aqui.
  // Para evitar duplicidade, só salvamos se a mensagem não foi a composta de detalhes.
  if (!(agentReplyText.includes("Detalhes da Campanha:") && agentReplyText.startsWith("Campanha") && agentReplyText.includes("criada com sucesso"))) {
      if(!(agentReplyText.includes("Detalhes da Campanha:") && agentReplyText.startsWith("Ok, mostrando detalhes"))) {
         await storage.addChatMessage({
            sessionId: activeSession.id,
            sender: 'agent',
            text: agentReplyText,
        });
      }
  }


  responsePayload.reply = agentReplyText;
  responsePayload.mcpContextForNextTurn = nextTurnContext;
  return responsePayload as MCPResponsePayload;
}
