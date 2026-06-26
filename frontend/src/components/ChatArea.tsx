import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { Message } from '../store/useChatStore';
import { useAuthStore, API_BASE } from '../store/useAuthStore';
import type { User } from '../store/useAuthStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { Send, Paperclip, Smile, Edit2, Trash2, CornerUpLeft, X, Video, Image, FileText, MessageSquare, ArrowLeft, CheckCheck } from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { 
    messages, activeMode, activeDmUserId, friends, sendMessage, sendTyping, typingUsers, setActiveDmUserId, connected
  } = useChatStore();

  const { user, token } = useAuthStore();
  const { joinRoom } = useWebRTCStore();

  // References
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  // States
  const [inputText, setInputText] = useState('');
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [fetchedFriend, setFetchedFriend] = useState<User | null>(null);
  
  // File Upload states
  const [uploading, setUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Auto Scroll to bottom
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    messageEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages, typingUsers]);

  // Fetch active DM user details if they aren't in local contact list
  useEffect(() => {
    if (activeMode !== 'DM' || !activeDmUserId) {
      setFetchedFriend(null);
      return;
    }

    const found = friends.find(f => f.id === activeDmUserId);
    if (found) {
      setFetchedFriend(found);
    } else {
      if (!token) return;
      fetch(`${API_BASE}/users/${activeDmUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('User not found');
      })
      .then(data => {
        setFetchedFriend(data);
      })
      .catch(e => {
        console.error("Failed to load user details", e);
        setFetchedFriend(null);
      });
    }
  }, [activeDmUserId, friends, activeMode, token]);

  // Typing timer
  const localTypingTimeoutRef = useRef<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    
    if (!isTypingLocal) {
      setIsTypingLocal(true);
      sendTyping(true);
    }

    if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
    localTypingTimeoutRef.current = setTimeout(() => {
      setIsTypingLocal(false);
      sendTyping(false);
    }, 2500);
  };

  // Drag and Drop files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await uploadFile(file);
    }
  };

  // Upload File API
  const uploadFile = async (file: File) => {
    if (!token) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/messages/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setAttachedFile({
          url: data.fileUrl,
          name: data.fileName,
          type: data.fileType,
        });
      }
    } catch (e) {
      console.error("File upload failed", e);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  // Send Message
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedFile) return;

    if (!connected) {
      alert("Connection lost. Please wait while we reconnect to the chat server...");
      return;
    }

    sendMessage(inputText.trim(), {
      parentId: replyToMessage?.id,
      fileUrl: attachedFile?.url,
      fileName: attachedFile?.name,
      fileType: attachedFile?.type,
    });

    setInputText('');
    setReplyToMessage(null);
    setAttachedFile(null);
    setIsTypingLocal(false);
    sendTyping(false);
  };

  // Edit Message API
  const handleEditSubmit = async (messageId: number) => {
    if (!editText.trim() || !token) return;
    try {
      const response = await fetch(`${API_BASE}/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (response.ok) {
        // Refresh active log
        useChatStore.getState().fetchMessages(0);
        setEditingMessageId(null);
        setEditText('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Message API
  const handleDeleteMessage = async (messageId: number) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        useChatStore.getState().fetchMessages(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add/Remove Reaction API
  const handleToggleReaction = async (messageId: number, emoji: string, alreadyReacted: boolean) => {
    if (!token) return;
    const method = alreadyReacted ? 'DELETE' : 'POST';
    try {
      const response = await fetch(`${API_BASE}/messages/${messageId}/react?emoji=${encodeURIComponent(emoji)}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        useChatStore.getState().fetchMessages(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Start DM video call
  const handleDMCall = () => {
    if (activeDmUserId) {
      // Create a unique room ID for the 1-to-1 call
      const roomId = `dm_${Math.min(user!.id, activeDmUserId)}_${Math.max(user!.id, activeDmUserId)}`;
      joinRoom(roomId);
    }
  };

  // Active view titles
  let title = '';
  let subTitle = '';
  let showCallButton = false;
  let activeFriend: User | null = null;

  if (activeMode === 'SERVER') {
    title = 'Server Room';
  } else {
    activeFriend = fetchedFriend;
    title = activeFriend ? activeFriend.username : 'Loading...';
    subTitle = activeFriend?.statusMessage || (activeFriend ? activeFriend.presence.toLowerCase() : '');
    showCallButton = !!activeFriend;
  }

  // Format date helper
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPresenceColor = (presence?: string) => {
    switch (presence) {
      case 'ONLINE': return 'bg-[#10b981]'; // Emerald Green
      case 'AWAY': return 'bg-[#f59e0b]'; // Amber Gold
      case 'DND': return 'bg-[#f43f5e]'; // Rose Red
      default: return 'bg-[#71717a]'; // Zinc Grey
    }
  };

  return (
    <div 
      ref={chatAreaRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 h-screen bg-zinc-950 flex flex-col justify-between overflow-hidden relative ${
        dragOver ? 'border-2 border-dashed border-indigo-500 bg-indigo-500/5' : ''
      }`}
    >
      {/* Premium ambient glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-zinc-950 to-zinc-950 pointer-events-none z-0" />
      
      {/* Header */}
      {title && (
        <div className="h-16 px-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md shrink-0 z-10 relative shadow-sm">
          <div className="flex items-center min-w-0 flex-1 mr-4">
            {/* Back Button for mobile navigation */}
            <button
              onClick={() => setActiveDmUserId(null)}
              className="md:hidden p-1.5 mr-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-900 transition flex items-center justify-center shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Active Contact profile picture */}
            {activeFriend && (
              <div className="relative shrink-0 mr-3">
                {activeFriend.avatarUrl ? (
                  <img src={activeFriend.avatarUrl} alt={activeFriend.username} className="w-10 h-10 rounded-full object-cover border border-white/5" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white text-sm">
                    {activeFriend.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                {/* Active State indicator */}
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-950 ${getPresenceColor(activeFriend.presence)}`} />
              </div>
            )}

            <div className="flex flex-col min-w-0">
              <span className="text-sm sm:text-base font-bold text-zinc-100 truncate leading-tight">{title}</span>
              {subTitle && (
                <span className="text-[10px] sm:text-[11px] text-zinc-500 truncate font-semibold uppercase tracking-wider leading-none mt-1">
                  {subTitle}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {showCallButton && (
              <button
                onClick={handleDMCall}
                className="p-2.5 text-indigo-400 hover:text-indigo-300 hover:bg-zinc-900 rounded-full transition flex items-center justify-center shrink-0"
                title="Start Video Call"
              >
                <Video className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Drag Over Overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-indigo-500/10 backdrop-blur-xs flex items-center justify-center pointer-events-none z-40">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-3 shadow-2xl">
            <Paperclip className="w-10 h-10 text-indigo-500 animate-bounce" />
            <span className="text-sm font-bold text-white">Drop files to attach to chat</span>
          </div>
        </div>
      )}

      {/* Message History list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 scrollbar-thin z-10 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#8696a0] gap-2 select-none">
            <MessageSquare className="w-12 h-12 text-[#2f3b43]" />
            <span className="text-xs font-semibold">No messages yet. Send a message to start chatting!</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender.id === user?.id;
            
            // Check if user reacted to this message
            const hasUserReacted = (emoji: string) => {
              return msg.reactions.some((r) => r.emoji === emoji && r.user.id === user?.id);
            };

            // Group reactions by emoji
            const reactionCounts = msg.reactions.reduce((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            return (
              <div 
                key={msg.id} 
                className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} group relative px-1 py-0.5 animate-message-pop`}
              >
                {/* Message block */}
                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  
                  {/* Message Bubble (Premium Snappy Design) */}
                  <div className={`relative rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-sm break-words transition-all duration-200 ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-zinc-900 text-zinc-100 rounded-tl-none border border-zinc-800'
                  } ${msg.deleted ? 'italic text-zinc-500 bg-opacity-40' : ''}`}>
                    
                    {/* Thread reply details inside the bubble */}
                    {msg.parentMessage && (
                      <div className={`mb-2 p-2.5 rounded-xl text-[10px] border-l-2 flex flex-col gap-0.5 ${
                        isMe 
                          ? 'bg-black/15 border-white/20 text-zinc-200' 
                          : 'bg-black/20 border-indigo-500 text-zinc-300'
                      }`}>
                        <span className="font-bold text-white">@{msg.parentMessage.sender.username}</span>
                        <span className="truncate max-w-[220px]">{msg.parentMessage.content}</span>
                      </div>
                    )}

                    {/* Text content / Editing input */}
                    {editingMessageId === msg.id ? (
                      <div className="flex gap-1.5 items-center min-w-[200px] mt-1">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-black/30 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleEditSubmit(msg.id)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <p className={`text-[13px] leading-relaxed break-words ${
                        msg.deleted ? 'italic text-zinc-500' : ''
                      }`}>
                        {msg.content}
                      </p>
                    )}

                    {/* Attachment Embeds inside bubble */}
                    {msg.fileUrl && (
                      <div className="mt-2 max-w-full">
                        {msg.fileType?.startsWith('image/') ? (
                          <img 
                            src={msg.fileUrl} 
                            alt={msg.fileName} 
                            className="rounded-lg max-h-60 border border-black/10 object-cover cursor-zoom-in hover:opacity-95 transition"
                            onClick={() => window.open(msg.fileUrl, '_blank')}
                          />
                        ) : msg.fileType?.startsWith('video/') ? (
                          <video 
                            src={msg.fileUrl} 
                            controls 
                            className="rounded-lg max-h-60 max-w-full border border-black/10 shadow-sm"
                          />
                        ) : msg.fileType?.startsWith('audio/') ? (
                          <audio 
                            src={msg.fileUrl} 
                            controls 
                            className="w-64 max-w-full"
                          />
                        ) : (
                          <a 
                            href={msg.fileUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-black/25 hover:bg-black/35 transition text-[11px] text-slate-100"
                          >
                            <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-white truncate font-medium">{msg.fileName}</span>
                              <span className="text-[9px] text-zinc-400 uppercase">{msg.fileType || 'Attachment'}</span>
                            </div>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Bottom Metadata inside bubble (Time, ticks, Edited tag) */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-[#8696a0] select-none">
                      <span>{formatTime(msg.createdAt)}</span>
                      {msg.edited && <span>(edited)</span>}
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </div>

                  </div>

                  {/* Reaction Badges below the bubble */}
                  {msg.reactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(reactionCounts).map(([emoji, count]) => {
                        const isReacted = hasUserReacted(emoji);
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(msg.id, emoji, isReacted)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition ${
                              isReacted
                                ? 'bg-[#00a884]/20 border-[#00a884] text-[#00a884] font-bold'
                                : 'bg-[#202c33] border-[#2f3b43] text-[#8696a0] hover:border-white/10'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Floating Hover Controls */}
                {!msg.deleted && (
                  <div className={`absolute top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-[#202c33] border border-[#2f3b43] rounded-lg p-0.5 shadow-xl z-20 ${
                    isMe ? 'left-0 -translate-x-[105%]' : 'right-0 translate-x-[105%]'
                  }`}>
                    <button
                      onClick={() => setReplyToMessage(msg)}
                      className="p-1 hover:bg-[#374248] rounded text-[#aebac1] hover:text-white transition"
                      title="Reply"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Emoji Reaction Quick Picks */}
                    {['👍', '❤️', '😂', '🔥'].map((emoji) => {
                      const isReacted = hasUserReacted(emoji);
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg.id, emoji, isReacted)}
                          className="p-1 hover:bg-[#374248] rounded text-xs transition"
                        >
                          {emoji}
                        </button>
                      );
                    })}

                    {isMe && (
                      <>
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditText(msg.content);
                          }}
                          className="p-1 hover:bg-[#374248] rounded text-[#aebac1] hover:text-white transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1 hover:bg-[#374248] rounded text-[#ea0038] hover:bg-[#ea0038]/20 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}

              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-900 shrink-0 relative z-10">
        
        {/* Reply Indicator banner */}
        {replyToMessage && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-500/10 border-l-4 border-indigo-500 text-[11px] text-indigo-400 mb-2 rounded-r">
            <span className="truncate font-semibold">Replying to @{replyToMessage.sender.username}: {replyToMessage.content}</span>
            <button onClick={() => setReplyToMessage(null)}>
              <X className="w-4 h-4 hover:text-white transition" />
            </button>
          </div>
        )}

        {/* Attached File Display banner */}
        {attachedFile && (
          <div className="flex items-center justify-between p-2.5 bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 mb-2 rounded-xl">
            <div className="flex items-center gap-2 truncate">
              {attachedFile.type.startsWith('image/') ? (
                <Image className="w-4 h-4 text-indigo-400" />
              ) : (
                <FileText className="w-4 h-4 text-indigo-400" />
              )}
              <span className="text-white truncate font-semibold">{attachedFile.name}</span>
            </div>
            <button onClick={() => setAttachedFile(null)}>
              <X className="w-4 h-4 hover:text-red-400 transition" />
            </button>
          </div>
        )}

        {/* Live Typing indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="absolute top-[-24px] left-4 text-[10px] text-indigo-400 flex items-center gap-1.5 italic select-none bg-zinc-900 border border-zinc-800/80 px-2.5 py-0.5 rounded-full shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping shrink-0" />
            {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        {/* Chat Entry Form */}
        <form onSubmit={handleSend} className="flex gap-2.5 items-center">
          
          {/* File upload button */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 transition flex items-center justify-center shrink-0"
            title="Attach file"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            ) : (
              <Paperclip className="w-5 h-5 rotate-45" />
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text Area input */}
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Message"
              className="w-full pl-4 pr-10 py-3 text-xs bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none transition resize-none max-h-24 font-medium"
            />
            {/* Smile Emoji Shortcut (visual icon) */}
            <span className="absolute right-3.5 inset-y-0 flex items-center text-zinc-400 hover:text-white cursor-pointer select-none">
              <Smile className="w-5 h-5" />
            </span>
          </div>

          {/* Send Submit Button */}
          <button
            type="submit"
            className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition shrink-0 flex items-center justify-center shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20"
          >
            <Send className="w-5 h-5" />
          </button>

        </form>
      </div>

    </div>
  );
};
