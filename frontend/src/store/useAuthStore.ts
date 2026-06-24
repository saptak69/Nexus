import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string;
  statusMessage?: string;
  presence: 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  login: (usernameOrEmail: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updatePresence: (presence: User['presence']) => Promise<void>;
  updateStatus: (statusMessage: string) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
}

const API_BASE = 'http://localhost:8080/api';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('nexus_token'),
  isAuthenticated: false,
  isAuthenticating: false,
  authError: null,

  login: async (usernameOrEmail, password) => {
    set({ isAuthenticating: true, authError: null });
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Invalid credentials');
      }

      const data = await response.json();
      localStorage.setItem('nexus_token', data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        isAuthenticating: false,
      });
      return true;
    } catch (err: any) {
      set({ authError: err.message, isAuthenticating: false });
      return false;
    }
  },

  register: async (username, email, password) => {
    set({ isAuthenticating: true, authError: null });
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('nexus_token', data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        isAuthenticating: false,
      });
      return true;
    } catch (err: any) {
      set({ authError: err.message, isAuthenticating: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('nexus_token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      authError: null,
    });
  },

  loadUser: async () => {
    const token = get().token;
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    set({ isAuthenticating: true });
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Session expired');
      }

      const user = await response.json();
      set({ user, isAuthenticated: true, isAuthenticating: false });
    } catch (err) {
      localStorage.removeItem('nexus_token');
      set({ token: null, user: null, isAuthenticated: false, isAuthenticating: false });
    }
  },

  updatePresence: async (presence) => {
    const token = get().token;
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/users/presence`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ presence }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        set({ user: updatedUser });
      }
    } catch (err) {
      console.error('Error updating presence', err);
    }
  },

  updateStatus: async (statusMessage) => {
    const token = get().token;
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/users/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statusMessage }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        set({ user: updatedUser });
      }
    } catch (err) {
      console.error('Error updating status message', err);
    }
  },

  updateAvatar: async (avatarUrl) => {
    const token = get().token;
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/users/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarUrl }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        set({ user: updatedUser });
      }
    } catch (err) {
      console.error('Error updating avatar', err);
    }
  },
}));
