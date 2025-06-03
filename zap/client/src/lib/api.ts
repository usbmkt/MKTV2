// zap/client/src/lib/api.ts
// Adapte esta função conforme necessário para autenticação dentro do módulo Zap.
// Se o Zap tiver seu próprio sistema de auth, o token viria do Zap auth store.
// Se depender do token do MKTV2, ele precisaria ser passado para esta aplicação Zap.

interface ApiRequestOptions {
  url: string; // Será o path relativo à API do Zap, ex: /whatsapp/connection/status
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: unknown;
  isFormData?: boolean;
  // token?: string | null; // Opcional: para passar o token do MKTV2 se necessário
}

// A URL base da API do Zap será configurada no proxy do Vite para dev,
// e precisará ser a URL do servidor Zap em produção.
const ZAP_API_BASE_URL = '/api/zap'; // Usar o prefixo do proxy do Vite

export async function apiRequest({ url, method, data, isFormData /*, token */}: ApiRequestOptions): Promise<any> {
  const fullUrl = `${ZAP_API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

  const headers: Record<string, string> = {};

  if (!isFormData && data) {
    headers['Content-Type'] = 'application/json';
  }

  // Exemplo: Se o módulo Zap usar seu próprio token ou precisar do token do MKTV2
  // const authToken = token || localStorage.getItem('zap_module_token');
  // if (authToken) {
  //   headers['Authorization'] = `Bearer ${authToken}`;
  // }

  let body;
  if (isFormData && data instanceof FormData) {
    body = data;
  } else if (data) {
    body = JSON.stringify(data);
  }

  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text() || `Request failed with status ${response.status}` };
      }
      throw new Error(errorData.message || errorData.error || `API request to ${url} failed`);
    }

    // Se a resposta não tiver corpo (ex: DELETE 204), retornar um objeto de sucesso
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return { success: true };
    }

    return await response.json();
  } catch (error) {
    console.error(`API Request Error (${method} ${fullUrl}):`, error);
    throw error; // Re-throw para que react-query possa pegar
  }
} 
