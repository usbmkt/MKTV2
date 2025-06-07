import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from './api'; // ✅ Importação direta e padronizada

// --- Tipos ---
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

// --- Store ---
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
          // ✅ CORREÇÃO: Usando a nova api.post diretamente
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
          throw new Error('Resposta de login inválida do servidor.');

        } catch (error: any) {
          console.error('Login failed:', error);
          const errorMessage = error.message || 'Falha no login. Verifique suas credenciais.';
          set({ isLoading: false, error: errorMessage });
          return false;
        }
      },
      
      register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
          // ✅ CORREÇÃO: Usando a nova api.post diretamente
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
          set({ isLoading: false, error: errorMessage });
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
        // A lógica de bypass foi removida pois não era a causa do erro
        // e pode ser simplificada ou removida para produção.
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
