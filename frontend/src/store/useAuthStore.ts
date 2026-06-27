import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  email: string;
  userTag?: string;
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

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.')
);

export const API_BASE = import.meta.env.VITE_API_URL || (isLocal
  ? `http://${window.location.hostname}:8080/api`
  : 'https://nexus-production-ce6a.up.railway.app/api');

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
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
        credentials: 'include',
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Invalid credentials');
      }

      const data = await response.json();
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
        credentials: 'include',
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Registration failed');
      }

      const data = await response.json();
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
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(err => console.error('Error logging out from backend', err));

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      authError: null,
    });
  },

  loadUser: async () => {
    let token = get().token;

    // If no token in memory, attempt to bootstrap using HttpOnly refresh cookie
    if (!token) {
      set({ isAuthenticating: true });
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          set({
            token: data.token,
            user: data.user,
            isAuthenticated: true,
            isAuthenticating: false,
          });
          return;
        }
      } catch (err) {
        console.error('Failed to bootstrap session from cookie:', err);
      }
      set({ token: null, user: null, isAuthenticated: false, isAuthenticating: false });
      return;
    }

    set({ isAuthenticating: true });
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Session expired');
      }

      const user = await response.json();
      set({ user, isAuthenticated: true, isAuthenticating: false });
    } catch (err) {
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
