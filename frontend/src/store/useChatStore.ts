import { create } from 'zustand';
import { useAuthStore, API_BASE } from './useAuthStore';
import type { User } from './useAuthStore';
import { useWebRTCStore } from './useWebRTCStore';

let reconnectTimer: any = null;
let reconnectAttempts = 0;
let isExplicitlyClosed = false;

export interface Server {
  id: number;
  name: string;
  inviteCode: string;
  iconUrl?: string;
  owner?: User;
  members?: User[];
  channels?: Channel[];
}

export interface Channel {
  id: number;
  name: string;
  type: 'TEXT' | 'VIDEO';
}

export interface Reaction {
  id: number;
  emoji: string;
  user: User;
}

export interface Message {
  id: number;
  content: string;
  sender: User;
  channel?: Channel;
  recipient?: User;
  parentMessage?: Message | null;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  edited: boolean;
  deleted: boolean;
  reactions: Reaction[];
  createdAt: string;
}

interface ChatState {
  // Navigation
  activeMode: 'SERVER' | 'DM';
  activeServerId: number | null;
  activeChannelId: number | null;
  activeDmUserId: number | null;
  
  // Data lists
  servers: Server[];
  channels: Channel[];
  friends: User[];
  messages: Message[];
  
  // Realtime
  socket: WebSocket | null;
  connected: boolean;
  typingUsers: Record<number, string>; // userId -> username
  activeRoomUsers: number[]; // WebRTC participant IDs in current room
  
  // Actions
  setActiveMode: (mode: 'SERVER' | 'DM') => void;
  setActiveServerId: (id: number | null) => void;
  setActiveChannelId: (id: number | null) => void;
  setActiveDmUserId: (id: number | null) => void;
  
  // API actions
  fetchServers: () => Promise<void>;
  createServer: (name: string, iconUrl?: string) => Promise<boolean>;
  joinServer: (inviteCode: string) => Promise<boolean>;
  leaveServer: (serverId: number) => Promise<boolean>;
  
  fetchChannels: (serverId: number) => Promise<void>;
  createChannel: (serverId: number, name: string, type: 'TEXT' | 'VIDEO') => Promise<boolean>;
  deleteChannel: (channelId: number) => Promise<boolean>;
  
  fetchFriends: () => Promise<void>;
  fetchMessages: (page?: number) => Promise<void>;
  
  // Socket managers
  connectSocket: () => void;
  disconnectSocket: () => void;
  sendMessage: (content: string, options?: { parentId?: number; fileUrl?: string; fileName?: string; fileType?: string }) => void;
  sendTyping: (isTyping: boolean) => void;
}



