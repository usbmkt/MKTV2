// server/mcp_handler.ts
import { storage } from "./storage";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GEMINI_API_KEY } from './config';
import { InsertCampaign, ChatMessage, ChatSession } from "../shared/schema";

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

function formatCampaignDetailsForChat(campaign: NonNullable<Awaited<ReturnType<typeof storage.createCampaign>>>): string {
  let details = `Detalhes da Campanha Criada:
  - ID: ${campaign.id}
  - Nome: ${campaign.name}
  - Status: ${campaign.status}`;
  if (campaign.description) details += `\n  - Descrição: ${campaign.description}`;
  // Verifica se o campo existe e não é nulo/undefined antes de adicionar
  if (campaign.budget !== null && campaign.budget !== undefined) {
    details += `\n  - Orçamento: ${campaign.budget}`;
  }
  if (campaign.dailyBudget !== null && campaign.dailyBudget !== undefined) {
    details += `\n  - Orçamento Diário: ${campaign.dailyBudget}`;
  }
  if (campaign.avgTicket !== null && campaign.avgTicket !== undefined) {
    details += `\n  - Ticket Médio: ${campaign.avgTicket}`;
  }
  if (campaign.startDate) {
    details += `\n  - Data de Início: ${new Date(campaign.startDate).toLocaleDateString('pt-BR')}`;
  }
  if (campaign.endDate) {
    details += `\n  - Data de Fim: ${new Date(campaign.endDate).toLocaleDateString('pt-BR')}`;
  }
  return details;
}


