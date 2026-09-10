import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  userTag?: string;
  avatarUrl?: string;
  statusMessage?: string;
  presence: 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
  createdAt?: string;
}

export interface OtpSendResult {
  success: boolean;
  message?: string;
  target?: string;
  cooldownSeconds?: number;
  devCode?: string;
  error?: string;
}

export interface OtpVerifyResult {
  success: boolean;
  isNewUser: boolean;
  verificationTicket?: string;
  token?: string;
  user?: User;
  error?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  activeTicket: string | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  setActiveTicket: (ticket: string | null) => void;
  sendOtp: (target: string, type: 'EMAIL' | 'PHONE') => Promise<OtpSendResult>;
  verifyOtp: (target: string, code: string) => Promise<OtpVerifyResult>;
  registerProfile: (ticket: string, username: string, displayName?: string, password?: string, avatarUrl?: string) => Promise<boolean>;
  checkUsername: (username: string) => Promise<{ available: boolean; error?: string }>;
  login: (usernameOrEmail: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updatePresence: (presence: User['presence']) => Promise<void>;
  updateStatus: (statusMessage: string) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
}

const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const isLocal = (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname.startsWith('172.')
    );
    if (isLocal) {
      return `http://${window.location.hostname}:8080/api`;
    }
  }
  return 'http://localhost:8080/api';
};

export const API_BASE = getApiBase();

let loadUserAbortController: AbortController | null = null;

const formatAuthError = (err: any): string => {
  if (!err) return 'CONNECTION_FAILED';
  const msg = typeof err === 'string' ? err : err.message || '';
  if (msg.includes('Failed to fetch') || err.name === 'TypeError') {
    return 'BACKEND UNREACHABLE: Server/Database is offline. Check DB or backend deployment.';
  }
  return msg;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  activeTicket: null,
  isAuthenticated: false,
  isAuthenticating: false,
  authError: null,

  setActiveTicket: (ticket: string | null) => set({ activeTicket: ticket }),

  sendOtp: async (target: string, type: 'EMAIL' | 'PHONE') => {
    set({ isAuthenticating: true, authError: null });
    try {
      const response = await fetch(`${API_BASE}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), type }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to send verification code');
      }

      const data = await response.json();
      set({ isAuthenticating: false });
      return {
        success: true,
        message: data.message,
        target: data.target,
        cooldownSeconds: data.cooldownSeconds,
        devCode: data.devCode,
      };
    } catch (err: any) {
      const msg = formatAuthError(err);
      set({ authError: msg, isAuthenticating: false });
      return { success: false, error: msg };
    }
  },

  verifyOtp: async (target: string, code: string) => {
    set({ isAuthenticating: true, authError: null });
    try {
      const response = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), code: code.trim() }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Invalid verification code');
      }

      const data = await response.json();
      const isNew = Boolean(data.newUser ?? data.isNewUser);

      if (isNew) {
        // User needs to set their profile details
        set({
          isAuthenticating: false,
          activeTicket: data.verificationTicket || null,
        });
        return {
          success: true,
          isNewUser: true,
          verificationTicket: data.verificationTicket,
        };
      } else {
        // Existing user authenticated directly
        set({
          token: data.token,
          user: data.user,
          isAuthenticated: true,
          isAuthenticating: false,
          activeTicket: null,
        });
        return {
          success: true,
          isNewUser: false,
          token: data.token,
          user: data.user,
        };
      }
    } catch (err: any) {
      const msg = formatAuthError(err);
      set({ authError: msg, isAuthenticating: false });
      return { success: false, isNewUser: false, error: msg };
    }
  },

  registerProfile: async (ticket: string, username: string, displayName?: string, password?: string, avatarUrl?: string) => {
    set({ isAuthenticating: true, authError: null });
    try {
      const cleanUsername = username.trim().replace(/^@/, '');
      const response = await fetch(`${API_BASE}/auth/otp/register-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationTicket: ticket,
          username: cleanUsername,
          displayName: displayName?.trim() || cleanUsername,
          password: password ? password : undefined,
          avatarUrl: avatarUrl || undefined,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to complete profile setup');
      }

      const data = await response.json();
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        isAuthenticating: false,
        activeTicket: null,
      });
      return true;
    } catch (err: any) {
      set({ authError: formatAuthError(err), isAuthenticating: false });
      return false;
    }
  },

  checkUsername: async (username: string) => {
    try {
      const clean = username.trim().replace(/^@/, '');
      if (clean.length < 3) {
        return { available: false, error: 'Username must be at least 3 characters' };
      }
      const response = await fetch(`${API_BASE}/auth/check-username?username=${encodeURIComponent(clean)}`);
      if (!response.ok) {
        return { available: false, error: 'Check failed' };
      }
      const data = await response.json();
      return { available: Boolean(data.available) };
    } catch (err: any) {
      return { available: false, error: err.message };
    }
  },

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
        let errText = '';
        try { errText = await response.text(); } catch (_) {}
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
      set({ authError: formatAuthError(err), isAuthenticating: false });
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
        let errText = '';
        try { errText = await response.text(); } catch (_) {}
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
      set({ authError: formatAuthError(err), isAuthenticating: false });
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
    if (loadUserAbortController) {
      loadUserAbortController.abort();
    }
    loadUserAbortController = new AbortController();
    const signal = loadUserAbortController.signal;

    let token = get().token;

    // If no token in memory, attempt to bootstrap using HttpOnly refresh cookie
    if (!token) {
      set({ isAuthenticating: true });
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          signal,
        });

        if (response.ok) {
          const data = await response.json();
          if (signal.aborted) return;
          set({
            token: data.token,
            user: data.user,
            isAuthenticated: true,
            isAuthenticating: false,
          });
          return;
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to bootstrap session from cookie:', err);
        }
      }
      if (signal.aborted) return;
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
        signal,
      });

      if (!response.ok) {
        throw new Error('Session expired');
      }

      const user = await response.json();
      if (signal.aborted) return;
      set({ user, isAuthenticated: true, isAuthenticating: false });
    } catch (err: any) {
      if (signal.aborted) return;
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
