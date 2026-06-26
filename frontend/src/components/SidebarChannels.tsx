import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { Message } from '../store/useChatStore';
import { useAuthStore, API_BASE, type User } from '../store/useAuthStore';
import { Settings, LogOut, Search, MessageSquare, CheckCheck, X, FolderArchive, HelpCircle, UserCheck } from 'lucide-react';

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

  // Replaces standard green dots with monochrome geometric shapes (Nothing OS philosophy)
  const renderPresenceSquare = (presence?: string) => {
    switch (presence) {
      case 'ONLINE':
        return (
          <div className="w-2.5 h-2.5 bg-white border border-white shrink-0" title="Active" />
        );
      case 'AWAY':
        return (
          <div className="w-2.5 h-2.5 bg-transparent border border-white shrink-0" title="Idle" />
        );
      case 'DND':
        return (
          <div className="w-2.5 h-2.5 bg-zinc-800 border border-white shrink-0 flex items-center justify-center text-[7px] text-white font-mono leading-none" title="DND">
            ×
          </div>
        );
      default:
        return (
          <div className="w-2.5 h-2.5 bg-transparent border border-zinc-700 shrink-0" title="Offline" />
        );
    }
  };

  const formatLastMessageTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'YEST';
    }
    
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Filter local contacts based on search query, excluding the current logged-in user
  const filteredContacts = [...friends.filter((contact) =>
    contact.id !== user?.id && (
      contact.username.toLowerCase().includes(filterQuery.toLowerCase()) ||
      contact.userTag?.toLowerCase().includes(filterQuery.toLowerCase())
    )
  )];

  // Merge backend search results, excluding the current logged-in user
  searchResults.forEach((res) => {
    if (res.id !== user?.id && !filteredContacts.some((c) => c.id === res.id)) {
      filteredContacts.push(res);
    }
  });

  return (
    <div className="w-full h-full flex bg-black font-sans text-white rounded-none select-none">
      
      {/* LEFT SIDEBAR: Ultra-thin monochrome icon navigation dock */}
      <div className="w-12 h-full flex flex-col justify-between items-center py-4 bg-black border-r border-zinc-900 shrink-0">
        
        {/* Top: Branding & Navigation group */}
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="w-8 h-8 flex items-center justify-center font-mono font-black text-lg border-2 border-white select-none">
            N
          </div>
          
          <button 
            className="p-2 text-white bg-white/10 border border-white/20 rounded-none hover:bg-white hover:text-black kinematic-transition"
            title="Chats"
          >
            <MessageSquare className="w-4.5 h-4.5" />
          </button>
          
          <button 
            className="p-2 text-zinc-500 hover:text-white rounded-none hover:bg-white/5 kinematic-transition"
            title="Archived"
          >
            <FolderArchive className="w-4.5 h-4.5" />
          </button>

          <button 
            className="p-2 text-zinc-500 hover:text-white rounded-none hover:bg-white/5 kinematic-transition"
            title="Operators"
          >
            <UserCheck className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Bottom: Settings & Logout */}
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            onClick={() => {
              setCustomStatus(user?.statusMessage || '');
              setAvatarUrlInput(user?.avatarUrl || '');
              setShowProfileModal(true);
            }}
            className="p-2 text-zinc-500 hover:text-white rounded-none hover:bg-white/5 kinematic-transition"
            title="Profile Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
          
          <button
            onClick={logout}
            className="p-2 text-zinc-500 hover:text-red-400 rounded-none hover:bg-red-500/10 kinematic-transition"
            title="Exit Session"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Search & Active Thread List */}
      <div className="flex-1 h-full flex flex-col min-w-0 bg-black">
        
        {/* Header Block (Branding & User Indicator) */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative cursor-pointer" onClick={() => setPresenceMenuOpen(!presenceMenuOpen)}>
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 object-cover border border-white/10 rounded-none filter grayscale contrast-120"
                />
              ) : (
                <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center font-mono font-bold text-white text-xs border border-white/20 rounded-none">
                  {user?.username?.substring(0, 2).toUpperCase()}
                </div>
              )}
              {/* Geometric Status indicator */}
              <div className="absolute -bottom-1 -right-1">
                {renderPresenceSquare(user?.presence)}
              </div>
            </div>

            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-xs font-mono font-black text-white uppercase tracking-wider truncate">{user?.username}</span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest truncate mt-0.5">
                {user?.presence}
              </span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-zinc-500 select-all tracking-tight border border-zinc-900 px-2 py-1">
            @{user?.userTag || user?.username}
          </div>
        </div>

        {/* Presence Selector Dropdown */}
        {presenceMenuOpen && (
          <div className="absolute top-[60px] left-[60px] z-50 w-44 rounded-none bg-black border border-white/20 p-1 animate-scale-in">
            <div className="text-[8px] font-mono font-black text-zinc-500 px-2.5 py-1.5 uppercase tracking-widest border-b border-zinc-900 mb-1">
              Select Status
            </div>
            <button
              onClick={() => { updatePresence('ONLINE'); setPresenceMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[10px] text-left rounded-none hover:bg-white hover:text-black font-mono font-bold uppercase kinematic-transition"
            >
              <div className="w-2 h-2 bg-white" /> Online
            </button>
            <button
              onClick={() => { updatePresence('AWAY'); setPresenceMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[10px] text-left rounded-none hover:bg-white hover:text-black font-mono font-bold uppercase kinematic-transition"
            >
              <div className="w-2 h-2 border border-white bg-transparent" /> Away
            </button>
            <button
              onClick={() => { updatePresence('DND'); setPresenceMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[10px] text-left rounded-none hover:bg-white hover:text-black font-mono font-bold uppercase kinematic-transition"
            >
              <div className="w-2 h-2 border border-white bg-zinc-800 flex items-center justify-center text-[6px] text-white">×</div> DND
            </button>
            <button
              onClick={() => { updatePresence('OFFLINE'); setPresenceMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[10px] text-left rounded-none hover:bg-white hover:text-black font-mono font-bold uppercase kinematic-transition"
            >
              <div className="w-2 h-2 border border-zinc-700 bg-transparent" /> Invisible
            </button>
          </div>
        )}

        {/* Stark Search Input */}
        <div className="p-3 border-b border-zinc-900 shrink-0">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-zinc-500">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="SEARCH OPERATOR..."
              className="w-full pl-9 pr-4 py-2.5 text-[10px] font-mono bg-zinc-950 border border-zinc-900 rounded-none text-white placeholder-zinc-600 focus:outline-none focus:border-white/30 transition uppercase tracking-wider"
            />
          </div>
        </div>

        {/* Contacts Inbox List */}
        <div className="flex-1 overflow-y-auto py-1 space-y-px">
          {filteredContacts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-6 text-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">No active sessions</span>
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = activeDmUserId === contact.id;
              const lastMsg = lastMessages[contact.id];
              const isTyping = typingUsers[contact.id] !== undefined;

              let lastMsgText = contact.statusMessage || "NO MESSAGE HISTORY";
              if (isTyping) {
                lastMsgText = "TYPING...";
              } else if (lastMsg) {
                if (lastMsg.deleted) {
                  lastMsgText = "MESSAGE DELETED";
                } else if (lastMsg.fileUrl) {
                  lastMsgText = lastMsg.fileType?.startsWith('image/') ? "[IMAGE]" : "[ATTACHMENT]";
                } else {
                  const prefix = lastMsg.sender.id === user?.id ? "YOU: " : "";
                  lastMsgText = `${prefix}${lastMsg.content}`;
                }
              }

              return (
                <div
                  key={contact.id}
                  onClick={() => setActiveDmUserId(contact.id)}
                  className={`flex items-center justify-between mx-1.5 px-3 py-3.5 cursor-pointer rounded-none select-none border border-transparent kinematic-transition ${
                    isSelected 
                      ? 'bg-white text-black border-white' 
                      : 'hover:bg-zinc-950 hover:border-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {contact.avatarUrl ? (
                        <img
                          src={contact.avatarUrl}
                          alt={contact.username}
                          className={`w-9 h-9 object-cover border rounded-none filter grayscale contrast-120 ${
                            isSelected ? 'border-black' : 'border-white/10'
                          }`}
                        />
                      ) : (
                        <div className={`w-9 h-9 flex items-center justify-center font-mono font-bold text-xs border rounded-none ${
                          isSelected ? 'bg-black text-white border-black' : 'bg-zinc-900 text-zinc-300 border-white/10'
                        }`}>
                          {contact.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      {/* Status indicator */}
                      <div className="absolute -bottom-1 -right-1">
                        {renderPresenceSquare(contact.presence)}
                      </div>
                    </div>

                    <div className="flex flex-col min-w-0 gap-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-xs font-mono font-black uppercase truncate ${
                          isSelected ? 'text-black' : 'text-zinc-100'
                        }`}>{contact.username}</span>
                        {contact.userTag && (
                          <span className={`text-[8px] font-mono shrink-0 uppercase tracking-tight ${
                            isSelected ? 'text-zinc-700' : 'text-zinc-500'
                          }`}>
                            @{contact.userTag.split('_')[0]}
                          </span>
                        )}
                      </div>
                      <span className={`text-[9px] font-mono truncate leading-none ${
                        isTyping 
                          ? (isSelected ? 'text-black font-black animate-pulse' : 'text-white font-black animate-pulse') 
                          : (isSelected ? 'text-zinc-800' : 'text-zinc-500')
                      }`}>
                        {lastMsgText.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* High contrast Dot-matrix-like unread / status notification indicator */}
                  {lastMsg && !isTyping && (
                    <div className="flex flex-col items-end shrink-0 gap-1 pl-2 text-right">
                      <span className={`text-[8px] font-mono uppercase tracking-wider ${
                        isSelected ? 'text-zinc-700' : 'text-zinc-600'
                      }`}>
                        {formatLastMessageTime(lastMsg.createdAt)}
                      </span>
                      {lastMsg.sender.id === user?.id && (
                        <span className={isSelected ? 'text-black' : 'text-zinc-400'}>
                          <CheckCheck className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Profile Settings Modal Overlay (Stark sharp border card) */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-75">
          <div className="w-full max-w-sm p-6 rounded-none bg-black border border-white shadow-none flex flex-col gap-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <h2 className="text-xs font-mono font-black uppercase tracking-widest text-white">OP_SETTINGS</h2>
              <button 
                onClick={() => setShowProfileModal(false)} 
                className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-900 rounded-none kinematic-transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider leading-relaxed">
              Configure parameters for active operator session.
            </p>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400 mb-1.5">
                  OPERATOR_TAG
                </label>
                <div 
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-950 border border-zinc-900 text-white font-bold select-all cursor-pointer rounded-none uppercase"
                  title="Double click to copy"
                >
                  @{user?.userTag || user?.username}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400 mb-1.5">
                  AVATAR_IMAGE_URL
                </label>
                <input
                  type="url"
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-950 border border-zinc-900 text-white placeholder-zinc-700 focus:outline-none focus:border-white transition rounded-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400 mb-1.5">
                  STATUS_MESSAGE
                </label>
                <input
                  type="text"
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="HEY THERE. OPERATING NEXUS CONSOLE."
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-950 border border-zinc-900 text-white placeholder-zinc-700 focus:outline-none focus:border-white transition rounded-none uppercase"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 rounded-none bg-zinc-950 border border-zinc-900 text-zinc-400 text-[10px] font-mono font-black uppercase hover:bg-zinc-900 hover:text-white kinematic-transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-none bg-white text-black border border-white text-[10px] font-mono font-black uppercase hover:bg-black hover:text-white kinematic-transition"
                >
                  Save Params
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
