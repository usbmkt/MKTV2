import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiRequest } from './api'; // Sua função helper para chamadas API

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean; // Adicionado para feedback de UI durante chamadas
  error: string | null; // Para armazenar mensagens de erro
  login: (email: string, password: string) => Promise<boolean>; // Retorna boolean para sucesso/falha
  register: (username: string, email: string, password: string) => Promise<boolean>; // Retorna boolean
  logout: () => void;
  checkAuth: () => void; // Verifica e atualiza o estado de autenticação
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest('POST', '/api/auth/login', { email, password });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Falha no login: Status ${response.status}` }));
            throw new Error(errorData.error || 'Credenciais inválidas ou erro no servidor.');
          }
          
          const data = await response.json();
          
          if (data.token && data.user) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            // O middleware 'persist' já salva no localStorage aqui
            return true;
          } else {
            throw new Error('Resposta de login inválida do servidor.');
          }
        } catch (error: any) {
          console.error('Login failed:', error);
          const errorMessage = error.message || 'Falha no login. Verifique suas credenciais.';
          set({ isLoading: false, error: errorMessage, isAuthenticated: false, user: null, token: null });
          // O middleware 'persist' também salvará user: null e token: null
          return false;
        }
      },
      
      register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest('POST', '/api/auth/register', { username, email, password });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Falha no registro: Status ${response.status}` }));
            throw new Error(errorData.error || 'Erro ao registrar ou usuário já existe.');
          }

          const data = await response.json();

          if (data.token && data.user) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            throw new Error('Resposta de registro inválida do servidor.');
          }
        } catch (error: any) {
          console.error('Registration failed:', error);
          const errorMessage = error.message || 'Falha no registro. Tente novamente.';
          set({ isLoading: false, error: errorMessage, isAuthenticated: false, user: null, token: null });
          return false;
        }
      },
      
      logout: () => {
        console.log("Efetuando logout, limpando estado e localStorage via persist.");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        // O middleware 'persist' automaticamente limpará 'user' e 'token' do localStorage
        // Se você tiver outras coisas para limpar (ex: cache do React Query específico do usuário), faça aqui.
        // queryClient.clear(); // Exemplo drástico, geralmente você quer invalidar queries.
      },
      
      checkAuth: () => {
        // Debug das variáveis de ambiente
        console.log('[AUTH] Verificando variáveis de ambiente:');
        console.log('[AUTH] VITE_FORCE_AUTH_BYPASS:', import.meta.env.VITE_FORCE_AUTH_BYPASS);
        console.log('[AUTH] Todas as env vars:', import.meta.env);
        
        // Bypass de autenticação para desenvolvimento/teste
        const forceBypass = import.meta.env.VITE_FORCE_AUTH_BYPASS === 'true' || 
                           import.meta.env.VITE_FORCE_AUTH_BYPASS === true ||
                           window.location.hostname.includes('all-hands.dev'); // Bypass para ambiente de desenvolvimento
        
        if (forceBypass) {
          console.log('[AUTH] Frontend bypass ativo - autenticando automaticamente');
          set({
            user: { id: 1, username: 'admin', email: 'admin@usbmkt.com' },
            token: 'bypass-token',
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          return;
        }

        // Esta função é chamada na inicialização da app para reidratar o estado de isAuthenticated
        // com base no token/user persistidos.
        const state = get(); // Pega o estado atual (que já foi reidratado pelo middleware 'persist')
        if (state.token && state.user) {
          // Adicionalmente, você pode querer verificar a validade do token aqui (ex: decodificar e checar expiração)
          // Por enquanto, uma verificação simples da presença é suficiente se o backend validar em cada request.
          set({ isAuthenticated: true, isLoading: false });
        } else {
          set({ isAuthenticated: false, user: null, token: null, isLoading: false });
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage', // Nome da chave no localStorage
      storage: createJSONStorage(() => localStorage), // Especifica o localStorage (padrão)
      partialize: (state) => ({ // Seleciona quais partes do estado persistir
        user: state.user,
        token: state.token,
        // Não persistir isAuthenticated, isLoading, error, pois devem ser derivados/temporários
      }),
      // onRehydrateStorage: () => (state) => { // Opcional: para ações após reidratação
      //   if (state) {
      //     state.checkAuth(); // Chama checkAuth após o estado ser reidratado
      //   }
      // }
    }
  )
);

// Chamar checkAuth uma vez quando o store é inicializado e o estado é reidratado.
// O middleware persist já lida com a reidratação inicial.
// A chamada explícita no App.tsx com useEffect é uma boa prática para garantir.
// useAuthStore.getState().checkAuth(); // Pode ser chamado aqui ou no App.tsx
