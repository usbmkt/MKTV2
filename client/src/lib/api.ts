import { useAuthStore } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return null as T;

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

// ✅ CORREÇÃO: Função dedicada para upload de arquivos
export async function uploadFile<T>(
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
    
    // Adiciona outros campos ao FormData
    for (const key in additionalData) {
        if (additionalData[key] !== undefined && additionalData[key] !== null) {
            // Converte arrays para múltiplos campos se necessário (para compatibilidade com multer)
            if (Array.isArray(additionalData[key])) {
                additionalData[key].forEach((item: string) => {
                    formData.append(`${key}[]`, item);
                });
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
    
    // Não usamos handleApiResponse aqui porque o upload pode não retornar JSON
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.statusText}` }));
        throw new Error(errorData.message || 'Erro no upload do arquivo');
    }
    
    return response; // Retorna a resposta bruta para ser processada
}

export async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  isFormData: boolean = false, // Mantido por compatibilidade
): Promise<Response> {
  const { token } = useAuthStore.getState();
  const headers: HeadersInit = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = { method, headers };

  if (body) {
    if (isFormData) { // Se for formData, o browser cuida do Content-Type
      config.body = body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }
  }

  return fetch(`${API_BASE_URL}${endpoint}`, config);
}
