// client/src/lib/api.ts
import { useAuthStore } from './auth';

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  isFormData: boolean = false
): Promise<Response> {
  const { token } = useAuthStore.getState();

  const headers: Record<string, string> = {};

  if (!isFormData && data) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body;
  if (isFormData && data instanceof FormData) {
    body = data;
  } else if (data) {
    body = JSON.stringify(data);
  } else {
    body = undefined;
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    let errorMessage;
    try {
      const errorPayload = await response.json();
      if (errorPayload && typeof errorPayload === 'object') {
        if (errorPayload.error && typeof errorPayload.error === 'string' && errorPayload.error.trim() !== '') {
          errorMessage = errorPayload.error;
        } else if (errorPayload.message && typeof errorPayload.message === 'string' && errorPayload.message.trim() !== '') {
          errorMessage = errorPayload.message;
        }
      }
    } catch (e) {
      try {
        const errorText = await response.text();
        if (errorText && errorText.trim() !== '') {
          errorMessage = errorText;
        }
      } catch (textError) {}
    }

    if (!errorMessage) {
      errorMessage = `API Error: ${response.status} ${response.statusText || ''}`.trim();
    }
    throw new Error(errorMessage);
  }

  return response;
}

export async function uploadFile(
  url: string,
  file: File,
  additionalData?: Record<string, string>,
  method: string = 'POST' // Adicionado método para permitir PUT/PATCH
): Promise<Response> {
  const { token } = useAuthStore.getState();

  const formData = new FormData();
  formData.append('file', file); // 'file' é o nome do campo esperado pelo Multer

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: method, // Usar o método passado
    headers, // Content-Type é definido automaticamente pelo browser para FormData
    body: formData,
  });

  if (!response.ok) {
    let errorMessage;
    try {
      const errorPayload = await response.json();
      if (errorPayload && typeof errorPayload === 'object') {
        if (errorPayload.error && typeof errorPayload.error === 'string' && errorPayload.error.trim() !== '') {
          errorMessage = errorPayload.error;
        } else if (errorPayload.message && typeof errorPayload.message === 'string' && errorPayload.message.trim() !== '') {
          errorMessage = errorPayload.message;
        }
      }
    } catch (e) {
      try {
        const errorText = await response.text();
        if (errorText && errorText.trim() !== '') {
          errorMessage = errorText;
        }
      } catch (textError) {}
    }

    if (!errorMessage) {
      errorMessage = `Upload Error: ${response.status} ${response.statusText || ''}`.trim();
    }
    throw new Error(errorMessage);
  }

  return response;
}
