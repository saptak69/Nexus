import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { Message } from '../store/useChatStore';
import { useAuthStore, API_BASE } from '../store/useAuthStore';
import type { User } from '../store/useAuthStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { Paperclip, Smile, Edit2, Trash2, CornerUpLeft, X, Video, Image, FileText, Check, Clock, ArrowLeft, Phone, Download } from 'lucide-react';

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getOptimizedImageUrl = (url?: string, width = 600) => {
  if (!url) return '';
  if (!url.includes('cloudinary.com')) return url;
  const uploadIndex = url.indexOf('/image/upload/');
  if (uploadIndex === -1) return url;
  const insertIndex = uploadIndex + '/image/upload/'.length;
  const prefix = url.substring(0, insertIndex);
  const suffix = url.substring(insertIndex);
  return `${prefix}w_${width},c_limit,q_auto,f_auto/${suffix}`;
};

export const ChatArea: React.FC = () => {
  const { 
    messages, activeMode, activeDmUserId, activeChannelId, friends, channels, sendMessage, sendTyping, typingUsers, setActiveDmUserId, setActiveChannelId, connected
  } = useChatStore();

  const { user, token } = useAuthStore();

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
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: string; size?: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Scroll to bottom
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    messageEndRef.current?.scrollIntoView({ behavior });
  };

  // Scroll to bottom only if user is near the bottom
  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  // Scroll to bottom unconditionally on channel/DM switch
  useEffect(() => {
    scrollToBottom('auto');
  }, [activeChannelId, activeDmUserId]);

  // Fetch active DM user details
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

  const uploadFile = async (file: File) => {
    if (!token) return;
    if (file.size > 100 * 1024 * 1024) {
      alert("PAYLOAD REJECTED: File size exceeds maximum allowed 100MB limit.");
      return;
    }
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
          size: data.fileSize || file.size,
        });
      } else {
        const errText = await response.text();
        alert(`UPLOAD FAILED: ${errText || 'Server rejected file'}`);
      }
    } catch (e) {
      console.error("File upload failed", e);
      alert("UPLOAD FAILED: Unable to reach server.");
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedFile) return;

    if (!connected) {
      alert("OFFLINE: Re-connecting to chat stream...");
      return;
    }

    sendMessage(inputText.trim(), {
      parentId: replyToMessage?.id,
      fileUrl: attachedFile?.url,
      fileName: attachedFile?.name,
      fileType: attachedFile?.type,
      fileSize: attachedFile?.size,
    });

    setInputText('');
    setReplyToMessage(null);
    setAttachedFile(null);
    setIsTypingLocal(false);
    sendTyping(false);
  };

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
        useChatStore.getState().fetchMessages(0);
        setEditingMessageId(null);
        setEditText('');
      }
    } catch (e) {
      console.error(e);
    }
  };

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

  let title = '';
  let subTitle = '';
  let showCallButton = false;
  let activeFriend: User | null = null;

  if (activeMode === 'SERVER') {
    const activeChannel = channels.find(c => c.id === activeChannelId);
    title = activeChannel ? `# ${activeChannel.name}` : 'SERVER ROOM';
    subTitle = activeChannel ? `${activeChannel.type}_CHANNEL` : '';
  } else {
    activeFriend = fetchedFriend;
    title = activeFriend ? (activeFriend.displayName || activeFriend.username) : 'SYNCING...';
    subTitle = activeFriend ? `@${activeFriend.username}${activeFriend.statusMessage ? ' • ' + activeFriend.statusMessage : ''}` : '';
    showCallButton = !!activeFriend;
  }

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  // Nothing OS square presence indicator
  const renderPresenceSquare = (presence?: string) => {
    switch (presence) {
      case 'ONLINE':
        return <div className="w-2.5 h-2.5 bg-white border border-white shrink-0" />;
      case 'AWAY':
        return <div className="w-2.5 h-2.5 bg-transparent border border-white shrink-0" />;
      case 'DND':
        return (
          <div className="w-2.5 h-2.5 bg-zinc-800 border border-white shrink-0 flex items-center justify-center text-[7px] text-white font-mono leading-none">
            ×
          </div>
        );
      default:
        return <div className="w-2.5 h-2.5 bg-transparent border border-zinc-700 shrink-0" />;
    }
  };

  return (
    <div 
      ref={chatAreaRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 bg-black bg-dot-grid flex flex-col justify-between overflow-hidden relative rounded-none border-l border-zinc-900 ${
        dragOver ? 'border border-dashed border-white bg-white/5' : ''
      }`}
      style={{ height: '100dvh' }}
    >
      
      {/* HEADER BAR (Monochromatic, sharp borders, all buttons visible) */}
      {title && (
        <div className="h-16 px-4 border-b border-zinc-900 flex items-center justify-between bg-black shrink-0 z-10 relative">
          <div className="flex items-center min-w-0 flex-1 mr-4">
            
            {/* Back Button for mobile viewports */}
            <button
              onClick={() => {
                setActiveDmUserId(null);
                setActiveChannelId(null);
              }}
              className="md:hidden p-2 mr-3 text-white bg-black border border-white/20 hover:bg-white hover:text-black rounded-none transition flex items-center justify-center shrink-0 w-9 h-9"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Gray-scaled profile picture */}
            {activeFriend && (
              <div className="relative shrink-0 mr-3">
                {activeFriend.avatarUrl ? (
                  <img 
                    src={activeFriend.avatarUrl} 
                    alt={activeFriend.username} 
                    className="w-9 h-9 rounded-none object-cover border border-white/10 filter grayscale contrast-120" 
                  />
                ) : (
                  <div className="w-9 h-9 rounded-none bg-zinc-900 border border-white/10 flex items-center justify-center font-mono font-bold text-white text-xs">
                    {activeFriend.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                {/* Active State indicator */}
                <div className="absolute -bottom-1 -right-1">
                  {renderPresenceSquare(activeFriend.presence)}
                </div>
              </div>
            )}

            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-xs sm:text-sm font-mono font-black text-white uppercase tracking-wider truncate">{title}</span>
              {subTitle && (
                <span className="text-[9px] font-mono text-zinc-500 truncate uppercase tracking-widest mt-0.5">
                  {subTitle}
                </span>
              )}
            </div>
          </div>

          {/* Call buttons are fully visible on both mobile and desktop */}
          <div className="flex items-center gap-1.5 shrink-0">
            {showCallButton && activeFriend && (
              <>
                <button
                  onClick={() => useWebRTCStore.getState().initiateCall(activeFriend!.id, activeFriend!.displayName || activeFriend!.username, false)}
                  className="px-2.5 py-1.5 text-[10px] font-mono font-black uppercase text-white bg-black border border-zinc-750 hover:border-white hover:bg-white hover:text-black rounded-none kinematic-transition flex items-center gap-1.5 shrink-0"
                  title="Establish Voice Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">[VOICE]</span>
                </button>
                <button
                  onClick={() => useWebRTCStore.getState().initiateCall(activeFriend!.id, activeFriend!.displayName || activeFriend!.username, true)}
                  className="px-2.5 py-1.5 text-[10px] font-mono font-black uppercase text-white bg-black border border-white hover:bg-white hover:text-black rounded-none kinematic-transition flex items-center gap-1.5 shrink-0"
                  title="Establish Video Stream"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>[VIDEO]</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Drag Over Overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-none z-40">
          <div className="bg-black border border-white p-6 rounded-none flex flex-col items-center gap-2">
            <span className="text-xs font-mono font-black uppercase tracking-widest text-white">DRAG_DROP_ATTACHMENT</span>
            <span className="text-[9px] font-mono text-zinc-500 uppercase">RELEASE FILE TO SEND</span>
          </div>
        </div>
      )}

      {/* Message History list (Applied linear fade mask for older messages) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 z-10 relative scrollbar-thin fade-history-mask bg-black/10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-1 select-none">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">No active stream</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender.id === user?.id;
            
            const hasUserReacted = (emoji: string) => {
              return msg.reactions.some((r) => r.emoji === emoji && r.user.id === user?.id);
            };

            const reactionCounts = msg.reactions.reduce((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col group relative px-1 py-1 animate-fade-snap ${
                  isMe ? 'items-end' : 'items-start'
                }`}
              >
                {/* Time Indicator - Hover Only absolute stamp */}
                <div className="opacity-0 group-hover:opacity-100 absolute top-[-10px] px-2 py-0.5 bg-black border border-zinc-800 text-[8px] font-mono text-zinc-400 z-20 kinematic-transition uppercase">
                  {formatTime(msg.createdAt)}
                </div>

                <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                  
                  {/* Glassmorphic Bubble - Square corners, no rounded edges */}
                  <div className={`relative px-4 py-3 text-xs leading-relaxed break-words rounded-none border transition-all duration-700 ${
                    isMe 
                      ? 'bubble-glass-me font-sans font-medium' 
                      : 'bubble-glass text-zinc-100 font-sans'
                  } ${msg.deleted ? 'opacity-30 italic' : ''}`}>
                    
                    {/* Thread reply details inside the bubble */}
                    {msg.parentMessage && (
                      <div className={`mb-2.5 p-2 rounded-none text-[9px] font-mono border-l-2 flex flex-col gap-0.5 ${
                        isMe 
                          ? 'bg-black/10 border-black/40 text-zinc-800' 
                          : 'bg-white/5 border-white/20 text-zinc-400'
                      }`}>
                        <span className="font-bold">@{msg.parentMessage.sender.username.toUpperCase()}</span>
                        <span className="truncate max-w-[200px]">{msg.parentMessage.content}</span>
                      </div>
                    )}

                    {/* Text content / Editing input */}
                    {editingMessageId === msg.id ? (
                      <div className="flex gap-1.5 items-center min-w-[200px] mt-1">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs rounded-none bg-black/60 border border-white/20 text-white focus:outline-none focus:border-white font-mono"
                        />
                        <button
                          onClick={() => handleEditSubmit(msg.id)}
                          className="bg-white text-black border border-white px-2 py-1 rounded-none text-[9px] font-mono font-black uppercase hover:bg-black hover:text-white kinematic-transition"
                        >
                          SAVE
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="bg-zinc-900 border border-zinc-800 text-white px-2 py-1 rounded-none text-[9px] font-mono hover:bg-white hover:text-black kinematic-transition"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <p className={`text-[12px] leading-relaxed break-words tracking-tight ${
                        msg.deleted ? 'italic' : ''
                      }`}>
                        {msg.content}
                      </p>
                    )}

                    {/* Attachment Embeds */}
                    {msg.fileUrl && (
                      <div className="mt-2.5 max-w-full">
                        {msg.fileType?.startsWith('image/') ? (
                          <img 
                            src={getOptimizedImageUrl(msg.fileUrl, 600)} 
                            alt={msg.fileName} 
                            className="rounded-none max-h-60 border border-white/10 object-cover cursor-zoom-in filter grayscale contrast-125"
                            onClick={() => window.open(msg.fileUrl, '_blank', 'noopener,noreferrer')}
                          />
                        ) : msg.fileType?.startsWith('video/') ? (
                          <video 
                            src={msg.fileUrl} 
                            controls 
                            className="rounded-none max-h-60 max-w-full border border-white/10 shadow-none filter grayscale contrast-110"
                          />
                        ) : msg.fileType?.startsWith('audio/') ? (
                          <audio 
                            src={msg.fileUrl} 
                            controls 
                            className="w-60 max-w-full invert"
                          />
                        ) : (
                          <a 
                            href={msg.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            download={msg.fileName}
                            className={`flex items-center justify-between gap-3 p-3 rounded-none border text-[10px] font-mono uppercase tracking-wider transition ${
                              isMe 
                                ? 'bg-black/5 border-black/20 text-zinc-900 hover:bg-black/10' 
                                : 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={`p-2 border rounded-none shrink-0 ${isMe ? 'border-black/30 bg-black/10' : 'border-white/20 bg-white/10'}`}>
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="truncate font-black text-xs">{msg.fileName}</span>
                                <div className="flex items-center gap-1.5 opacity-60 text-[8px] mt-0.5">
                                  <span>{msg.fileType || 'DOCUMENT'}</span>
                                  {msg.fileSize && <span>• {formatFileSize(msg.fileSize)}</span>}
                                </div>
                              </div>
                            </div>
                            <div className={`px-2 py-1 text-[8px] font-mono font-bold border flex items-center gap-1 shrink-0 ${
                              isMe ? 'border-black text-black' : 'border-white text-white'
                            }`}>
                              <Download className="w-3 h-3" />
                              <span>GET</span>
                            </div>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Bottom ticks and edited details */}
                    <div className={`flex items-center justify-end gap-1 mt-1.5 text-[8px] font-mono uppercase select-none ${
                      isMe ? 'text-zinc-600' : 'text-zinc-500'
                    }`}>
                      {msg.edited && <span>[EDIT]</span>}
                      {isMe && (
                        msg.id < 0 ? (
                          <Clock className="w-3 h-3 animate-pulse" />
                        ) : (
                          <Check className="w-3 h-3 text-emerald-700" />
                        )
                      )}
                    </div>

                  </div>

                  {/* Reaction Badges */}
                  {msg.reactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(reactionCounts).map(([emoji, count]) => {
                        const isReacted = hasUserReacted(emoji);
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(msg.id, emoji, isReacted)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-none text-[9px] font-mono border transition ${
                              isReacted
                                ? 'bg-white border-white text-black font-black'
                                : 'bg-black border-zinc-800 text-zinc-500 hover:border-white/20'
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

                {/* Floating Hover Controls (Sharp corners, monochrome buttons) */}
                {!msg.deleted && (
                  <div className={`absolute top-[40%] hidden group-hover:flex items-center bg-black border border-white rounded-none p-0.5 shadow-none z-20 ${
                    isMe ? 'left-0' : 'right-0'
                  }`}>
                    <button
                      onClick={() => setReplyToMessage(msg)}
                      className="p-1.5 hover:bg-zinc-900 rounded-none text-zinc-400 hover:text-white transition"
                      title="Reply"
                    >
                      <CornerUpLeft className="w-3 h-3" />
                    </button>

                    {/* Emoji Reaction Picks */}
                    {['👍', '❤️', '😂', '🔥'].map((emoji) => {
                      const isReacted = hasUserReacted(emoji);
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg.id, emoji, isReacted)}
                          className="p-1 hover:bg-zinc-900 rounded-none text-[11px] transition"
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
                          className="p-1.5 hover:bg-zinc-900 rounded-none text-zinc-400 hover:text-white transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded-none text-red-500 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
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

      {/* FIXED BOTTOM-ANCHORED INPUT BAR (Frosted-glass style, stark monochrome) */}
      <div 
        className="p-3 bg-black/80 backdrop-blur-md border-t border-zinc-900 shrink-0 relative z-10"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        
        {/* Reply Indicator banner */}
        {replyToMessage && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-l border-white text-[9px] font-mono text-zinc-400 mb-2 rounded-none">
            <span className="truncate uppercase font-bold">REPLY_TO @{replyToMessage.sender.username.toUpperCase()}: {replyToMessage.content}</span>
            <button onClick={() => setReplyToMessage(null)}>
              <X className="w-3.5 h-3.5 hover:text-white transition" />
            </button>
          </div>
        )}

        {/* Attached File Display banner */}
        {attachedFile && (
          <div className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 text-[9px] font-mono text-zinc-400 mb-2 rounded-none">
            <div className="flex items-center gap-2 truncate">
              {attachedFile.type.startsWith('image/') ? (
                <Image className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span className="text-white truncate font-bold uppercase">{attachedFile.name}</span>
              {attachedFile.size && (
                <span className="text-zinc-500 font-mono text-[8px]">({formatFileSize(attachedFile.size)})</span>
              )}
            </div>
            <button onClick={() => setAttachedFile(null)}>
              <X className="w-3.5 h-3.5 hover:text-red-500 transition" />
            </button>
          </div>
        )}

        {/* Live Typing indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="absolute top-[-20px] left-4 text-[8px] font-mono text-white flex items-center gap-1.5 uppercase tracking-widest bg-black border border-zinc-900 px-2.5 py-0.5 rounded-none">
            <span className="w-1 h-1 bg-white animate-pulse shrink-0" />
            {Object.values(typingUsers).join(', ')} typing...
          </div>
        )}

        {/* Chat Entry Form - Clean monospaced buttons visible on mobile */}
        <form onSubmit={handleSend} className="flex gap-2.5 items-center">
          
          {/* File Upload Trigger */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-white border border-zinc-900 hover:border-white bg-black rounded-none transition flex items-center justify-center shrink-0 btn-interactive"
            title="Attach Stream Data"
          >
            {uploading ? (
              <div className="w-4 h-4 border border-white/30 border-t-white rounded-none animate-spin"></div>
            ) : (
              <Paperclip className="w-4 h-4 rotate-45" />
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="*/*"
            className="hidden"
          />

          {/* Monospaced text entry */}
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
              placeholder="ENTER CONSOLE MESSAGE..."
              className="w-full pl-4 pr-10 py-2.5 text-xs font-mono bg-zinc-950 border border-zinc-900 focus:border-white/30 rounded-none text-white placeholder-zinc-700 focus:outline-none transition resize-none max-h-24 uppercase"
            />
            {/* Smile Emoji Shortcut */}
            <span className="absolute right-3 inset-y-0 flex items-center text-zinc-600 hover:text-white cursor-pointer select-none">
              <Smile className="w-5 h-5" />
            </span>
          </div>

          {/* Stark SEND button - fully visible on mobile */}
          <button
            type="submit"
            className="px-4 py-2.5 rounded-none bg-white text-black font-mono font-black text-xs border border-white hover:bg-black hover:text-white transition shrink-0 flex items-center justify-center btn-interactive"
          >
            SEND
          </button>

        </form>
      </div>

    </div>
  );
};
