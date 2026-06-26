import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { Message } from '../store/useChatStore';
import { useAuthStore, API_BASE, type User } from '../store/useAuthStore';
import { Settings, LogOut, Search, MessageSquare, CheckCheck, X } from 'lucide-react';

export const SidebarChannels: React.FC = () => {
  const { 
    friends, fetchFriends, activeDmUserId, setActiveDmUserId, messages, typingUsers
  } = useChatStore();

  const { user, token, updatePresence, updateStatus, updateAvatar, logout } = useAuthStore();

  // States
  const [filterQuery, setFilterQuery] = useState('');
  const [lastMessages, setLastMessages] = useState<Record<number, Message>>({});
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [customStatus, setCustomStatus] = useState(user?.statusMessage || '');
  const [avatarUrlInput, setAvatarUrlInput] = useState(user?.avatarUrl || '');
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);

  // Search backend when query changes (debounced)
  useEffect(() => {
    const searchBackend = async () => {
      if (!filterQuery.trim() || !token) {
        setSearchResults([]);
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/users/search?query=${encodeURIComponent(filterQuery.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (e) {
        console.error("Search failed", e);
      }
    };

    const timeout = setTimeout(searchBackend, 300);
    return () => clearTimeout(timeout);
  }, [filterQuery, token]);

  // Fetch friends (contacts) on load or when token changes
  useEffect(() => {
    if (token) {
      fetchFriends();
    }
  }, [token]);

  // Fetch last message for each friend/contact
  useEffect(() => {
    if (friends.length > 0 && token) {
      friends.forEach(async (friend) => {
        try {
          const response = await fetch(`${API_BASE}/messages/dm/${friend.id}?page=0&size=1`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const list = await response.json();
            if (list.length > 0) {
              setLastMessages(prev => ({ ...prev, [friend.id]: list[0] }));
            }
          }
        } catch (e) {
          console.error(`Error fetching last message for user ${friend.id}`, e);
        }
      });
    }
  }, [friends, messages, token]);

  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateStatus(customStatus);
    await updateAvatar(avatarUrlInput);
    setShowProfileModal(false);
  };

  const getPresenceColor = (presence?: string) => {
    switch (presence) {
      case 'ONLINE': return 'bg-[#00a884]'; // WhatsApp Green
      case 'AWAY': return 'bg-[#e1ba10]'; // Honey Gold
      case 'DND': return 'bg-[#ea0038]'; // Crimson Red
      default: return 'bg-[#8696a0]'; // Muted Grey
    }
  };

  const formatLastMessageTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Else show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Filter local contacts based on search query
  const filteredContacts = [...friends.filter((contact) =>
    contact.username.toLowerCase().includes(filterQuery.toLowerCase()) ||
    contact.userTag?.toLowerCase().includes(filterQuery.toLowerCase())
  )];

  // Merge backend search results
  searchResults.forEach((res) => {
    if (!filteredContacts.some((c) => c.id === res.id)) {
      filteredContacts.push(res);
    }
  });

  return (
    <div className="w-full h-full bg-[#111b21] flex flex-col justify-between border-r border-[#222e35] font-sans select-none text-slate-100">
      
      {/* 1. Header Block (Sleek User Profile and Tools) */}
      <div className="h-16 px-4 flex items-center justify-between bg-[#202c33] border-b border-[#222e35] shrink-0">
        
        {/* Left: User info and Presence menu trigger */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative cursor-pointer group" onClick={() => setPresenceMenuOpen(!presenceMenuOpen)}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-10 h-10 rounded-full object-cover border border-white/10 group-hover:opacity-85 transition"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#005c4b] flex items-center justify-center font-bold text-white text-sm group-hover:opacity-85 transition">
                {user?.username?.substring(0, 2).toUpperCase()}
              </div>
            )}
            {/* Online Status Ring */}
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#202c33] ${getPresenceColor(user?.presence)}`} />
          </div>

          <div className="flex flex-col min-w-0 gap-0.5">
            <span className="text-sm font-bold text-slate-200 truncate">{user?.username}</span>
            <span 
              className="text-[10px] text-[#00a884] font-bold truncate select-all cursor-pointer hover:underline"
              title="Click to select and copy your unique ID"
            >
              {user?.userTag ? `@${user.userTag}` : `@${user?.username}`}
            </span>
            <span className="text-[9px] text-[#8696a0] truncate font-medium">
              {user?.statusMessage || "Online"}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setCustomStatus(user?.statusMessage || '');
              setAvatarUrlInput(user?.avatarUrl || '');
              setShowProfileModal(true);
            }}
            className="p-2 text-[#aebac1] hover:text-white hover:bg-[#374248] rounded-full transition"
            title="Profile Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          <button
            onClick={logout}
            className="p-2 text-[#aebac1] hover:text-red-400 hover:bg-[#374248] rounded-full transition"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Presence Selector Dropdown */}
        {presenceMenuOpen && (
          <div className="absolute top-[60px] left-3 z-50 w-48 rounded-xl bg-[#233138] border border-[#2f3b43] p-1.5 shadow-2xl">
            <div className="text-[9px] font-bold text-[#8696a0] px-2 py-1 uppercase tracking-wider">Set Status</div>
            <button
              onClick={() => { updatePresence('ONLINE'); setPresenceMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-lg hover:bg-[#182229] text-slate-200 font-semibold"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#00a884]" /> Online
            </button>
            <button
              onClick={() => { updatePresence('AWAY'); setPresenceMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-lg hover:bg-[#182229] text-slate-200 font-semibold"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#e1ba10]" /> Idle / Away
            </button>
            <button
              onClick={() => { updatePresence('DND'); setPresenceMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-lg hover:bg-[#182229] text-slate-200 font-semibold"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#ea0038]" /> Do Not Disturb
            </button>
            <button
              onClick={() => { updatePresence('OFFLINE'); setPresenceMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-lg hover:bg-[#182229] text-slate-200 font-semibold"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#8696a0]" /> Offline / Invisible
            </button>
          </div>
        )}
      </div>

      {/* 2. WhatsApp Search Input Box */}
      <div className="p-2 bg-[#111b21] border-b border-[#222e35] shrink-0">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-[#8696a0]">
            <Search className="w-4.5 h-4.5" />
          </span>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full pl-10 pr-4 py-1.5 text-xs bg-[#202c33] border-none rounded-lg text-slate-200 placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884] font-medium"
          />
        </div>
      </div>

      {/* 3. Conversations/Contacts Inbox List */}
      <div className="flex-1 overflow-y-auto bg-[#111b21] divide-y divide-[#222e35]">
        {filteredContacts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#8696a0] p-4 text-center gap-2">
            <MessageSquare className="w-12 h-12 text-[#2f3b43]" />
            <span className="text-xs font-semibold">No contacts found</span>
            <p className="text-[10px] text-[#667781] max-w-[200px]">Make sure other users are registered on your server.</p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isSelected = activeDmUserId === contact.id;
            const lastMsg = lastMessages[contact.id];
            const isTyping = typingUsers[contact.id] !== undefined;

            // Compute last message text display
            let lastMsgText = contact.statusMessage || "Click to start chatting!";
            if (isTyping) {
              lastMsgText = "typing...";
            } else if (lastMsg) {
              if (lastMsg.deleted) {
                lastMsgText = "This message was deleted.";
              } else if (lastMsg.fileUrl) {
                if (lastMsg.fileType?.startsWith('image/')) {
                  lastMsgText = "📷 Photo";
                } else if (lastMsg.fileType?.startsWith('audio/')) {
                  lastMsgText = "🎙️ Voice Note";
                } else if (lastMsg.fileType?.startsWith('video/')) {
                  lastMsgText = "🎥 Video";
                } else {
                  lastMsgText = "📎 Attachment";
                }
              } else {
                const prefix = lastMsg.sender.id === user?.id ? "You: " : "";
                lastMsgText = `${prefix}${lastMsg.content}`;
              }
            }

            return (
              <div
                key={contact.id}
                onClick={() => setActiveDmUserId(contact.id)}
                className={`flex items-center justify-between px-3 py-3 cursor-pointer transition select-none ${
                  isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                }`}
              >
                {/* Profile photo and online state */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {contact.avatarUrl ? (
                      <img
                        src={contact.avatarUrl}
                        alt={contact.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#3d4b53] flex items-center justify-center font-bold text-slate-200 text-sm">
                        {contact.username.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    {/* Active State indicator */}
                    <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border border-[#111b21] ${getPresenceColor(contact.presence)}`} />
                  </div>

                  <div className="flex flex-col min-w-0 gap-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-semibold text-slate-100 truncate">{contact.username}</span>
                      {contact.userTag && (
                        <span className="text-[10px] text-[#00a884] font-medium shrink-0">
                          @{contact.userTag}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] truncate font-medium ${
                      isTyping ? 'text-[#00a884] font-bold animate-pulse' : 'text-[#8696a0]'
                    }`}>
                      {lastMsgText}
                    </span>
                  </div>
                </div>

                {/* Date & Unread marker info */}
                {lastMsg && !isTyping && (
                  <div className="flex flex-col items-end shrink-0 gap-1.5 pl-2 text-right">
                    <span className="text-[10px] text-[#8696a0] font-medium">
                      {formatLastMessageTime(lastMsg.createdAt)}
                    </span>
                    {/* Show tick indicators if sent by current user */}
                    {lastMsg.sender.id === user?.id && (
                      <span className="text-[#53bdeb]">
                        <CheckCheck className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Edit Profile Modal Overlay */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[#222e35] border border-[#2f3b43] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-slate-100">Profile Settings</h2>
              <button 
                onClick={() => setShowProfileModal(false)} 
                className="text-[#aebac1] hover:text-white p-1 hover:bg-[#374248] rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-[#8696a0] mb-4">Set your avatar URL and status text visible to other operators.</p>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8696a0] mb-1.5">
                  Your Unique ID (Share with friends)
                </label>
                <div 
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#182229] border border-[#2f3b43] text-[#00a884] font-bold select-all cursor-pointer"
                  title="Double-click to select and copy handle"
                >
                  {user?.userTag ? `@${user.userTag}` : `@${user?.username}`}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8696a0] mb-1.5">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#2a3942] border border-[#2f3b43] text-white focus:outline-none focus:border-[#00a884] font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8696a0] mb-1.5">
                  About Status
                </label>
                <input
                  type="text"
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="Hey there! I am using Nexus Chat."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#2a3942] border border-[#2f3b43] text-white focus:outline-none focus:border-[#00a884] font-medium"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#374248] hover:bg-[#2a3942] text-slate-200 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#00c298] text-white text-xs font-bold transition shadow-md shadow-[#00a884]/20"
                >
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