export const useChatStore = create<ChatState>((set, get) => {
  let typingTimeout: any = null;

  return {
    activeMode: 'DM',
    activeServerId: null,
    activeChannelId: null,
    activeDmUserId: null,
    servers: [],
    channels: [],
    friends: [],
    messages: [],
    socket: null,
    connected: false,
    typingUsers: {},
    activeRoomUsers: [],

    setActiveMode: (activeMode) => {
      set({ activeMode });
      if (activeMode === 'DM') {
        set({ activeServerId: null, activeChannelId: null });
      } else {
        set({ activeDmUserId: null });
      }
      set({ messages: [] });
    },

    setActiveServerId: (activeServerId) => {
      set({ activeServerId, activeChannelId: null, activeMode: 'SERVER', activeDmUserId: null });
      if (activeServerId) {
        get().fetchChannels(activeServerId);
      }
    },

    setActiveChannelId: (activeChannelId) => {
      const oldChannelId = get().activeChannelId;
      set({ activeChannelId, messages: [] });
      
      if (activeChannelId) {
        get().fetchMessages(0);
      }
      
      // Leave previous channel WS room and join new one
      const socket = get().socket;
      if (socket && socket.readyState === WebSocket.OPEN) {
        if (oldChannelId) {
          socket.send(JSON.stringify({ type: 'LEAVE_ROOM', roomId: `channel_${oldChannelId}` }));
        }
        if (activeChannelId) {
          socket.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: `channel_${activeChannelId}` }));
        }
      }
    },

    setActiveDmUserId: (activeDmUserId) => {
      set({ activeDmUserId, activeMode: 'DM', activeServerId: null, activeChannelId: null, messages: [] });
      if (activeDmUserId) {
        get().fetchMessages(0);
      }
    },

    fetchServers: async () => {
      const token = useAuthStore.getState().token;
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE}/servers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const servers = await response.json();
          set({ servers });
          
          // Auto select first server if none selected
          if (servers.length > 0 && !get().activeServerId && get().activeMode === 'SERVER') {
            get().setActiveServerId(servers[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching servers', err);
      }
    },

    createServer: async (name, iconUrl) => {
      const token = useAuthStore.getState().token;
      if (!token) return false;

      try {
        const response = await fetch(`${API_BASE}/servers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, iconUrl }),
        });

        if (response.ok) {
          await get().fetchServers();
          return true;
        }
      } catch (err) {
        console.error('Error creating server', err);
      }
      return false;
    },

    joinServer: async (inviteCode) => {
      const token = useAuthStore.getState().token;
      if (!token) return false;

      try {
        const response = await fetch(`${API_BASE}/servers/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ inviteCode }),
        });

        if (response.ok) {
          await get().fetchServers();
          return true;
        }
      } catch (err) {
        console.error('Error joining server', err);
      }
      return false;
    },

    leaveServer: async (serverId) => {
      const token = useAuthStore.getState().token;
      if (!token) return false;

      try {
        const response = await fetch(`${API_BASE}/servers/${serverId}/leave`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          if (get().activeServerId === serverId) {
            set({ activeServerId: null, channels: [], activeChannelId: null });
          }
          await get().fetchServers();
          return true;
        }
      } catch (err) {
        console.error('Error leaving server', err);
      }
      return false;
    },

    fetchChannels: async (serverId) => {
      const token = useAuthStore.getState().token;
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE}/channels/server/${serverId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const channels = await response.json();
          set({ channels });
          
          // Auto select first channel
          if (channels.length > 0 && !get().activeChannelId) {
            get().setActiveChannelId(channels[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching channels', err);
      }
    },

    createChannel: async (serverId, name, type) => {
      const token = useAuthStore.getState().token;
      if (!token) return false;

      try {
        const response = await fetch(`${API_BASE}/channels/server/${serverId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, type }),
        });

        if (response.ok) {
          await get().fetchChannels(serverId);
          return true;
        }
      } catch (err) {
        console.error('Error creating channel', err);
      }
      return false;
    },

    deleteChannel: async (channelId) => {
      const token = useAuthStore.getState().token;
      if (!token) return false;

      try {
        const response = await fetch(`${API_BASE}/channels/${channelId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          if (get().activeChannelId === channelId) {
            set({ activeChannelId: null });
          }
          if (get().activeServerId) {
            await get().fetchChannels(get().activeServerId!);
          }
          return true;
        }
      } catch (err) {
        console.error('Error deleting channel', err);
      }
      return false;
    },

    fetchFriends: async () => {
      const token = useAuthStore.getState().token;
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const friends = await response.json();
          set({ friends });
        }
      } catch (err) {
        console.error('Error fetching contacts list', err);
      }
    },

    fetchMessages: async (page = 0) => {
      const token = useAuthStore.getState().token;
      if (!token) return;

      const { activeMode, activeChannelId, activeDmUserId } = get();
      let url = '';

      if (activeMode === 'SERVER' && activeChannelId) {
        url = `${API_BASE}/messages/channel/${activeChannelId}?page=${page}&size=40`;
      } else if (activeMode === 'DM' && activeDmUserId) {
        url = `${API_BASE}/messages/dm/${activeDmUserId}?page=${page}&size=40`;
      } else {
        return;
      }

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const list = await response.json();
          const reversed = [...list].reverse();
          
          if (page === 0) {
            set({ messages: reversed });
          } else {
            set((state) => ({ messages: [...reversed, ...state.messages] }));
          }
        }
      } catch (err) {
        console.error('Error fetching message history', err);
      }
    },

    connectSocket: () => {
      const token = useAuthStore.getState().token;
      if (!token) return;

      // Avoid double connection
      if (get().socket) return;

      const isLocal = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.')
      );

      const wsUrl = import.meta.env.VITE_WS_URL
        ? `${import.meta.env.VITE_WS_URL}?token=${token}`
        : (isLocal
          ? `ws://${window.location.hostname}:8080/ws?token=${token}`
          : `wss://nexus-production-ce6a.up.railway.app/ws?token=${token}`);

      // Clear any pending reconnect timers
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      isExplicitlyClosed = false;

      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        set({ connected: true, socket });
        reconnectAttempts = 0; // Reset on successful connection
        // Rejoin active channel room if any
        const { activeChannelId } = get();
        if (activeChannelId) {
          socket.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: `channel_${activeChannelId}` }));
        }
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { type } = data;

        if (type === 'CHAT_MESSAGE') {
          const { message } = data;
          const { activeMode, activeChannelId, activeDmUserId, friends } = get();

          // Instantly parse and add the partner to our inbox list if they aren't already present
          if (!message.channel && message.recipient) {
            const currentUserId = useAuthStore.getState().user?.id;
            const partner = message.sender.id === currentUserId ? message.recipient : message.sender;
            if (partner && partner.id !== currentUserId && !friends.some((f) => f.id === partner.id)) {
              set((state) => ({ friends: [...state.friends, partner] }));
            }
          }

          // Check if message belongs to currently open view
          let isCurrentView = false;
          if (activeMode === 'SERVER' && activeChannelId && message.channel?.id === activeChannelId) {
            isCurrentView = true;
          } else if (activeMode === 'DM' && activeDmUserId) {
            const currentUserId = useAuthStore.getState().user?.id;
            const isFromActiveDmUser = message.sender.id === activeDmUserId && message.recipient?.id === currentUserId;
            const isToActiveDmUser = message.sender.id === currentUserId && message.recipient?.id === activeDmUserId;
            if (isFromActiveDmUser || isToActiveDmUser) {
              isCurrentView = true;
            }
          }

          if (isCurrentView) {
            set((state) => {
              // Remove the optimistic placeholder if it exists (by checking temporary negative IDs)
              const filtered = state.messages.filter((m) => {
                if (m.id < 0 && m.content === message.content && m.sender.id === message.sender.id) {
                  return false;
                }
                // Prevent duplicate real IDs
                if (m.id === message.id) {
                  return false;
                }
                return true;
              });
              return { messages: [...filtered, message] };
            });
          }
        } else if (type === 'TYPING') {
          const { senderId, senderName, isTyping } = data;
          set((state) => {
            const updated = { ...state.typingUsers };
            if (isTyping) {
              updated[senderId] = senderName;
            } else {
              delete updated[senderId];
            }
            return { typingUsers: updated };
          });
        } else if (type === 'ROOM_USERS') {
          set({ activeRoomUsers: data.users });
          const webrtcRoomId = useWebRTCStore.getState().roomId;
          if (webrtcRoomId === data.roomId) {
            useWebRTCStore.getState().syncPeers(data.users);
          }
        } else if (type === 'SIGNAL') {
          useWebRTCStore.getState().handleIncomingSignal(data.senderId, data.signal);
        } else if (type === 'INCOMING_CALL') {
          const { senderId, senderName, roomId } = data;
          useWebRTCStore.getState().setIncomingCall({ senderId, senderName, roomId });
        } else if (type === 'DECLINE_CALL') {
          const { roomId, senderName } = data;
          const webrtcRoomId = useWebRTCStore.getState().roomId;
          if (webrtcRoomId === roomId) {
            useWebRTCStore.getState().leaveRoom();
            alert(`${senderName || 'The other user'} declined your call.`);
          }
        } else if (type === 'PRESENCE') {
          // Refresh friends list to show online badge updates
          get().fetchFriends();
        }
      };

      socket.onclose = () => {
        set({ connected: false, socket: null, activeRoomUsers: [] });

        // Auto-reconnect if not explicitly closed by user logout / disconnect
        if (!isExplicitlyClosed) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.warn(`WebSocket closed. Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})...`);
          reconnectAttempts++;
          reconnectTimer = setTimeout(() => {
            get().connectSocket();
          }, delay);
        }
      };
    },

    disconnectSocket: () => {
      isExplicitlyClosed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempts = 0;
      const socket = get().socket;
      if (socket) {
        socket.close();
      }
    },

    sendMessage: (content, options) => {
      const { socket, activeMode, activeChannelId, activeDmUserId } = get();
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      const user = useAuthStore.getState().user;
      if (!user) return;

      const event: any = {
        type: 'CHAT_MESSAGE',
        content,
        senderName: user.username,
        parentId: options?.parentId,
        fileUrl: options?.fileUrl,
        fileName: options?.fileName,
        fileType: options?.fileType,
      };

      if (activeMode === 'SERVER' && activeChannelId) {
        event.channelId = activeChannelId;
      } else if (activeMode === 'DM' && activeDmUserId) {
        event.recipientId = activeDmUserId;
      } else {
        return;
      }

      socket.send(JSON.stringify(event));

      // Add optimistic message to store instantly
      const optimisticMessage: Message = {
        id: -Date.now(), // negative id indicates optimistic message
        content,
        sender: user,
        channel: activeMode === 'SERVER' ? { id: activeChannelId } as any : null,
        recipient: activeMode === 'DM' ? { id: activeDmUserId } as any : null,
        parentMessage: options?.parentId ? { id: options.parentId } as any : null,
        fileUrl: options?.fileUrl,
        fileName: options?.fileName,
        fileType: options?.fileType,
        edited: false,
        deleted: false,
        reactions: [],
        createdAt: new Date().toISOString()
      };

      set((state) => ({ messages: [...state.messages, optimisticMessage] }));
    },

    sendTyping: (isTyping) => {
      const { socket, activeMode, activeChannelId } = get();
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      const user = useAuthStore.getState().user;
      let roomId = '';

      if (activeMode === 'SERVER' && activeChannelId) {
        roomId = `channel_${activeChannelId}`;
      } else {
        return; // Ignore typing indicators in DMs for standard dev
      }

      // Throttle outgoing typing alerts
      if (isTyping) {
        if (typingTimeout) return;
        
        socket.send(JSON.stringify({
          type: 'TYPING',
          roomId,
          senderName: user?.username,
          isTyping: true,
        }));

        typingTimeout = setTimeout(() => {
          typingTimeout = null;
        }, 2000);
      } else {
        if (typingTimeout) {
          clearTimeout(typingTimeout);
          typingTimeout = null;
        }
        socket.send(JSON.stringify({
          type: 'TYPING',
          roomId,
          senderName: user?.username,
          isTyping: false,
        }));
      }
    },
  };
});
