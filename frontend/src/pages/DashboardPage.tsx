import { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { SidebarChannels } from '../components/SidebarChannels';
import { ChatArea } from '../components/ChatArea';
import { VideoGrid } from '../components/VideoGrid';
import { MessageSquare, Radio, Heart } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { connectSocket, disconnectSocket, fetchFriends, activeChannelId, activeDmUserId, activeMode } = useChatStore();
  const { inCall, leaveRoom, incomingCall, acceptCall, declineCall } = useWebRTCStore();

  useEffect(() => {
    // Connect WebSocket and fetch contacts list
    connectSocket();
    fetchFriends();

    return () => {
      // Disconnect socket and terminate active calls on exit
      disconnectSocket();
      leaveRoom();
    };
  }, []);

  const hasActiveConversation = (activeMode === 'SERVER' && activeChannelId !== null) || (activeMode === 'DM' && activeDmUserId !== null);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden select-none font-sans">
      
      {/* 1. Left Panel: WhatsApp Inbox / Contact List */}
      <div className={`h-full shrink-0 border-r border-zinc-900 bg-zinc-950 ${
        activeDmUserId !== null ? 'hidden md:flex md:w-[350px] lg:w-[400px]' : 'flex w-full md:w-[350px] lg:w-[400px]'
      }`}>
        <SidebarChannels />
      </div>

      {/* 2. Right Panel: Active Chat or Welcome Screen */}
      <div className={`h-full flex-1 flex flex-col min-w-0 ${
        activeDmUserId !== null ? 'flex w-full' : 'hidden md:flex md:flex-1'
      }`}>
        {inCall ? (
          /* Render WebRTC Conference Grid if active video session is running */
          <VideoGrid />
        ) : hasActiveConversation ? (
          /* Render Chat message log and input area */
          <ChatArea />
        ) : (
          /* Beautiful Welcome / Landing Screen when nothing is active */
          <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 p-8 text-center relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-500/10 rounded-full filter blur-[120px] pointer-events-none"></div>

            <div className="max-w-md flex flex-col items-center gap-6 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.15)] animate-pulse">
                <Radio className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-white tracking-tight">Welcome to Nexus</h1>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                  A modern, real-time communications console. Start a Direct Message with a friend to start exchanging streams.
                </p>
              </div>

              {/* Informative features grid */}
              <div className="grid grid-cols-2 gap-3 w-full mt-4 text-left">
                <div className="p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 flex flex-col gap-1.5 animate-message-pop">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">Real-Time Messaging</span>
                  <span className="text-[9px] text-zinc-400 font-medium">Instant chat, attachment uploads, emoji replies, and reactions.</span>
                </div>
                <div className="p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 flex flex-col gap-1.5 animate-message-pop delay-75">
                  <Radio className="w-5 h-5 text-violet-400" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">WebRTC Conferences</span>
                  <span className="text-[9px] text-zinc-400 font-medium">Multi-user mesh video calling, screen shares, and room syncing.</span>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-4 text-[9px] text-zinc-600 font-semibold tracking-wider flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for high quality communication.
            </div>
          </div>
        )}
      </div>

      {/* 4. Incoming Call Modal Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xs p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col items-center text-center gap-4 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.1)] animate-pulse">
              <Radio className="w-6 h-6" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white font-outfit">Incoming Call</h3>
              <p className="text-xs text-zinc-400">
                <span className="font-semibold text-indigo-400">@{incomingCall.senderName}</span> is calling you.
              </p>
            </div>

            <div className="flex gap-2.5 w-full mt-2">
              <button
                onClick={declineCall}
                className="flex-1 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white font-bold text-xs transition duration-150 btn-interactive"
              >
                Decline
              </button>
              <button
                onClick={acceptCall}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/10 transition duration-150 btn-interactive"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
