// client/src/lib/auth.ts
import { create } from 'zustand';
import { apiRequest, ApiError } from './api'; 

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    console.log('[AUTH STORE] Attempting login...');
    try {
      const responseData = await apiRequest('POST', '/auth/login', { email, password });
      console.log('[AUTH STORE] Login API response data:', responseData);

      if (responseData && responseData.token && responseData.user) {
        console.log('[AUTH STORE] Login successful, token and user received.');
        localStorage.setItem('user', JSON.stringify(responseData.user));
        localStorage.setItem('token', responseData.token);
        // Atualizar o estado de uma vez para evitar múltiplas re-renderizações ou estados intermediários
        set({ 
          isAuthenticated: true, 
          user: responseData.user, 
          token: responseData.token, 
          isLoading: false,
          error: null // Limpar erro em caso de sucesso
        });
        return true;
      } else {
        console.error('[AUTH STORE] Login response data is invalid or missing token/user:', responseData);
        const loginError = new Error(responseData?.error || responseData?.message || 'Resposta de login inválida do servidor.');
        set({ isLoading: false, error: loginError.message });
        return false;
      }
    } catch (error: any) {
      console.error("[AUTH STORE] Login failed in auth.ts catch block:", error);
      let errorMessage = 'Falha no login. Verifique suas credenciais ou tente novamente.';
      if (error instanceof ApiError) {
        errorMessage = error.message || error.error || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    console.log('[AUTH STORE] Attempting registration...');
    try {
      const responseData = await apiRequest('POST', '/auth/register', { username, email, password });
      console.log('[AUTH STORE] Registration API response data:', responseData);

      if (responseData && responseData.token && responseData.user) {
        console.log('[AUTH STORE] Registration successful, token and user received.');
        localStorage.setItem('user', JSON.stringify(responseData.user));
        localStorage.setItem('token', responseData.token);
        set({ 
          isAuthenticated: true, 
          user: responseData.user, 
          token: responseData.token, 
          isLoading: false,
          error: null 
        });
        return true;
      } else {
        console.error('[AUTH STORE] Registration response data is invalid or missing token/user:', responseData);
        const registerError = new Error(responseData?.error || responseData?.message || 'Resposta de registro inválida do servidor.');
        set({ isLoading: false, error: registerError.message });
        return false;
      }
    } catch (error: any) {
      console.error("[AUTH STORE] Registration failed in auth.ts:", error);
      let errorMessage = 'Falha no registro. Tente novamente.';
      if (error instanceof ApiError) {
        errorMessage = error.message || error.error || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  logout: () => {
    console.log('[AUTH STORE] Logging out.');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ isAuthenticated: false, user: null, token: null, isLoading: false, error: null });
  },

  checkAuth: () => {
    console.log('[AUTH STORE] Checking auth status...');
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('user');
    if (token && userString) {
      try {
        const user = JSON.parse(userString);
        set({ isAuthenticated: true, user, token, isLoading: false, error: null });
        console.log('[AUTH STORE] User is authenticated from localStorage.');
      } catch (e) {
        console.error('[AUTH STORE] Failed to parse user from localStorage.', e);
        get().logout();
      }
    } else {
      set({ isAuthenticated: false, user: null, token: null, isLoading: false, error: null });
      console.log('[AUTH STORE] No user/token in localStorage.');
    }
  },
}));

useAuthStore.getState().checkAuth();
