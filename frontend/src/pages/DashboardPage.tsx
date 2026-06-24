import { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { SidebarServers } from '../components/SidebarServers';
import { SidebarChannels } from '../components/SidebarChannels';
import { ChatArea } from '../components/ChatArea';
import { VideoGrid } from '../components/VideoGrid';
import { MessageSquare, Radio, Heart } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { connectSocket, disconnectSocket, fetchServers, activeChannelId, activeDmUserId, activeMode } = useChatStore();
  const { inCall, leaveRoom, incomingCall, acceptCall, declineCall } = useWebRTCStore();

  useEffect(() => {
    // Connect WebSocket and fetch joined servers list
    connectSocket();
    fetchServers();

    return () => {
      // Disconnect socket and terminate active calls on exit
      disconnectSocket();
      leaveRoom();
    };
  }, []);

  const hasActiveConversation = (activeMode === 'SERVER' && activeChannelId !== null) || (activeMode === 'DM' && activeDmUserId !== null);

  return (
    <div className="flex h-screen w-full bg-[#0b0c10] text-[#e5e7eb] overflow-hidden select-none font-sans">
      
      {/* 1. Leftmost Server Icon Sidebar */}
      <SidebarServers />

      {/* 2. Secondary Channel / Friend list Sidebar */}
      <SidebarChannels />

      {/* 3. Main Workspace Panel */}
      <div className="flex-1 h-screen flex flex-col min-w-0">
        {inCall ? (
          /* Render WebRTC Conference Grid if active video session is running */
          <VideoGrid />
        ) : hasActiveConversation ? (
          /* Render Chat message log and input area */
          <ChatArea />
        ) : (
          /* Beautiful Welcome / Landing Screen when nothing is active */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#1b212c] p-8 text-center relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-brand-500 rounded-full filter blur-[100px] opacity-10 pointer-events-none"></div>

            <div className="max-w-md flex flex-col items-center gap-6 relative z-10">
              <div className="w-20 h-20 rounded-3xl bg-dark-800 border border-white/5 flex items-center justify-center text-accent-cyan shadow-[0_0_30px_rgba(102,252,241,0.15)] animate-pulse">
                <Radio className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">Welcome to Nexus</h1>
                <p className="text-xs text-dark-500 leading-relaxed max-w-sm">
                  A modern, real-time communications console. Start a Direct Message with a friend or choose a server channel to start exchanging streams.
                </p>
              </div>

              {/* Informative features grid */}
              <div className="grid grid-cols-2 gap-3 w-full mt-4 text-left">
                <div className="p-3 bg-[#13171e] rounded-xl border border-white/5 flex flex-col gap-1.5">
                  <MessageSquare className="w-4.5 h-4.5 text-brand-400" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">Real-Time Messaging</span>
                  <span className="text-[9px] text-dark-500">Instant chat, attachment uploads, emoji replies, and reactions.</span>
                </div>
                <div className="p-3 bg-[#13171e] rounded-xl border border-white/5 flex flex-col gap-1.5">
                  <Radio className="w-4.5 h-4.5 text-accent-cyan" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">WebRTC Conferences</span>
                  <span className="text-[9px] text-dark-500">Multi-user mesh video calling, screen shares, and raising hand.</span>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-4 text-[9px] text-dark-500 font-semibold tracking-wider flex items-center gap-1">
              Made with <Heart className="w-3.5 h-3.5 text-accent-red fill-accent-red" /> for high quality communication.
            </div>
          </div>
        )}
      </div>

      {/* 4. Incoming Call Modal Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm p-6 rounded-2xl glass-panel shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-350">
            <div className="w-16 h-16 rounded-full bg-accent-cyan/10 border-2 border-accent-cyan flex items-center justify-center text-accent-cyan shadow-[0_0_20px_rgba(102,252,241,0.2)] animate-pulse">
              <Radio className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Incoming Call</h3>
              <p className="text-xs text-slate-300">
                <span className="font-semibold text-accent-cyan">@{incomingCall.senderName}</span> is calling you.
              </p>
            </div>

            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={declineCall}
                className="flex-1 py-2.5 rounded-xl bg-accent-red/20 hover:bg-accent-red text-accent-red hover:text-white font-bold text-xs transition duration-300"
              >
                Decline
              </button>
              <button
                onClick={acceptCall}
                className="flex-1 py-2.5 rounded-xl bg-accent-green hover:bg-accent-green/85 text-dark-900 font-extrabold text-xs shadow-lg shadow-accent-green/20 transition duration-300"
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
