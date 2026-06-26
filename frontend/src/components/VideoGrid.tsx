import React, { useRef, useEffect } from 'react';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Hand, Volume2, Camera } from 'lucide-react';

// Video Player with sharp corners
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
      className={`w-full h-full object-cover rounded-none ${className}`}
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

  const participants = [
    {
      id: user?.id || 0,
      username: user?.username || 'YOU',
      stream: localStream,
      isLocal: true,
      muted: micMuted,
      cameraOff: cameraOff,
      handRaised: raisingHand,
    },
    ...Object.entries(remoteStreams).map(([peerIdStr, stream]) => {
      const peerId = Number(peerIdStr);
      const friend = friends.find((f) => f.id === peerId);
      
      return {
        id: peerId,
        username: friend?.username || `OPERATOR_${peerId}`,
        stream: stream,
        isLocal: false,
        muted: false,
        cameraOff: stream.getVideoTracks().length === 0 || !stream.getVideoTracks()[0].enabled,
        handRaised: false,
      };
    }),
  ];

  const totalParticipants = participants.length;

  const getGridCols = () => {
    if (totalParticipants <= 1) return 'grid-cols-1 md:grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-1 md:grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2 md:grid-cols-2';
    return 'grid-cols-2 md:grid-cols-3';
  };

  return (
    <div className="flex-1 h-screen bg-black flex flex-col justify-between overflow-hidden relative p-4 font-mono select-none border-l border-zinc-900">
      
      {/* Participant Video Grid with stark outline containers */}
      <div className={`flex-1 grid ${getGridCols()} gap-4 items-center justify-center min-h-0`}>
        {participants.map((p) => {
          const isSpeaking = activeSpeakerId === p.id;
          const initials = p.username.substring(0, 2).toUpperCase();

          return (
            <div
              key={p.id}
              className={`relative w-full h-full rounded-none bg-zinc-950 border overflow-hidden aspect-video flex items-center justify-center transition-all duration-75 ${
                isSpeaking
                  ? 'border-white border-2 z-10 shadow-none'
                  : p.handRaised
                  ? 'border-white border-dashed z-10 shadow-none'
                  : 'border-zinc-900'
              }`}
            >
              
              {/* Video Player */}
              {p.stream && !p.cameraOff ? (
                <VideoPlayer stream={p.stream} muted={p.isLocal} />
              ) : (
                /* Monospaced Initial Placeholder */
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-none bg-zinc-900 border border-white/20 flex items-center justify-center font-mono font-black text-white text-lg">
                    {initials}
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{p.username}</span>
                </div>
              )}

              {/* Top overlay badges (status, raise hand) */}
              <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                <span className="bg-black border border-zinc-800 px-2 py-0.5 text-[9px] text-white font-bold tracking-wider uppercase">
                  {p.username} {p.isLocal && '(YOU)'}
                </span>
                
                {p.handRaised && (
                  <span className="bg-white text-black border border-white px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase flex items-center gap-1">
                    <Hand className="w-3 h-3 fill-black" /> [HAND RAISED]
                  </span>
                )}
              </div>

              {/* Bottom overlay status (Mute indicators) */}
              <div className="absolute bottom-3 right-3 z-10 flex gap-1">
                {p.muted && (
                  <div className="bg-black border border-white/20 p-1 rounded-none text-red-500">
                    <MicOff className="w-3 h-3" />
                  </div>
                )}
                {p.cameraOff && (
                  <div className="bg-black border border-white/20 p-1 rounded-none text-red-500">
                    <VideoOff className="w-3 h-3" />
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Conference Controls Bar Overlay (Nothing OS stark toolbar style) */}
      <div className="h-20 bg-black border border-zinc-900 rounded-none flex items-center justify-between px-6 shadow-none shrink-0 mt-4 animate-in slide-in-from-bottom duration-75">
        
        {/* Left Side: Media Device selectors (Monochrome dropdowns) */}
        <div className="hidden md:flex gap-4 items-center">
          <div className="flex flex-col gap-1 text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> CAMERA_STREAM</span>
            <select
              value={selectedVideoId || ''}
              onChange={(e) => changeVideoDevice(e.target.value)}
              className="bg-black border border-zinc-800 text-[10px] text-white font-bold px-2 py-1 rounded-none hover:border-white outline-none transition uppercase tracking-wider font-mono cursor-pointer"
            >
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label.toUpperCase() || 'CAMERA DEVICE'}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> AUDIO_STREAM</span>
            <select
              value={selectedAudioId || ''}
              onChange={(e) => changeAudioDevice(e.target.value)}
              className="bg-black border border-zinc-800 text-[10px] text-white font-bold px-2 py-1 rounded-none hover:border-white outline-none transition uppercase tracking-wider font-mono cursor-pointer"
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label.toUpperCase() || 'MICROPHONE'}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Core Action Grid (snappy toggle transitions) */}
        <div className="flex gap-2">
          {/* Microphone Toggle */}
          <button
            onClick={toggleMic}
            className={`w-10 h-10 rounded-none flex items-center justify-center border kinematic-transition ${
              micMuted
                ? 'bg-red-500/10 border-red-500 text-red-500'
                : 'bg-black border-zinc-800 hover:bg-white hover:text-black hover:border-white text-white'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`w-10 h-10 rounded-none flex items-center justify-center border kinematic-transition ${
              cameraOff
                ? 'bg-red-500/10 border-red-500 text-red-500'
                : 'bg-black border-zinc-800 hover:bg-white hover:text-black hover:border-white text-white'
            }`}
          >
            {cameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 rounded-none flex items-center justify-center border border-zinc-800 text-white hover:bg-white hover:text-black hover:border-white kinematic-transition ${
              screenSharing ? 'bg-white text-black border-white' : 'bg-black'
            }`}
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Raise Hand Toggle */}
          <button
            onClick={toggleRaiseHand}
            className={`w-10 h-10 rounded-none flex items-center justify-center border kinematic-transition ${
              raisingHand
                ? 'bg-white border-white text-black animate-pulse'
                : 'bg-black border-zinc-800 hover:bg-white hover:text-black hover:border-white text-white'
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>
        </div>

        {/* Right: End Session (Stark Red or Outline Button) */}
        <div>
          <button
            onClick={leaveRoom}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-none bg-black border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono font-black text-xs transition duration-75 btn-interactive uppercase"
            title="Disconnect Stream"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DISCONNECT</span>
          </button>
        </div>

      </div>

    </div>
  );
};
