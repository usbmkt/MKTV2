// server/services/external-data.service.ts
import { logger } from '../logger.js';

interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: Record<string, any> | string;
}

interface ApiResponse {
  status: number;
  data: any;
  headers: Record<string, string>;
}

class ExternalDataService {
  public async request(url: string, options: ApiRequestOptions): Promise<ApiResponse> {
    logger.info({ url, method: options.method }, 'Executando chamada de API externa');
    
    try {
      const headers: Record<string, string> = { ...options.headers };
      let bodyPayload: string | undefined;

      if (options.body) {
        if (typeof options.body === 'object') {
          headers['Content-Type'] = 'application/json';
          bodyPayload = JSON.stringify(options.body);
        } else {
          bodyPayload = options.body;
        }
      }

      const response = await fetch(url, {
        method: options.method,
        headers: headers,
        body: bodyPayload,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseData: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        logger.error({ url, status: response.status, response: responseData }, 'Falha na chamada de API externa');
        throw new Error(`API externa respondeu com status ${response.status}`);
      }

      logger.info({ url, status: response.status }, 'Chamada de API externa bem-sucedida');
      return {
        status: response.status,
        data: responseData,
        headers: responseHeaders,
      };

    } catch (error: any) {
      logger.error({ url, error: error.message }, 'Erro crítico ao executar chamada de API externa');
      throw error;
    }
  }
}

export const externalDataService = new ExternalDataService();