export async function handleMCPConversation(
  userId: number,
  message: string,
  currentSessionId: number | null | undefined,
  attachmentUrl?: string | null
): Promise<MCPResponsePayload> {
  console.log(`[MCP_HANDLER] User ${userId} disse: "${message || '[Anexo]'}" (Session: ${currentSessionId || 'Nova'})`);

  let activeSession: ChatSession; // Garantido que activeSession será definida
  if (currentSessionId) {
    const existingSession = await storage.getChatSession(currentSessionId, userId);
    if (existingSession) {
      activeSession = existingSession;
    } else {
      // Se o ID da sessão foi fornecido mas não encontrado, cria uma nova.
      const newSessionTitle = message ? `Conversa sobre "${message.substring(0, 20)}..." (ID antigo: ${currentSessionId})` : `Nova Conversa (ID antigo: ${currentSessionId}) ${new Date().toLocaleDateString('pt-BR')}`;
      console.warn(`[MCP_HANDLER] Sessão ${currentSessionId} não encontrada para usuário ${userId}. Criando nova sessão.`);
      activeSession = await storage.createChatSession(userId, newSessionTitle);
    }
  } else {
    const newSessionTitle = message ? `Conversa sobre "${message.substring(0, 20)}..."` : `Nova Conversa ${new Date().toLocaleDateString('pt-BR')}`;
    console.log(`[MCP_HANDLER] Criando nova sessão de chat para o usuário ${userId} com título: ${newSessionTitle}`);
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
  let messageAlreadySavedBySpecialFlow = false; // Flag para controle

  if (genAI && message) {
    const intentModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const promptForIntent = `O usuário perguntou: "${message}".
    Ele está pedindo para NAVEGAR para alguma seção da plataforma OU para EXECUTAR ALGUMA AÇÃO como CRIAR algo?
    Se for NAVEGAÇÃO, responda com a rota (ex: /dashboard, /campaigns).
    Se for AÇÃO DE CRIAÇÃO DE CAMPANHA, responda com "create_campaign".
    Outras ações (responda com o código da ação):
      - "ver metricas da campanha X" -> get_campaign_metrics
    Se não for navegação nem uma ação reconhecida, responda "NÃO".
    Exemplos:
    - "Me leve para campanhas" -> /campaigns
    - "Criar uma campanha chamada Fim de Ano" -> create_campaign
    - "Quero criar a campanha Oferta Especial" -> create_campaign
    `;

    const intentResult = await intentModel.generateContent(promptForIntent);
    const intentResponse = intentResult.response.text().trim();
    const validRoutes = [
      "/dashboard", "/campaigns", "/creatives", "/budget", "/landingpages",
      "/whatsapp", "/copy", "/funnel", "/metrics", "/alerts", "/export", "/integrations"
    ];

    if (validRoutes.includes(intentResponse)) {
      console.log(`[MCP_HANDLER] Intenção de navegação detectada: ${intentResponse}`);
      agentReplyText = `Claro! Te levarei para ${intentResponse.replace('/', '') || 'o Dashboard'}...`;
      responsePayload.action = "navigate";
      responsePayload.payload = intentResponse;
    } else if (intentResponse === 'create_campaign') {
      console.log(`[MCP_HANDLER] Intenção de criar campanha detectada.`);
      const campaignName = await getCampaignNameFromMessage(message);

      if (campaignName) {
        try {
          const newCampaignData: InsertCampaign = {
            userId: userId,
            name: campaignName,
            status: 'draft',
            platforms: [],
            objectives: [],
          };
          const createdCampaign = await storage.createCampaign(newCampaignData);
          
          // Mensagem simples de sucesso para o log
          const simpleSuccessMessage = `Campanha "${createdCampaign.name}" criada com sucesso como rascunho!`;
          agentReplyText = simpleSuccessMessage; // Define para a resposta inicial
          
          await storage.addChatMessage({
            sessionId: activeSession.id,
            sender: 'agent',
            text: simpleSuccessMessage,
          });
          messageAlreadySavedBySpecialFlow = true; // Marca que a mensagem principal foi salva

          // Adiciona detalhes para a resposta ao usuário
          const campaignDetailsMessage = formatCampaignDetailsForChat(createdCampaign);
          agentReplyText += `\n\n${campaignDetailsMessage}`; 
          
          console.log(`[MCP_HANDLER] Campanha "${createdCampaign.name}" (ID: ${createdCampaign.id}) criada para usuário ${userId}.`);
        } catch (creationError: any) {
          console.error("[MCP_HANDLER] Erro ao criar campanha via MCP:", creationError);
          agentReplyText = `Houve um problema ao tentar criar a campanha "${campaignName}". Detalhes: ${creationError.message || 'Erro desconhecido.'}`;
        }
      } else {
        agentReplyText = "Entendi que você quer criar uma nova campanha, mas não consegui identificar o nome. Poderia me dizer qual nome você gostaria de dar para a nova campanha?";
      }
    } else { // Resposta geral da IA
      console.log(`[MCP_HANDLER] Nenhuma ação específica detectada. Usando IA geral.`);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const messagesFromDbForContext: ChatMessage[] = await storage.getChatMessages(activeSession.id, userId);
      
      const historyForGemini = messagesFromDbForContext
        .filter(msg => msg.sender === 'user' || msg.sender === 'agent') // Inclui apenas user e agent
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
      }));

      const systemPrompt = { role: "user", parts: [{ text: "Você é o Agente MCP. Responda em Português do Brasil, de forma concisa." }] };
      const chat = model.startChat({
        history: [systemPrompt, ...historyForGemini.slice(0, -1)], // Exclui a última mensagem do usuário (já adicionada)
         safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          ],
      });
      const result = await chat.sendMessage(message); // Envia a mensagem atual do usuário
      agentReplyText = result.response.text();
    }
  } else {
    agentReplyText = `Recebido: "${message || 'Anexo'}". ${!genAI ? 'O serviço de IA não está configurado.' : 'Por favor, envie uma mensagem de texto.'}`;
  }

  // Salva a resposta do agente no banco de dados, a menos que já tenha sido salva por um fluxo especial (criação de campanha)
  if (!messageAlreadySavedBySpecialFlow) {
    await storage.addChatMessage({
      sessionId: activeSession.id,
      sender: 'agent',
      text: agentReplyText, // Salva a resposta completa que será enviada ao usuário
    });
  }

  responsePayload.reply = agentReplyText;
  return responsePayload as MCPResponsePayload;
}
