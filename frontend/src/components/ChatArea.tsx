import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { Message } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { Send, Paperclip, Smile, Edit2, Trash2, CornerUpLeft, X, Video, Image, FileText, MessageSquare } from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { 
    messages, activeMode, activeChannelId, activeDmUserId, friends, sendMessage, sendTyping, typingUsers, servers
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
  
  // File Upload states
  const [uploading, setUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Auto Scroll to bottom
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

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
      const response = await fetch('http://localhost:8080/api/messages/upload', {
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
      const response = await fetch(`http://localhost:8080/api/messages/${messageId}`, {
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
      const response = await fetch(`http://localhost:8080/api/messages/${messageId}`, {
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
      const response = await fetch(`http://localhost:8080/api/messages/${messageId}/react?emoji=${encodeURIComponent(emoji)}`, {
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

  if (activeMode === 'SERVER') {
    const server = servers.find(s => s.id === useChatStore.getState().activeServerId);
    const channel = useChatStore.getState().channels.find(c => c.id === activeChannelId);
    title = channel ? `# ${channel.name}` : '';
    subTitle = server ? `in ${server.name}` : '';
  } else {
    const friend = friends.find(f => f.id === activeDmUserId);
    title = friend ? `@ ${friend.username}` : 'Direct Chat';
    subTitle = friend?.statusMessage || (friend ? friend.presence.toLowerCase() : '');
    showCallButton = !!friend;
  }

  // Format date helper
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      ref={chatAreaRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 h-screen bg-[#1b212c] flex flex-col justify-between overflow-hidden relative ${
        dragOver ? 'border-2 border-dashed border-brand-500 bg-brand-500/5' : ''
      }`}
    >
      
      {/* Header */}
      {title && (
        <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between bg-[#171c24] shrink-0">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white truncate">{title}</span>
            {subTitle && <span className="text-[10px] text-dark-500 truncate">{subTitle}</span>}
          </div>
          <div className="flex items-center gap-3">
            {showCallButton && (
              <button
                onClick={handleDMCall}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/15 hover:bg-accent-cyan text-accent-cyan hover:text-dark-900 font-bold text-xs transition"
              >
                <Video className="w-3.5 h-3.5" /> Call
              </button>
            )}
          </div>
        </div>
      )}

      {/* Drag Over Overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-brand-500/10 backdrop-blur-xs flex items-center justify-center pointer-events-none z-40">
          <div className="glass-panel p-6 rounded-2xl flex flex-col items-center gap-3">
            <Paperclip className="w-10 h-10 text-brand-400 animate-bounce" />
            <span className="text-sm font-bold text-white">Drop files to attach to chat</span>
          </div>
        </div>
      )}

      {/* Message History list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-dark-500 gap-2 select-none">
            <MessageSquare className="w-12 h-12 text-dark-600/30" />
            <span className="text-xs font-semibold">Beginning of conversation history</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender.id === user?.id;
            const initials = msg.sender.username.substring(0, 2).toUpperCase();
            
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
                className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} group relative px-1 py-1`}
              >
                {/* Avatar (Only for received messages) */}
                {!isMe && (
                  <div className="shrink-0 mb-1">
                    {msg.sender.avatarUrl ? (
                      <img src={msg.sender.avatarUrl} alt={msg.sender.username} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center font-bold text-white text-[10px] select-none">
                        {initials}
                      </div>
                    )}
                  </div>
                )}

                {/* Message block */}
                <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender name for channel messages (only if SERVER mode and not me) */}
                  {!isMe && activeMode === 'SERVER' && (
                    <span className="text-[10px] text-dark-500 font-bold mb-1 ml-1.5">{msg.sender.username}</span>
                  )}

                  {/* Message Bubble */}
                  <div className={`relative rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm break-words ${
                    isMe 
                      ? 'bg-brand-500 text-white rounded-tr-sm' 
                      : 'bg-[#242e3d] text-slate-200 rounded-tl-sm border border-white/5'
                  } ${msg.deleted ? 'italic text-dark-500 bg-opacity-50' : ''}`}>
                    
                    {/* Thread reply details inside the bubble */}
                    {msg.parentMessage && (
                      <div className={`mb-2 p-2 rounded text-[10px] border-l-2 flex flex-col gap-0.5 ${
                        isMe 
                          ? 'bg-black/15 border-white/30 text-slate-100' 
                          : 'bg-black/25 border-brand-500 text-slate-300'
                      }`}>
                        <span className="font-bold text-white">@{msg.parentMessage.sender.username}</span>
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
                          className="flex-1 px-2.5 py-1 text-xs rounded bg-black/30 border border-white/10 text-white focus:outline-none focus:border-brand-400"
                        />
                        <button
                          onClick={() => handleEditSubmit(msg.id)}
                          className="bg-accent-green hover:bg-accent-green/80 text-dark-900 px-2 py-1 rounded text-[10px] font-bold transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-[10px] font-bold transition"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <p className={`text-xs leading-relaxed break-words ${
                        isMe ? 'text-white' : 'text-slate-200'
                      } ${msg.deleted ? 'italic text-dark-500' : ''}`}>
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
                            className="rounded-lg max-h-48 border border-white/5 object-cover cursor-zoom-in hover:opacity-95 transition"
                            onClick={() => window.open(msg.fileUrl, '_blank')}
                          />
                        ) : (
                          <a 
                            href={msg.fileUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-black/20 hover:bg-black/30 transition text-[11px]"
                          >
                            <FileText className="w-4 h-4 text-accent-cyan shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-white truncate font-medium">{msg.fileName}</span>
                              <span className="text-[8px] text-dark-500 uppercase">{msg.fileType || 'Attachment'}</span>
                            </div>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Bottom Metadata inside bubble (Time, Edited tag) */}
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[8px] select-none ${
                      isMe ? 'text-brand-200' : 'text-dark-500'
                    }`}>
                      <span>{formatTime(msg.createdAt)}</span>
                      {msg.edited && <span>(edited)</span>}
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
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] border transition ${
                              isReacted
                                ? 'bg-brand-500/20 border-brand-500 text-brand-400 font-bold'
                                : 'bg-dark-800 border-white/5 text-dark-500 hover:border-white/10'
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
                  <div className={`absolute top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-[#171c24] border border-white/5 rounded-lg p-0.5 shadow-xl z-20 ${
                    isMe ? 'left-0 -translate-x-[105%]' : 'right-0 translate-x-[105%]'
                  }`}>
                    <button
                      onClick={() => setReplyToMessage(msg)}
                      className="p-1 hover:bg-dark-600 rounded text-dark-500 hover:text-white transition"
                      title="Reply"
                    >
                      <CornerUpLeft className="w-3 h-3" />
                    </button>

                    {/* Emoji Reaction Quick Picks */}
                    {['👍', '❤️', '😂', '🔥'].map((emoji) => {
                      const isReacted = hasUserReacted(emoji);
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg.id, emoji, isReacted)}
                          className="p-0.5 hover:bg-dark-600 rounded text-xs transition"
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
                          className="p-1 hover:bg-dark-600 rounded text-dark-500 hover:text-white transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1 hover:bg-dark-600 rounded text-accent-red hover:bg-accent-red/20 transition"
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

      {/* Bottom Input Area */}
      <div className="p-4 bg-[#171c24] border-t border-white/5 shrink-0 relative">
        
        {/* Reply Indicator banner */}
        {replyToMessage && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-brand-500/10 border-l-4 border-brand-500 text-[10px] text-brand-400 mb-2 rounded-r">
            <span className="truncate">Replying to @{replyToMessage.sender.username}: {replyToMessage.content}</span>
            <button onClick={() => setReplyToMessage(null)}>
              <X className="w-3.5 h-3.5 hover:text-white transition" />
            </button>
          </div>
        )}

        {/* Attached File Display banner */}
        {attachedFile && (
          <div className="flex items-center justify-between p-2 bg-[#1c222c] border border-white/5 text-[10px] text-dark-500 mb-2 rounded-lg">
            <div className="flex items-center gap-1.5 truncate">
              {attachedFile.type.startsWith('image/') ? <Image className="w-4 h-4 text-accent-cyan" /> : <FileText className="w-4 h-4 text-brand-400" />}
              <span className="text-white truncate font-medium">{attachedFile.name}</span>
            </div>
            <button onClick={() => setAttachedFile(null)}>
              <X className="w-3.5 h-3.5 hover:text-accent-red transition" />
            </button>
          </div>
        )}

        {/* Live Typing indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="absolute top-[-20px] left-4 text-[9px] text-dark-500 flex items-center gap-1 italic select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-ping shrink-0" />
            {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        {/* Chat Entry Form */}
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          
          {/* File upload button */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-dark-800 text-dark-500 hover:text-white rounded-xl border border-white/5 transition flex items-center justify-center shrink-0"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin"></div>
            ) : (
              <Paperclip className="w-4 h-4" />
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
              placeholder={`Message ${title}`}
              className="w-full pl-4 pr-10 py-3 text-xs bg-dark-900 border border-white/5 rounded-xl text-slate-200 placeholder-dark-500 focus:outline-none focus:border-brand-500 transition resize-none max-h-24 font-medium"
            />
            {/* Smile Emoji Shortcut (visual icon) */}
            <span className="absolute right-3.5 inset-y-0 flex items-center text-dark-500 hover:text-white cursor-pointer select-none">
              <Smile className="w-4.5 h-4.5" />
            </span>
          </div>

          {/* Send Submit Button */}
          <button
            type="submit"
            className="p-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25 transition shrink-0 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>

        </form>
      </div>

    </div>
  );
};
