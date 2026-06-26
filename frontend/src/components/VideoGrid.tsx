import React, { useRef, useEffect } from 'react';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Hand, Volume2, Camera } from 'lucide-react';

// Specialized Video Player using refs
const VideoPlayer: React.FC<{ stream: MediaStream; muted?: boolean; className?: string }> = ({ stream, muted = false, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full object-cover rounded-xl ${className}`}
    />
  );
};

export const VideoGrid: React.FC = () => {
  const {
    localStream, remoteStreams, leaveRoom, micMuted, cameraOff, screenSharing, raisingHand, activeSpeakerId,
    videoDevices, audioDevices, selectedVideoId, selectedAudioId, changeVideoDevice, changeAudioDevice, toggleMic, toggleCamera, toggleScreenShare, toggleRaiseHand
  } = useWebRTCStore();

  const { friends } = useChatStore();
  const { user } = useAuthStore();

  // Combine participants: local user + remote users
  const participants = [
    {
      id: user?.id || 0,
      username: user?.username || 'You',
      stream: localStream,
      isLocal: true,
      muted: micMuted,
      cameraOff: cameraOff,
      handRaised: raisingHand,
    },
    ...Object.entries(remoteStreams).map(([peerIdStr, stream]) => {
      const peerId = Number(peerIdStr);
      const friend = friends.find((f) => f.id === peerId);
      
      // Look up status in socket state (activeRoomUsers / typing, or mock for demo)
      return {
        id: peerId,
        username: friend?.username || `Operator #${peerId}`,
        stream: stream,
        isLocal: false,
        muted: false, // In simple mesh we rely on remote tracks, muted info is best sent in socket message, but default to false
        cameraOff: stream.getVideoTracks().length === 0 || !stream.getVideoTracks()[0].enabled,
        handRaised: false, // Default
      };
    }),
  ];

  const totalParticipants = participants.length;

  // Grid column sizing calculations based on participant count
  const getGridCols = () => {
    if (totalParticipants <= 1) return 'grid-cols-1 md:grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-1 md:grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2 md:grid-cols-2';
    return 'grid-cols-2 md:grid-cols-3';
  };

  return (
    <div className="flex-1 h-screen bg-zinc-950 flex flex-col justify-between overflow-hidden relative p-4 font-sans select-none">
      
      {/* Participant Video Grid */}
      <div className={`flex-1 grid ${getGridCols()} gap-4 items-center justify-center min-h-0`}>
        {participants.map((p) => {
          const isSpeaking = activeSpeakerId === p.id;
          const initials = p.username.substring(0, 2).toUpperCase();

          return (
            <div
              key={p.id}
              className={`relative w-full h-full rounded-2xl bg-zinc-900 border overflow-hidden aspect-video flex items-center justify-center transition-all duration-300 ${
                isSpeaking
                  ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.35)] z-10'
                  : p.handRaised
                  ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-zinc-800'
              }`}
            >
              
              {/* Actual Video Track Player */}
              {p.stream && !p.cameraOff ? (
                <VideoPlayer stream={p.stream} muted={p.isLocal} />
              ) : (
                /* Avatar Placeholder when camera is disabled */
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white text-xl shadow-lg">
                    {initials}
                  </div>
                  <span className="text-xs text-zinc-400 font-semibold">{p.username}</span>
                </div>
              )}

              {/* Top overlay badges (status, raise hand) */}
              <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white font-bold tracking-wide">
                  {p.username} {p.isLocal && '(You)'}
                </span>
                
                {p.handRaised && (
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 animate-bounce">
                    <Hand className="w-3 h-3 fill-amber-400" /> Hand Raised
                  </span>
                )}
              </div>

              {/* Bottom overlay status (Mute indicator) */}
              <div className="absolute bottom-3 right-3 z-10 flex gap-1">
                {p.muted && (
                  <div className="bg-rose-500/20 text-rose-400 border border-rose-500/30 backdrop-blur-md p-1.5 rounded-lg">
                    <MicOff className="w-3.5 h-3.5" />
                  </div>
                )}
                {p.cameraOff && (
                  <div className="bg-rose-500/20 text-rose-400 border border-rose-500/30 backdrop-blur-md p-1.5 rounded-lg">
                    <VideoOff className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Conference Controls Bar Overlay */}
      <div className="h-20 bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-md rounded-2xl flex items-center justify-between px-6 shadow-2xl shrink-0 mt-4 animate-in slide-in-from-bottom duration-300">
        
        {/* Left Side: Media Device Selectors */}
        <div className="hidden md:flex gap-3 items-center">
          {/* Camera selector */}
          <div className="flex flex-col gap-1 text-[10px] text-zinc-500 font-semibold">
            <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> Camera</span>
            <select
              value={selectedVideoId || ''}
              onChange={(e) => changeVideoDevice(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 font-bold px-2 py-1 rounded-lg hover:border-indigo-500 outline-none transition"
            >
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera device'}</option>
              ))}
            </select>
          </div>

          {/* Mic selector */}
          <div className="flex flex-col gap-1 text-[10px] text-zinc-500 font-semibold">
            <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> Microphone</span>
            <select
              value={selectedAudioId || ''}
              onChange={(e) => changeAudioDevice(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 font-bold px-2 py-1 rounded-lg hover:border-indigo-500 outline-none transition"
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || 'Mic device'}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Center Section: Core Controls */}
        <div className="flex gap-2">
          {/* Mic Button */}
          <button
            onClick={toggleMic}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition duration-300 ${
              micMuted
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera Button */}
          <button
            onClick={toggleCamera}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition duration-300 ${
              cameraOff
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen Share Button */}
          <button
            onClick={toggleScreenShare}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition duration-300 ${
              screenSharing
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            <Monitor className="w-5 h-5" />
          </button>

          {/* Raise Hand Button */}
          <button
            onClick={toggleRaiseHand}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition duration-300 ${
              raisingHand
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            <Hand className="w-5 h-5" />
          </button>
        </div>

        {/* Right Section: Red End Call Hangup */}
        <div>
          <button
            onClick={leaveRoom}
            className="flex items-center justify-center gap-2 px-4 py-3 md:px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition duration-300"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">End Call</span>
          </button>
        </div>

      </div>

    </div>
  );
};
