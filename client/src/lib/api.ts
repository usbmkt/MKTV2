// client/src/lib/api.ts
import { useAuthStore } from './auth';

const VITE_API_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiErrorDetail {
  path?: string;
  message: string;
}
export class ApiError extends Error {
  status: number;
  error?: string; 
  details?: ApiErrorDetail[];

  constructor(message: string, status: number, error?: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const apiRequest = async (method: string, path: string, data?: any, options?: RequestInit): Promise<any> => {
  const token = useAuthStore.getState().token;
  const headers: HeadersInit = { ...options?.headers };

  if (!(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config: RequestInit = {
    method,
    headers,
    ...options,
  };

  if (data && !(data instanceof FormData)) {
    config.body = JSON.stringify(data);
  } else if (data instanceof FormData) {
    config.body = data;
  }

  const response = await fetch(`${VITE_API_URL}${path}`, config);

  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch (e) {
      throw new ApiError(
        `HTTP error ${response.status}: ${response.statusText || 'Falha na requisição sem corpo JSON válido'}`,
        response.status
      );
    }
    throw new ApiError(
      errorBody.message || errorBody.error || `HTTP error ${response.status}`,
      response.status,
      errorBody.error,
      errorBody.details
    );
  }

  // Se a resposta for OK (2xx):
  const contentType = response.headers.get("content-type");
  if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
    // Para respostas sem conteúdo (204) ou que não são JSON,
    // não tentamos fazer o parse do JSON.
    // Retornamos null ou a resposta em texto se necessário,
    // mas para login/registro, esperamos JSON.
    // Se cair aqui para login/registro, há um problema no backend que não está enviando JSON.
    if (response.status !== 204 && contentType && !contentType.includes("application/json")) {
        console.warn(`API ${path} retornou status ${response.status} mas Content-Type não é application/json: ${contentType}`);
        return response.text(); // Ou null, dependendo de como o chamador lida com isso
    }
    return null; // Para 204 ou ausência de content-type JSON
  }
  
  return response.json(); // Tenta fazer o parse como JSON
};


export const uploadFile = async (path: string, file: File, additionalData?: Record<string, string>) => {
  const formData = new FormData();
  formData.append('file', file); 
  if (additionalData) {
    for (const key in additionalData) {
      formData.append(key, additionalData[key]);
    }
  }
  return apiRequest('POST', path, formData); 
};
