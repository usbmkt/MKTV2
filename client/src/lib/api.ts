// client/src/lib/api.ts
import { useAuthStore } from './auth';

const VITE_API_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiErrorDetail {
  path?: string;
  message: string;
}
export class ApiError extends Error {
  status: number;
  error?: string; // Top-level error message from server
  details?: ApiErrorDetail[]; // Detailed validation errors

  constructor(message: string, status: number, error?: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const apiRequest = async (method: string, path: string, data?: any, options?: RequestInit) => {
  // Pega o token MAIS RECENTE diretamente do estado da store a cada chamada.
  // Isso é crucial porque a instância do hook useAuthStore() pode não ser reativa fora de um componente React.
  const token = useAuthStore.getState().token;

  const headers: HeadersInit = {
    ...options?.headers,
  };

  // Não definir Content-Type para FormData, o navegador faz isso incluindo o boundary.
  if (!(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // console.log(`[API Request] Making ${method} request to ${VITE_API_URL}${path} with token: ${token ? 'Present' : 'Absent'}`);

  const config: RequestInit = {
    method,
    headers,
    ...options,
  };

  if (data && !(data instanceof FormData)) {
    config.body = JSON.stringify(data);
  } else if (data instanceof FormData) {
    config.body = data; // Para uploads de arquivo
  }

  const response = await fetch(`${VITE_API_URL}${path}`, config);

  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch (e) {
      // Se o corpo do erro não for JSON válido
      throw new ApiError(
        `HTTP error ${response.status}: ${response.statusText || 'Falha na requisição'}`,
        response.status
      );
    }
    throw new ApiError(
      errorBody.message || errorBody.error || `HTTP error ${response.status}`,
      response.status,
      errorBody.error, // Adicionado para capturar a mensagem de erro de nível superior
      errorBody.details
    );
  }

  // Se a resposta for 204 No Content ou outros casos sem corpo JSON
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return response; // Retorna a resposta completa para que possa ser tratada
  }

  return response.json(); // Retorna a promessa do JSON parseado
};


// Função específica para upload de arquivos, usando apiRequest internamente mas com FormData
export const uploadFile = async (path: string, file: File, additionalData?: Record<string, string>) => {
  const formData = new FormData();
  formData.append('file', file); // 'file' é o nome do campo esperado pelo Multer no backend

  if (additionalData) {
    for (const key in additionalData) {
      formData.append(key, additionalData[key]);
    }
  }
  // apiRequest já lida com FormData, não precisa de Content-Type aqui.
  return apiRequest('POST', path, formData); 
};
