import { useAuthStore } from './auth';

// A URL base da API. Em produção, será a URL do seu servidor.
// Em desenvolvimento (com proxy no vite.config.js), pode ser simplesmente '/api'.
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/**
 * Lida com a resposta de uma requisição da API, parseando o corpo em caso de sucesso
 * ou extraindo uma mensagem de erro detalhada em caso de falha.
 * @param response O objeto Response do fetch.
 * @returns Os dados da resposta em JSON.
 * @throws Uma `Error` com uma mensagem descritiva se a resposta não for 'ok'.
 */
async function handleApiResponse<T>(response: Response): Promise<T> {
  // Requisições bem-sucedidas sem conteúdo (ex: DELETE, 204 No Content)
  if (response.status === 204) {
    return null as T;
  }

  // Tenta obter o corpo da resposta, seja JSON ou texto
  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    // Se falhar o parse do JSON, pode ser um erro de servidor (ex: HTML de erro)
    const textPayload = await response.text();
    payload = { error: textPayload || response.statusText };
  }
  
  if (!response.ok) {
    // Extrai a mensagem de erro do payload, se disponível, ou usa o statusText.
    const errorMessage = payload?.error || payload?.message || `API Error: ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

/**
 * Função interna genérica para realizar requisições à API.
 * @param endpoint O caminho do endpoint (ex: '/users').
 * @param method O método HTTP.
 * @param body O corpo da requisição (pode ser um objeto ou FormData).
 * @param isFormData Flag para indicar se o corpo é FormData.
 * @returns Uma promessa que resolve para os dados da API.
 */
async function request<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  isFormData: boolean = false
): Promise<T> {
  const { token } = useAuthStore.getState();
  const headers: HeadersInit = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    if (isFormData) {
      // Para FormData, o browser define o 'Content-Type' com o boundary correto.
      config.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  return handleApiResponse<T>(response);
}

// Objeto singleton exportado com métodos fáceis de usar para a API.
export const api = {
  get: <T>(endpoint: string) => 
    request<T>(endpoint, 'GET'),
    
  post: <T>(endpoint: string, data: any) => 
    request<T>(endpoint, 'POST', data),

  put: <T>(endpoint: string, data: any) => 
    request<T>(endpoint, 'PUT', data),

  patch: <T>(endpoint: string, data: any) => 
    request<T>(endpoint, 'PATCH', data),
    
  delete: <T>(endpoint: string) => 
    request<T>(endpoint, 'DELETE'),

  /**
   * Realiza o upload de um arquivo para um endpoint da API.
   * @param endpoint O caminho do endpoint (ex: '/creatives/upload').
   * @param file O arquivo a ser enviado.
   * @param additionalData Dados adicionais a serem enviados junto com o arquivo.
   * @returns Uma promessa que resolve para os dados da API.
   */
  upload: <T>(endpoint: string, file: File, additionalData?: Record<string, string>): Promise<T> => {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      for (const key in additionalData) {
        formData.append(key, additionalData[key]);
      }
    }
    
    return request<T>(endpoint, 'POST', formData, true);
  },
};
