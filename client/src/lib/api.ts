import { useAuthStore } from './auth';

const API_BASE_URL = '/api';

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return null as T;

  const textPayload = await response.text();
  let payload: any;
  try {
    payload = textPayload ? JSON.parse(textPayload) : null;
  } catch (e) {
    // Se não for um JSON válido, o payload é o próprio texto (útil para erros de HTML)
    payload = { error: textPayload || response.statusText };
  }
  
  if (!response.ok) {
    const errorMessage = payload?.error || payload?.message || `API Error: ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

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

// Objeto singleton exportado
export const api = {
  get: <T>(endpoint: string) => request<T>('GET', endpoint),
  post: <T>(endpoint: string, data: any) => request<T>('POST', endpoint, data),
  put: <T>(endpoint: string, data: any) => request<T>('PUT', endpoint, data),
  patch: <T>(endpoint: string, data: any) => request<T>('PATCH', data),
  delete: <T>(endpoint: string) => request<T>('DELETE', endpoint),
  upload: <T>(endpoint: string, file: File, additionalData?: Record<string, any>, method: 'POST' | 'PUT' = 'POST'): Promise<T> => {
    const formData = new FormData();
    formData.append('file', file);
    if (additionalData) {
      for (const key in additionalData) {
        if (additionalData[key] !== undefined && additionalData[key] !== null) {
          formData.append(key, String(additionalData[key]));
        }
      }
    }
    return request<T>(method, endpoint, formData, true);
  },
};

// Funções antigas para compatibilidade
export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const { token } = useAuthStore.getState();
  const headers: HeadersInit = data instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, {
    method,
    headers,
    body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
  });
}

export async function uploadFile(endpoint: string, file: File, additionalData?: Record<string, any>, method: 'POST' | 'PUT' = 'POST'): Promise<Response> {
  const { token } = useAuthStore.getState();
  const formData = new FormData();
  formData.append('file', file);
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
  }
  return fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
}
