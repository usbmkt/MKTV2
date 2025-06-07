import { useAuthStore } from './auth';

const API_BASE_URL = '/api';

// --- Função de tratamento de resposta (interna) ---
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

// --- Nova função de requisição (interna) ---
async function internalRequest<T>(
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
  const config: RequestInit = { method, headers };
  if (body) {
    if (isFormData) {
      config.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  return handleApiResponse<T>(response);
}

// --- Objeto 'api' (novo padrão) ---
export const api = {
  get: <T>(endpoint: string) => internalRequest<T>('GET', endpoint),
  post: <T>(endpoint: string, data: any) => internalRequest<T>('POST', endpoint, data),
  put: <T>(endpoint: string, data: any) => internalRequest<T>('PUT', endpoint, data),
  delete: <T>(endpoint: string) => internalRequest<T>('DELETE', endpoint),
};

// --- Função 'apiRequest' (padrão antigo) para compatibilidade ---
// ✅ CORREÇÃO: Readicionando a função antiga que as outras páginas usam
export async function apiRequest(
  method: string,
  url: string, // url aqui é o endpoint completo, ex: /api/campaigns
  data?: unknown
): Promise<Response> {
  const { token } = useAuthStore.getState();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers: data ? headers : { 'Authorization': `Bearer ${token}` }, // Evita Content-Type em GET
    body: data ? JSON.stringify(data) : undefined,
  });
  
  // A versão antiga retornava a response bruta, vamos manter isso
  // if (!response.ok) {
  //   const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
  //   throw new Error(errorData.message || `Erro na requisição para ${url}`);
  // }
  return response;
}

// ✅ CORREÇÃO: Readicionando a função de upload que o modal usa
export async function uploadFile(
    endpoint: string,
    file: File,
    additionalData: Record<string, any> = {},
    method: 'POST' | 'PUT' = 'POST'
): Promise<Response> {
    const { token } = useAuthStore.getState();
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const formData = new FormData();
    formData.append('file', file);
    
    for (const key in additionalData) {
        if (additionalData[key] !== undefined && additionalData[key] !== null) {
            if (Array.isArray(additionalData[key])) {
                additionalData[key].forEach((item: string) => formData.append(`${key}[]`, item));
            } else {
                formData.append(key, String(additionalData[key]));
            }
        }
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: formData,
    });

    return response;
}
