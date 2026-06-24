import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { Channel } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import type { User } from '../store/useAuthStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { Hash, Video, Plus, UserPlus, Check, X, Settings, Copy, CheckCheck } from 'lucide-react';

export const SidebarChannels: React.FC = () => {
  const { 
    activeMode, activeServerId, servers, channels, activeChannelId, setActiveChannelId,
    createChannel, deleteChannel, friends, fetchFriends, activeDmUserId, setActiveDmUserId
  } = useChatStore();

  const { user, token, updatePresence, updateStatus, updateAvatar } = useAuthStore();
  const { joinRoom } = useWebRTCStore();

  // Selected server details
  const currentServer = servers.find((s) => s.id === activeServerId);

  // States
  const [copied, setCopied] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'TEXT' | 'VIDEO'>('TEXT');

  // Friends & DM Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendError, setAddFriendError] = useState('');
  const [addFriendSuccess, setAddFriendSuccess] = useState('');

  // User Profile Status Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [customStatus, setCustomStatus] = useState(user?.statusMessage || '');
  const [avatarUrlInput, setAvatarUrlInput] = useState(user?.avatarUrl || '');
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);

  // Fetch pending requests & friends list
  const fetchPendingAndFriends = async () => {
    if (!token) return;
    await fetchFriends();
    try {
      const response = await fetch('http://localhost:8080/api/friends/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeMode === 'DM') {
      fetchPendingAndFriends();
    }
  }, [activeMode]);

  // Copy Invite Code
  const handleCopyInvite = () => {
    if (!currentServer) return;
    navigator.clipboard.writeText(currentServer.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Create Channel
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !activeServerId) return;
    const success = await createChannel(activeServerId, newChannelName.trim(), newChannelType);
    if (success) {
      setNewChannelName('');
      setShowChannelModal(false);
    }
  };

  // Add Friend Request
  const handleSendFriendRequest = async (receiverId: number) => {
    if (!token) return;
    setAddFriendError('');
    setAddFriendSuccess('');
    try {
      const response = await fetch('http://localhost:8080/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId }),
      });

      if (response.ok) {
        setAddFriendSuccess('Request sent successfully!');
        fetchPendingAndFriends();
        setSearchResults([]);
        setSearchQuery('');
      } else {
        const txt = await response.text();
        setAddFriendError(txt || 'Could not send request');
      }
    } catch (err: any) {
      setAddFriendError(err.message);
    }
  };

  // Accept Request
  const handleAcceptRequest = async (requestId: number) => {
    if (!token) return;
    try {
      const response = await fetch(`http://localhost:8080/api/friends/request/accept/${requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchPendingAndFriends();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Reject Request
  const handleRejectRequest = async (requestId: number) => {
    if (!token) return;
    try {
      const response = await fetch(`http://localhost:8080/api/friends/request/reject/${requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchPendingAndFriends();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // User Search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const response = await fetch(`http://localhost:8080/api/users/search?query=${searchQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const list = await response.json();
          // Filter out self and active friends
          const filtered = list.filter((u: User) => u.id !== user?.id && !friends.some((f) => f.id === u.id));
          setSearchResults(filtered);
        }
      } catch (e) {
        console.error(e);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Handle Channel Click (WebRTC if Video Room)
  const handleChannelClick = (channel: Channel) => {
    if (channel.type === 'VIDEO') {
      joinRoom(`channel_${channel.id}`);
    } else {
      setActiveChannelId(channel.id);
    }
  };

  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateStatus(customStatus);
    await updateAvatar(avatarUrlInput);
    setShowProfileModal(false);
  };

  const getPresenceColor = (presence?: string) => {
    switch (presence) {
      case 'ONLINE': return 'bg-accent-green';
      case 'AWAY': return 'bg-accent-orange';
      case 'DND': return 'bg-accent-red';
      default: return 'bg-dark-500';
    }
  };

  return (
    <div className="w-60 h-screen bg-[#13171e] flex flex-col justify-between border-r border-white/5 font-sans select-none text-slate-300">
      
      {/* Upper Content Section */}
      <div className="flex flex-col flex-1 overflow-hidden">
        
        {/* Header Block */}
        {activeMode === 'SERVER' && currentServer ? (
          <div className="p-4 border-b border-white/5 flex flex-col gap-2 bg-[#171c24]">
            <div className="flex justify-between items-center">
              <span className="font-bold text-white truncate max-w-[170px]">{currentServer.name}</span>
              {user?.id === currentServer.owner?.id && (
                <button
                  onClick={() => setShowChannelModal(true)}
                  className="p-1 hover:bg-dark-600 rounded text-accent-cyan hover:text-white transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Invite Info */}
            <div className="flex items-center justify-between text-[10px] text-dark-500 bg-black/20 px-2 py-1 rounded">
              <span className="font-mono uppercase tracking-wider">Invite: {currentServer.inviteCode}</span>
              <button
                onClick={handleCopyInvite}
                className="hover:text-white transition flex items-center gap-1"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-accent-cyan" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#171c24]">
            <span className="font-bold text-white text-sm">Direct Messages</span>
            <button
              onClick={() => {
                setShowAddFriend(!showAddFriend);
                setAddFriendError('');
                setAddFriendSuccess('');
              }}
              className="p-1 hover:bg-dark-600 rounded text-accent-cyan hover:text-white transition"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          
          {/* Add Friend Interface (DM Mode Only) */}
          {activeMode === 'DM' && showAddFriend && (
            <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-2">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Add Friend</h3>
              {addFriendError && <p className="text-[10px] text-accent-red mb-1.5">{addFriendError}</p>}
              {addFriendSuccess && <p className="text-[10px] text-accent-green mb-1.5">{addFriendSuccess}</p>}
              <input
                type="text"
                placeholder="Search username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded glass-input mb-2"
              />
              
              {searchResults.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-1 bg-[#1c222c] p-1.5 rounded border border-white/5">
                  {searchResults.map((sr) => (
                    <div key={sr.id} className="flex justify-between items-center p-1 rounded hover:bg-dark-600 text-xs">
                      <span className="text-white font-medium">{sr.username}</span>
                      <button
                        onClick={() => handleSendFriendRequest(sr.id)}
                        className="bg-brand-500 hover:bg-brand-400 text-white px-2 py-0.5 rounded text-[10px] transition"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending Requests Block (DM Mode Only) */}
          {activeMode === 'DM' && pendingRequests.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-dark-500 uppercase tracking-wider px-2 block mb-1">
                Pending Requests ({pendingRequests.length})
              </span>
              <div className="space-y-1">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-black/10 text-xs"
                  >
                    <span className="text-white truncate font-medium">{req.sender.username}</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAcceptRequest(req.id)}
                        className="p-1 rounded bg-accent-green/20 text-accent-green hover:bg-accent-green hover:text-dark-900 transition"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        className="p-1 rounded bg-accent-red/20 text-accent-red hover:bg-accent-red hover:text-white transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Channels List (Server Mode Only) */}
          {activeMode === 'SERVER' && (
            <>
              {/* Text Channels */}
              <div>
                <span className="text-[10px] font-bold text-dark-500 uppercase tracking-wider px-2 block mb-1">
                  Text Channels
                </span>
                <div className="space-y-0.5">
                  {channels.filter(c => c.type === 'TEXT').map((ch) => {
                    const isSelected = activeChannelId === ch.id;
                    return (
                      <div
                        key={ch.id}
                        className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-sm cursor-pointer transition ${
                          isSelected
                            ? 'bg-dark-600/50 text-white font-medium'
                            : 'hover:bg-dark-700/40 hover:text-slate-200'
                        }`}
                        onClick={() => handleChannelClick(ch)}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Hash className="w-4 h-4 text-dark-500" />
                          <span className="truncate">{ch.name}</span>
                        </div>
                        {user?.id === currentServer?.owner?.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteChannel(ch.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-accent-red transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Video Rooms */}
              <div>
                <span className="text-[10px] font-bold text-dark-500 uppercase tracking-wider px-2 block mb-1">
                  Video Rooms
                </span>
                <div className="space-y-0.5">
                  {channels.filter(c => c.type === 'VIDEO').map((ch) => {
                    return (
                      <div
                        key={ch.id}
                        className="group flex items-center justify-between px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-dark-700/40 hover:text-slate-200 transition"
                        onClick={() => handleChannelClick(ch)}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Video className="w-4 h-4 text-accent-cyan animate-pulse" />
                          <span className="truncate font-medium text-accent-cyan">{ch.name}</span>
                        </div>
                        {user?.id === currentServer?.owner?.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteChannel(ch.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-accent-red transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* DMs / Friends List (DM Mode Only) */}
          {activeMode === 'DM' && (
            <div>
              <span className="text-[10px] font-bold text-dark-500 uppercase tracking-wider px-2 block mb-1">
                Active Friends ({friends.length})
              </span>
              <div className="space-y-0.5">
                {friends.length === 0 ? (
                  <p className="text-[10px] text-dark-500 px-2 py-4 text-center">No friends added yet. Press the + icon above to search!</p>
                ) : (
                  friends.map((fr) => {
                    const isSelected = activeDmUserId === fr.id;
                    return (
                      <div
                        key={fr.id}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-dark-600/50 text-white font-medium'
                            : 'hover:bg-dark-700/40 hover:text-slate-200'
                        }`}
                        onClick={() => setActiveDmUserId(fr.id)}
                      >
                        {/* Avatar and status indicator */}
                        <div className="relative">
                          {fr.avatarUrl ? (
                            <img src={fr.avatarUrl} alt={fr.username} className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-dark-600 flex items-center justify-center font-bold text-white text-[10px]">
                              {fr.username.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#13171e] ${getPresenceColor(fr.presence)}`} />
                        </div>
                        
                        <div className="flex flex-col min-w-0">
                          <span className="text-white truncate font-medium">{fr.username}</span>
                          {fr.statusMessage && (
                            <span className="text-[9px] text-dark-500 truncate">{fr.statusMessage}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* User Profile Strip (Bottom Footer) */}
      {user && (
        <div className="p-3 bg-[#171c24] border-t border-white/5 flex items-center justify-between relative">
          <div className="flex items-center gap-2 min-w-0">
            
            {/* Click Avatar to toggle Presence Menu */}
            <div className="relative cursor-pointer group" onClick={() => setPresenceMenuOpen(!presenceMenuOpen)}>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8.5 h-8.5 rounded-full object-cover border border-white/10"
                />
              ) : (
                <div className="w-8.5 h-8.5 rounded-full bg-brand-600 flex items-center justify-center font-bold text-white text-xs">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
              )}
              {/* Presence Dot */}
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#171c24] ${getPresenceColor(user.presence)}`} />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate">{user.username}</span>
              <span className="text-[9px] text-dark-500 truncate">
                {user.statusMessage || `#${user.id}`}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setCustomStatus(user.statusMessage || '');
              setAvatarUrlInput(user.avatarUrl || '');
              setShowProfileModal(true);
            }}
            className="p-1 text-dark-500 hover:text-white hover:bg-dark-600 rounded transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Presence Dropdown Menu */}
          {presenceMenuOpen && (
            <div className="absolute bottom-[56px] left-3 z-50 w-44 rounded-xl glass-panel p-1.5 shadow-2xl border border-white/10">
              <div className="text-[9px] font-bold text-dark-500 px-2 py-1 uppercase tracking-wider">Set Status</div>
              <button
                onClick={() => { updatePresence('ONLINE'); setPresenceMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-lg hover:bg-dark-600 text-white font-medium"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-accent-green" /> Online
              </button>
              <button
                onClick={() => { updatePresence('AWAY'); setPresenceMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-lg hover:bg-dark-600 text-white font-medium"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-accent-orange" /> Idle / Away
              </button>
              <button
                onClick={() => { updatePresence('DND'); setPresenceMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-lg hover:bg-dark-600 text-white font-medium"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-accent-red" /> Do Not Disturb
              </button>
              <button
                onClick={() => { updatePresence('OFFLINE'); setPresenceMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-lg hover:bg-dark-600 text-white font-medium"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-dark-500" /> Invisible
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Channel Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl glass-panel shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-1">Create Channel</h2>
            <p className="text-xs text-dark-500 mb-4 font-medium">Add text chatting or real-time voice call rooms.</p>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-1.5">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. general-talk"
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-1.5">
                  Channel Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewChannelType('TEXT')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      newChannelType === 'TEXT'
                        ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20'
                        : 'border-white/10 text-dark-500 hover:bg-dark-600'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" /> Text Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannelType('VIDEO')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      newChannelType === 'VIDEO'
                        ? 'bg-accent-cyan border-accent-cyan text-dark-900 shadow-lg shadow-accent-cyan/20'
                        : 'border-white/10 text-dark-500 hover:bg-dark-600'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" /> Video Room
                  </button>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl glass-panel shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-1">Operator Profile</h2>
            <p className="text-xs text-dark-500 mb-4 font-medium">Update your digital identification and status details.</p>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-1.5">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-1.5">
                  Status message
                </label>
                <input
                  type="text"
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="Gaming, Coding..."
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input font-medium"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-accent-cyan hover:bg-accent-cyan/85 text-dark-900 text-xs font-bold transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
