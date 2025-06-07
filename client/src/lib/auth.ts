import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from './api'; // ✅ CORREÇÃO: Importar o objeto 'api' em vez de 'apiRequest'

// Tipos compartilhados
interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
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
          // ✅ CORREÇÃO: Usar 'api.post' que já retorna os dados ou lança um erro formatado.
          // O código fica muito mais limpo sem a verificação manual de 'response.ok'.
          const data = await api.post<AuthResponse>('/auth/login', { email, password });
          
          if (data.token && data.user) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          }
          // Este 'else' é uma salvaguarda, mas o 'handleApiResponse' em api.ts já deve garantir os dados.
          throw new Error('Resposta de login inválida do servidor.');

        } catch (error: any) {
          console.error('Login failed:', error);
          const errorMessage = error.message || 'Falha no login. Verifique suas credenciais.';
          set({ isLoading: false, error: errorMessage, isAuthenticated: false, user: null, token: null });
          return false;
        }
      },
      
      register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
          // ✅ CORREÇÃO: Usar 'api.post' aqui também.
          const data = await api.post<AuthResponse>('/auth/register', { username, email, password });

          if (data.token && data.user) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          } 
          throw new Error('Resposta de registro inválida do servidor.');
          
        } catch (error: any) {
          console.error('Registration failed:', error);
          const errorMessage = error.message || 'Falha no registro. Tente novamente.';
          set({ isLoading: false, error: errorMessage, isAuthenticated: false, user: null, token: null });
          return false;
        }
      },
      
      logout: () => {
        console.log("Efetuando logout, limpando estado.");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },
      
      checkAuth: () => {
        // Bypass de autenticação para desenvolvimento/teste (lógica mantida, está ótima!)
        const forceBypass = import.meta.env.VITE_FORCE_AUTH_BYPASS === 'true' || 
                           window.location.hostname.includes('all-hands.dev');
        
        if (forceBypass) {
          console.log('[AUTH] Frontend bypass ativo - autenticando automaticamente');
          set({
            user: { id: 1, username: 'dev-admin', email: 'admin@usbmkt.com' },
            token: 'bypass-token-dev',
            isAuthenticated: true,
          });
          return;
        }

        const state = get();
        if (state.token && state.user) {
          set({ isAuthenticated: true });
        } else {
          set({ isAuthenticated: false, user: null, token: null });
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
);
