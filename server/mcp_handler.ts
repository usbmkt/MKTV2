// server/mcp_handler.ts
import { storage } from "./storage";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GEMINI_API_KEY } from './config';
import { InsertCampaign, ChatMessage, ChatSession } from "../shared/schema"; // Removido User, pois não é utilizado neste arquivo

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
  if (campaign.budget !== null && campaign.budget !== undefined) details += `\n  - Orçamento: ${campaign.budget}`;
  // Adicione mais campos conforme necessário
  return details;
}


export async function handleMCPConversation(
  userId: number,
  message: string,
  currentSessionId: number | null | undefined,
  attachmentUrl?: string | null
): Promise<MCPResponsePayload> {
  console.log(`[MCP_HANDLER] User ${userId} disse: "${message || '[Anexo]'}" (Session: ${currentSessionId || 'Nova'})`);

  let activeSession: ChatSession | undefined;
  if (currentSessionId) {
    activeSession = await storage.getChatSession(currentSessionId, userId);
  }

  if (!activeSession) {
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
            // budget, dailyBudget, avgTicket são opcionais e serão tratados como null/undefined
            // se não fornecidos aqui, conforme o schema Zod e a lógica do banco.
          };
          const createdCampaign = await storage.createCampaign(newCampaignData);
          agentReplyText = `Campanha "${createdCampaign.name}" criada com sucesso como rascunho!`;
          console.log(`[MCP_HANDLER] Campanha "${createdCampaign.name}" (ID: ${createdCampaign.id}) criada para usuário ${userId}.`);
          
          const campaignDetailsMessage = formatCampaignDetailsForChat(createdCampaign);
          await storage.addChatMessage({ 
            sessionId: activeSession.id,
            sender: 'agent',
            text: agentReplyText, // Salva a mensagem simples de sucesso
          });
          // A resposta final para o usuário incluirá os detalhes, mas a mensagem simples é salva no histórico.
          agentReplyText += `\n\n${campaignDetailsMessage}`;

        } catch (creationError: any) {
          console.error("[MCP_HANDLER] Erro ao criar campanha via MCP:", creationError);
          agentReplyText = `Houve um problema ao tentar criar a campanha "${campaignName}". Detalhes: ${creationError.message || 'Erro desconhecido.'}`;
          // Removido ZodError específico aqui pois a mensagem de erro geral já deve ser suficiente.
          // Se quiser ser mais específico com ZodError, pode adicionar de volta.
        }
      } else {
        agentReplyText = "Entendi que você quer criar uma nova campanha, mas não consegui identificar o nome. Poderia me dizer qual nome você gostaria de dar para a nova campanha?";
      }
    } else {
      // Resposta geral da IA se nenhuma ação específica for detectada
      console.log(`[MCP_HANDLER] Nenhuma ação específica detectada. Usando IA geral.`);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const messagesFromDb: ChatMessage[] = await storage.getChatMessages(activeSession.id, userId);
      const historyForGemini = messagesFromDb.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
      const systemPrompt = { role: "user", parts: [{ text: "Você é o Agente MCP. Responda em Português do Brasil, de forma concisa." }] };
      const chat = model.startChat({
        history: [systemPrompt, ...historyForGemini.slice(0, -1)], // Exclui a última mensagem do usuário, que será enviada
         safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          ],
      });
      const result = await chat.sendMessage(message);
      agentReplyText = result.response.text();
    }
  } else {
    agentReplyText = `Recebido: "${message || 'Anexo'}". ${!genAI ? 'O serviço de IA não está configurado.' : 'Por favor, envie uma mensagem de texto.'}`;
  }

  // Salva a resposta final do agente (que pode ter sido concatenada)
  // Se a resposta de criação já salvou a mensagem simples, esta lógica evita salvar novamente
  // a mesma mensagem base. A mensagem com detalhes é apenas para o usuário.
  if (!agentReplyText.includes("Detalhes da Campanha Criada:") || (agentReplyText.includes("Detalhes da Campanha Criada:") && !messages.some(m => m.text.startsWith(`Campanha "${(await getCampaignNameFromMessage(message))}" criada com sucesso`)))) {
    await storage.addChatMessage({
      sessionId: activeSession.id,
      sender: 'agent',
      text: agentReplyText.split('\n\nDetalhes da Campanha Criada:')[0], // Salva apenas a mensagem principal se houver detalhes
    });
  }

  responsePayload.reply = agentReplyText; // Envia a resposta completa (com detalhes se houver) para o frontend
  return responsePayload as MCPResponsePayload;
}
