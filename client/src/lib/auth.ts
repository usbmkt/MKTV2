// client/src/lib/auth.ts
import { create } from 'zustand';
import { apiRequest, ApiError } from './api'; // ApiError importada

interface User {
  id: number;
  username: string;
  email: string;
  // Adicione outros campos do usuário conforme necessário
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
      const data = await apiRequest('POST', '/auth/login', { email, password });
      console.log('[AUTH STORE] Login API response data:', data); // LOG ADICIONADO

      // Verifica se 'data' é o objeto esperado e não uma Response
      if (typeof data?.json === 'function') {
        // Isso não deveria acontecer se apiRequest estiver correto
        console.error('[AUTH STORE] Login data received as Response object unexpectedly! Attempting data.json().');
        // const jsonData = await data.json(); // Não faça isso se apiRequest já fez.
        // throw new Error("Formato de resposta inesperado do apiRequest para login.");
        // Apenas para diagnóstico, se cair aqui, temos um problema no apiRequest
      }

      if (data && data.token && data.user) {
        console.log('[AUTH STORE] Login successful, token and user received.');
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        set({ isAuthenticated: true, user: data.user, token: data.token, isLoading: false });
        return true;
      } else {
        console.error('[AUTH STORE] Login response data is invalid or missing token/user:', data);
        throw new Error(data?.error || data?.message || 'Resposta de login inválida');
      }
    } catch (error: any) {
      console.error("[AUTH STORE] Login failed in auth.ts:", error);
      let errorMessage = 'Falha no login. Verifique suas credenciais.';
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
      // A rota de registro retorna o usuário e o token, similar ao login
      const data = await apiRequest('POST', '/auth/register', { username, email, password });
      console.log('[AUTH STORE] Registration API response data:', data);

      if (data && data.token && data.user) {
        console.log('[AUTH STORE] Registration successful, token and user received.');
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        set({ isAuthenticated: true, user: data.user, token: data.token, isLoading: false });
        return true;
      } else {
        console.error('[AUTH STORE] Registration response data is invalid or missing token/user:', data);
        throw new Error(data?.error || data?.message || 'Resposta de registro inválida');
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
    // Opcional: redirecionar para a página de login
    // window.location.href = '/login';
  },

  checkAuth: () => {
    console.log('[AUTH STORE] Checking auth status...');
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('user');
    if (token && userString) {
      try {
        const user = JSON.parse(userString);
        set({ isAuthenticated: true, user, token, isLoading: false });
        console.log('[AUTH STORE] User is authenticated from localStorage.');
      } catch (e) {
        console.error('[AUTH STORE] Failed to parse user from localStorage.', e);
        get().logout(); // Limpa se o usuário for inválido
      }
    } else {
      set({ isAuthenticated: false, user: null, token: null, isLoading: false });
      console.log('[AUTH STORE] No user/token in localStorage.');
    }
  },
}));

// Chamar checkAuth uma vez quando a store é inicializada para verificar o estado inicial
useAuthStore.getState().checkAuth();
