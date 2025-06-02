// zap/server/services/AIService.ts
import pino, { Logger } from 'pino';
import axios from 'axios';
// import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

class AIService {
    private logger: Logger;
    // private genAI: GoogleGenerativeAI | null = null;
    // private geminiProModel: any = null; // Usar any por enquanto para o tipo do modelo

    constructor() {
        this.logger = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ service: 'AIService' });
        
        // const geminiApiKey = process.env.ZAP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        // if (geminiApiKey) {
        //     this.genAI = new GoogleGenerativeAI(geminiApiKey);
        //     this.geminiProModel = this.genAI.getGenerativeModel({ model: "gemini-pro" }); // Modelo padrão
        //     this.logger.info("AIService inicializado com Gemini API Key.");
        // } else {
        //     this.logger.warn("Chave da API Gemini (ZAP_GEMINI_API_KEY ou GEMINI_API_KEY) não configurada. IA usará mocks.");
        // }
        this.logger.info("AIService inicializado (atualmente em modo mock/placeholder para chamadas reais).");
    }

    async generateText(
        prompt: string, 
        systemMessage?: string, 
        modelName?: string, // Ex: "gemini-pro", "gpt-3.5-turbo"
        // Outras opções: temperature, maxTokens
    ): Promise<string> {
        this.logger.info({ prompt, systemMessage, modelName }, "Gerando texto com IA (simulado)...");
        // if (!this.geminiProModel && !modelName?.startsWith('gpt-')) { // Adicionar verificação para OpenAI se for usar
        //     this.logger.warn("Nenhum modelo de IA configurado para generateText.");
        //     return `[MOCK AI Response] Sem modelo de IA para: "${prompt.substring(0, 50)}..."`;
        // }
        
        // LÓGICA REAL DE CHAMADA À API (Exemplo Gemini comentado)
        // try {
        //     const modelToUse = modelName && modelName !== "gemini-pro" && this.genAI ? this.genAI.getGenerativeModel({ model: modelName }) : this.geminiProModel;
        //     if (!modelToUse) throw new Error("Modelo de IA não disponível ou nome inválido.");

        //     const generationConfig = {
        //         // temperature: 0.7,
        //         // maxOutputTokens: 2048,
        //         // Adicionar safetySettings se necessário
        //     };
        //     const parts = [{ text: prompt }];
        //     if (systemMessage) { // Gemini trata system prompt como parte do histórico ou de forma específica
        //          this.logger.info("System message não diretamente suportado da mesma forma que OpenAI, incorporando ao prompt ou histórico se necessário.");
        //     }

        //     const result = await modelToUse.generateContent({ contents: [{ role: "user", parts }] , generationConfig});
        //     const response = result.response;
        //     const text = response.text();
        //     this.logger.info("Resposta da IA (Gemini) recebida.");
        //     return text;
        // } catch (error: any) {
        //     this.logger.error({ error: error.message, details: error.stack }, "Erro ao chamar serviço de IA para geração de texto.");
        //     return `[ERRO IA] Não foi possível gerar texto: ${error.message}`;
        // }
        return `[MOCK AI Response] Resposta gerada para o prompt: "${prompt.substring(0, 50)}..."`;
    }

    async getDecision(
        prompt: string, 
        categories: string[], // Categorias que o modelo deve escolher
        modelName?: string,
    ): Promise<string> { // Retorna uma das categorias ou uma string de erro/fallback
        this.logger.info({ prompt, categories, modelName }, "Obtendo decisão da IA (simulado)...");
        // if ((!this.geminiProModel && !modelName?.startsWith('gpt-')) || categories.length === 0) {
        //     const fallback = categories[0] || 'default_decision_category';
        //     this.logger.warn(`Serviço de IA não configurado ou sem categorias. Retornando fallback: ${fallback}`);
        //     return fallback;
        // }

        // LÓGICA REAL DE CHAMADA À API PARA CLASSIFICAÇÃO/DECISÃO
        // const decisionPrompt = `Dado o seguinte texto: "${prompt}". Qual das seguintes categorias melhor se aplica: ${categories.join(', ')}? Responda APENAS com o nome exato de uma das categorias fornecidas. Se nenhuma se aplicar bem, responda com "OUTRA".`;
        // try {
        //     // ... chamada ao this.generateText(decisionPrompt, undefined, modelName || "gemini-pro") ...
        //     // let chosenCategory = await this.generateText(decisionPrompt, undefined, modelName || "gemini-pro");
        //     // chosenCategory = chosenCategory.trim();
        //     // if (categories.includes(chosenCategory)) {
        //     //     return chosenCategory;
        //     // } else {
        //     //     this.logger.warn({chosenCategory, categories}, "IA retornou categoria não esperada. Usando fallback.");
        //     //     return categories[0] || 'default_decision_category'; // Fallback
        //     // }
        // } catch (error) { /* ... tratamento de erro ... */ }

        if (categories.length > 0) {
            return categories[Math.floor(Math.random() * categories.length)];
        }
        return 'fallback_decision';
    }
}

const aiServiceInstance = new AIService();
export default aiServiceInstance;