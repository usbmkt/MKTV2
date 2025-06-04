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

  console.log(`[API Request DEBUG] URL: ${VITE_API_URL}${path}`, config); // Log da configuração

  const response = await fetch(`${VITE_API_URL}${path}`, config);

  console.log(`[API Request DEBUG] Response Status for ${path}: ${response.status}`); // Log do status
  console.log(`[API Request DEBUG] Response Headers for ${path}:`, Object.fromEntries(response.headers.entries())); // Log dos headers

  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
      console.log(`[API Request DEBUG] Error Body for ${path} (Not OK):`, errorBody);
    } catch (e) {
      const errorText = await response.text(); // Tenta ler como texto se não for JSON
      console.log(`[API Request DEBUG] Error Text Body for ${path} (Not OK, Not JSON):`, errorText);
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

  const contentType = response.headers.get("content-type");
  console.log(`[API Request DEBUG] Content-Type for ${path}: ${contentType}`);

  if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
    if (response.status !== 204) { // Não logar aviso para 204, que é esperado não ter corpo
        console.warn(`[API Request DEBUG] Response for ${path} is OK but not JSON or 204. Status: ${response.status}, Content-Type: ${contentType}`);
    }
    // Para login e outras rotas que ESPERAM JSON, retornar null aqui pode causar problemas no chamador.
    // Se a rota de login cair aqui, o backend NÃO está enviando JSON como deveria para uma resposta 200.
    return null; 
  }
  
  console.log(`[API Request DEBUG] Attempting to parse JSON for ${path}`);
  try {
    const jsonData = await response.json(); // É aqui que 'i.json()' seria chamado
    console.log(`[API Request DEBUG] Successfully parsed JSON for ${path}:`, jsonData);
    return jsonData;
  } catch (e: any) {
    console.error(`[API Request DEBUG] Failed to parse JSON for ${path} despite Content-Type. Error:`, e.message);
    console.error(`[API Request DEBUG] Response object was:`, response); // Logar o objeto response
    // Tentar ler como texto para ver o que realmente veio
    const textResponse = await response.text().catch(() => "Falha ao ler corpo como texto.");
    console.error(`[API Request DEBUG] Body as text for ${path} (after JSON parse failure):`, textResponse);
    throw new ApiError(
      `Falha ao fazer parse da resposta JSON para ${path}: ${e.message}`,
      response.status,
      "JSONParseError"
    );
  }
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
