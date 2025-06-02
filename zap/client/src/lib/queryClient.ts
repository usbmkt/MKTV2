 
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        if (error.message?.includes('401') || error.message?.includes('403')) {
          return false; // Não tentar novamente em erros de autenticação/autorização
        }
        return failureCount < 3; // Tentar novamente até 3 vezes para outros erros
      },
    },
    mutations: {
        retry: false,
    }
  },
});