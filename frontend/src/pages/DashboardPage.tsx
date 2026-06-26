import React, { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { SidebarChannels } from '../components/SidebarChannels';
import { ChatArea } from '../components/ChatArea';
import { VideoGrid } from '../components/VideoGrid';
import { MessageSquare, Radio, Heart, Cpu, Shield } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { connectSocket, disconnectSocket, fetchFriends, activeChannelId, activeDmUserId, activeMode } = useChatStore();
  const { inCall, leaveRoom, incomingCall, acceptCall, declineCall } = useWebRTCStore();

  useEffect(() => {
    connectSocket();
    fetchFriends();

    return () => {
      disconnectSocket();
      leaveRoom();
    };
  }, []);

  const hasActiveConversation = (activeMode === 'SERVER' && activeChannelId !== null) || (activeMode === 'DM' && activeDmUserId !== null);

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden select-none font-sans rounded-none">
      
      {/* 1. Left panel: Dual-Pane Sidebar containing left icon-dock and middle thread-list */}
      <div className={`h-full shrink-0 border-r border-zinc-900 bg-black ${
        activeDmUserId !== null ? 'hidden md:flex md:w-[350px] lg:w-[400px]' : 'flex w-full md:w-[350px] lg:w-[400px]'
      }`}>
        <SidebarChannels />
      </div>

      {/* 2. Right panel: Active Chat Console or Welcome Grid */}
      <div className={`h-full flex-col min-w-0 ${
        activeDmUserId !== null ? 'flex-1 flex w-full' : 'hidden md:flex md:flex-1'
      }`}>
        {inCall ? (
          <VideoGrid />
        ) : hasActiveConversation ? (
          <ChatArea />
        ) : (
          /* Stark welcome screen using dot-matrix typography & flat borders */
          <div className="flex-1 flex flex-col items-center justify-center bg-black p-8 text-center relative overflow-hidden select-none">
            
            <div className="max-w-md flex flex-col items-center gap-8 relative z-10">
              
              {/* Dot-matrix style box */}
              <div className="w-14 h-14 border border-white flex items-center justify-center text-white bg-black rounded-none shadow-none">
                <Cpu className="w-6 h-6" />
              </div>
              
              <div className="space-y-3">
                <h1 className="text-xl font-mono font-black uppercase tracking-[0.2em] text-white">NEXUS_SYSTEM</h1>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest leading-relaxed max-w-xs">
                  Active operator console. Establish direct data stream with another operator to begin message and media sync.
                </p>
              </div>

              {/* Informative features grid - sharp corners, monochrome style */}
              <div className="grid grid-cols-2 gap-3 w-full mt-4 text-left">
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-none flex flex-col gap-2">
                  <MessageSquare className="w-4.5 h-4.5 text-white" />
                  <span className="text-[9px] font-mono font-black uppercase tracking-widest text-white">MESSAGE_STREAM</span>
                  <span className="text-[9px] font-mono text-zinc-500 leading-normal uppercase">Instant text and file payload exchange over encrypted stream channels.</span>
                </div>
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-none flex flex-col gap-2">
                  <Shield className="w-4.5 h-4.5 text-white" />
                  <span className="text-[9px] font-mono font-black uppercase tracking-widest text-white">RTC_CONFERENCE</span>
                  <span className="text-[9px] font-mono text-zinc-500 leading-normal uppercase">Encrypted high-fidelity multi-operator audio/video pipeline.</span>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-4 text-[8px] font-mono text-zinc-700 uppercase tracking-widest flex items-center gap-1.5">
              Made with <Heart className="w-2.5 h-2.5 text-zinc-700 fill-zinc-700" /> for operator efficiency.
            </div>
          </div>
        )}
      </div>

      {/* 4. Stark Incoming Call Modal Dialog */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-75">
          <div className="w-full max-w-xs p-6 rounded-none bg-black border-2 border-white shadow-none flex flex-col items-center text-center gap-5 animate-scale-in">
            
            <div className="w-10 h-10 border border-white flex items-center justify-center text-white animate-pulse">
              <Radio className="w-5 h-5" />
            </div>
            
            <div className="space-y-1.5 leading-tight">
              <h3 className="text-xs font-mono font-black uppercase tracking-widest text-white">INC_STREAM_CALL</h3>
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mt-1">
                OPERATOR <span className="font-bold text-white">@{incomingCall.senderName.toUpperCase()}</span> INITIATING VIDEO LINK...
              </p>
            </div>

            <div className="flex gap-2.5 w-full">
              <button
                onClick={declineCall}
                className="flex-1 py-2 rounded-none bg-zinc-950 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono font-black text-[10px] uppercase transition duration-75 btn-interactive"
              >
                DECLINE
              </button>
              <button
                onClick={acceptCall}
                className="flex-1 py-2 rounded-none bg-white text-black border border-white font-mono font-black text-[10px] uppercase hover:bg-black hover:text-white transition duration-75 btn-interactive"
              >
                ACCEPT
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
