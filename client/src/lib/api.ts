import { useAuthStore } from './auth';

// A URL base da API. Em produção, será a URL do seu servidor.
// Como eliminamos o Vite, ele usará o caminho relativo, que é o correto.
const API_BASE_URL = '/api';

/**
 * Lida com a resposta de uma requisição da API, parseando o corpo em caso de sucesso
 * ou extraindo uma mensagem de erro detalhada em caso de falha.
 * @param response O objeto Response do fetch.
 * @returns Os dados da resposta em JSON.
 * @throws Uma `Error` com uma mensagem descritiva se a resposta não for 'ok'.
 */
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return null as T;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    const textPayload = await response.text();
    payload = { error: textPayload || response.statusText };
  }
  
  if (!response.ok) {
    const errorMessage = payload?.error || payload?.message || `API Error: ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

/**
 * Função interna genérica para realizar requisições à API.
 * @param method O método HTTP.
 * @param endpoint O caminho do endpoint (ex: '/users').
 * @param body O corpo da requisição (pode ser um objeto ou FormData).
 * @param isFormData Flag para indicar se o corpo é FormData.
 * @returns Uma promessa que resolve para os dados da API.
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
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
    request<T>('GET', endpoint),
    
  post: <T>(endpoint: string, data: any) => 
    request<T>('POST', endpoint, data),

  put: <T>(endpoint: string, data: any) => 
    request<T>('PUT', endpoint, data),
    
  delete: <T>(endpoint: string) => 
    request<T>('DELETE', endpoint),

  upload: <T>(endpoint: string, file: File, additionalData?: Record<string, any>, method: 'POST' | 'PUT' = 'POST'): Promise<T> => {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      for (const key in additionalData) {
         if (additionalData[key] !== undefined && additionalData[key] !== null) {
            if (Array.isArray(additionalData[key])) {
                additionalData[key].forEach((item: string) => {
                    formData.append(`${key}[]`, item);
                });
            } else {
                formData.append(key, String(additionalData[key]));
            }
        }
      }
    }
    
    return request<T>(method, endpoint, formData, true);
  },
};
