import { create } from 'zustand';
import { useChatStore } from './useChatStore';
import { useAuthStore } from './useAuthStore';

interface WebRTCState {
  // Streams
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Record<number, MediaStream>; // userId -> MediaStream
  
  // Connection states
  peerConnections: Record<number, RTCPeerConnection>; // userId -> RTCPeerConnection
  roomId: string | null;
  inCall: boolean;
  
  // Mute & Camera controls
  micMuted: boolean;
  cameraOff: boolean;
  screenSharing: boolean;
  raisingHand: boolean;
  activeSpeakerId: number | null;
  
  // Device lists
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
  selectedVideoId: string | null;
  selectedAudioId: string | null;
  
  // Call status
  incomingCall: { senderId: number; senderName: string; roomId: string } | null;
  
  // Actions
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleRaiseHand: () => void;
  fetchDevices: () => Promise<void>;
  changeVideoDevice: (deviceId: string) => Promise<void>;
  changeAudioDevice: (deviceId: string) => Promise<void>;
  handleIncomingSignal: (senderId: number, signal: any) => Promise<void>;
  syncPeers: (activeUserIds: number[]) => void;
  setIncomingCall: (incomingCall: { senderId: number; senderName: string; roomId: string } | null) => void;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export const useWebRTCStore = create<WebRTCState>((set, get) => {
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let voiceDetectionInterval: any = null;

  // Active Speaker Detection
  const startSpeakerDetection = (stream: MediaStream) => {
    try {
      if (audioContext) audioContext.close();
      
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      voiceDetectionInterval = setInterval(() => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Voice threshold
        if (average > 30) {
          const currentUserId = useAuthStore.getState().user?.id;
          if (currentUserId && get().activeSpeakerId !== currentUserId && !get().micMuted) {
            set({ activeSpeakerId: currentUserId });
          }
        }
      }, 500);
    } catch (e) {
      console.warn("Active speaker detection setup failed", e);
    }
  };

  const stopSpeakerDetection = () => {
    if (voiceDetectionInterval) clearInterval(voiceDetectionInterval);
    if (audioContext) audioContext.close();
    audioContext = null;
    analyser = null;
  };

  return {
    localStream: null,
    screenStream: null,
    remoteStreams: {},
    peerConnections: {},
    roomId: null,
    inCall: false,
    micMuted: false,
    cameraOff: false,
    screenSharing: false,
    raisingHand: false,
    activeSpeakerId: null,
    videoDevices: [],
    audioDevices: [],
    selectedVideoId: null,
    selectedAudioId: null,
    incomingCall: null,

    setIncomingCall: (incomingCall) => {
      if (get().inCall && incomingCall) return;
      set({ incomingCall });
    },

    acceptCall: async () => {
      const { incomingCall } = get();
      if (!incomingCall) return;
      const roomId = incomingCall.roomId;
      set({ incomingCall: null });
      await get().joinRoom(roomId);
    },

    declineCall: () => {
      const { incomingCall } = get();
      const socket = useChatStore.getState().socket;
      if (incomingCall && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'DECLINE_CALL',
          targetId: incomingCall.senderId,
          roomId: incomingCall.roomId,
        }));
      }
      set({ incomingCall: null });
    },

    fetchDevices: async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const video = devices.filter((d) => d.kind === 'videoinput');
        const audio = devices.filter((d) => d.kind === 'audioinput');
        set({
          videoDevices: video,
          audioDevices: audio,
          selectedVideoId: video[0]?.deviceId || null,
          selectedAudioId: audio[0]?.deviceId || null,
        });
      } catch (err) {
        console.error('Error fetching media devices', err);
      }
    },

    joinRoom: async (roomId) => {
      const socket = useChatStore.getState().socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket connection is not open');
      }

      await get().fetchDevices();
      const { selectedVideoId, selectedAudioId } = get();

      try {
        // Request local audio and video streams
        const constraints: MediaStreamConstraints = {
          video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
          audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        set({
          localStream: stream,
          inCall: true,
          roomId,
          micMuted: false,
          cameraOff: false,
          screenSharing: false,
          raisingHand: false,
          remoteStreams: {},
          peerConnections: {},
        });

        // Join room WS
        socket.send(JSON.stringify({ type: 'JOIN_ROOM', roomId }));

        // Start local speaker detection
        startSpeakerDetection(stream);

      } catch (err) {
        console.error('Failed to get media devices', err);
        throw err;
      }
    },

    leaveRoom: () => {
      const socket = useChatStore.getState().socket;
      const { roomId, localStream, screenStream, peerConnections } = get();

      // Send leaving notify
      if (socket && socket.readyState === WebSocket.OPEN && roomId) {
        socket.send(JSON.stringify({ type: 'LEAVE_ROOM', roomId }));
      }

      // Stop local tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }

      // Stop speaker detection
      stopSpeakerDetection();

      // Close all peer connections
      Object.values(peerConnections).forEach((pc) => {
        pc.close();
      });

      set({
        localStream: null,
        screenStream: null,
        remoteStreams: {},
        peerConnections: {},
        roomId: null,
        inCall: false,
        micMuted: false,
        cameraOff: false,
        screenSharing: false,
        raisingHand: false,
        activeSpeakerId: null,
      });
    },

    toggleMic: () => {
      const { localStream, micMuted } = get();
      if (!localStream) return;

      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = micMuted; // Toggle enablement
        set({ micMuted: !micMuted });
      }
    },

    toggleCamera: () => {
      const { localStream, cameraOff } = get();
      if (!localStream) return;

      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = cameraOff; // Toggle enablement
        set({ cameraOff: !cameraOff });
      }
    },

    toggleScreenShare: async () => {
      const { screenSharing, screenStream, localStream, peerConnections } = get();

      if (screenSharing) {
        // Stop screen share
        if (screenStream) {
          screenStream.getTracks().forEach((t) => t.stop());
        }

        // Revert to camera
        const cameraTrack = localStream?.getVideoTracks()[0];
        if (cameraTrack) {
          Object.values(peerConnections).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(cameraTrack);
            }
          });
        }
        set({ screenSharing: false, screenStream: null });
      } else {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const screenTrack = stream.getVideoTracks()[0];

          // Set callback for when user clicks "Stop Sharing" from Chrome header
          screenTrack.onended = () => {
            get().toggleScreenShare(); // Toggle it off
          };

          Object.values(peerConnections).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          });

          set({ screenSharing: true, screenStream: stream });
        } catch (err) {
          console.error('Error sharing screen', err);
        }
      }
    },

    toggleRaiseHand: () => {
      set((state) => ({ raisingHand: !state.raisingHand }));
      // Optional: send socket event or let UI handle drawing badge
    },

    changeVideoDevice: async (deviceId) => {
      const { inCall, localStream, peerConnections } = get();
      set({ selectedVideoId: deviceId });

      if (inCall && localStream) {
        // Stop old video track
        const oldTrack = localStream.getVideoTracks()[0];
        if (oldTrack) oldTrack.stop();

        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
          });
          const newTrack = newStream.getVideoTracks()[0];

          // Add to local stream
          localStream.removeTrack(oldTrack);
          localStream.addTrack(newTrack);

          // Replace track in peer connections
          Object.values(peerConnections).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(newTrack);
            }
          });

          set({ localStream: new MediaStream(localStream.getTracks()) });
        } catch (err) {
          console.error('Error switching video device', err);
        }
      }
    },

    changeAudioDevice: async (deviceId) => {
      const { inCall, localStream, peerConnections } = get();
      set({ selectedAudioId: deviceId });

      if (inCall && localStream) {
        const oldTrack = localStream.getAudioTracks()[0];
        if (oldTrack) oldTrack.stop();

        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } },
          });
          const newTrack = newStream.getAudioTracks()[0];

          localStream.removeTrack(oldTrack);
          localStream.addTrack(newTrack);

          Object.values(peerConnections).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
            if (sender) {
              sender.replaceTrack(newTrack);
            }
          });

          set({ localStream: new MediaStream(localStream.getTracks()) });
          startSpeakerDetection(localStream);
        } catch (err) {
          console.error('Error switching audio device', err);
        }
      }
    },

    handleIncomingSignal: async (senderId, signal) => {
      const { peerConnections, localStream, roomId } = get();
      const socket = useChatStore.getState().socket;
      if (!socket || !roomId) return;

      let pc = peerConnections[senderId];

      if (signal.sdp && signal.type === 'offer') {
        // If we don't have a peer connection yet, initialize it
        if (!pc) {
          pc = new RTCPeerConnection(ICE_SERVERS);
          
          // Add local tracks
          if (localStream) {
            localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
          }

          // Register ice candidate listener
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.send(JSON.stringify({
                type: 'SIGNAL',
                targetId: senderId,
                roomId,
                signal: { type: 'candidate', candidate: event.candidate },
              }));
            }
          };

          // Register remote track listener
          pc.ontrack = (event) => {
            set((state) => {
              const updated = { ...state.remoteStreams };
              updated[senderId] = event.streams[0];
              return { remoteStreams: updated };
            });
          };

          set((state) => {
            const updated = { ...state.peerConnections };
            updated[senderId] = pc;
            return { peerConnections: updated };
          });
        }

        // Apply offer and create answer
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.send(JSON.stringify({
          type: 'SIGNAL',
          targetId: senderId,
          roomId,
          signal: { type: 'answer', sdp: answer.sdp },
        }));

      } else if (signal.sdp && signal.type === 'answer') {
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        }
      } else if (signal.candidate) {
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            console.warn("Error adding ICE candidate", e);
          }
        }
      }
    },

    syncPeers: (activeUserIds) => {
      const { peerConnections, localStream, roomId, inCall } = get();
      const socket = useChatStore.getState().socket;
      const currentUserId = useAuthStore.getState().user?.id;
      
      if (!inCall || !roomId || !socket || !currentUserId) return;

      // Filter out self
      const peers = activeUserIds.filter((id) => id !== currentUserId);

      // 1. Clean up stale connections (users who left)
      Object.keys(peerConnections).forEach((peerIdStr) => {
        const peerId = Number(peerIdStr);
        if (!peers.includes(peerId)) {
          peerConnections[peerId].close();
          set((state) => {
            const pcUpdated = { ...state.peerConnections };
            delete pcUpdated[peerId];

            const streamUpdated = { ...state.remoteStreams };
            delete streamUpdated[peerId];

            return {
              peerConnections: pcUpdated,
              remoteStreams: streamUpdated,
            };
          });
        }
      });

      // 2. Initiate connections to new peers.
      // To avoid glare (double connection requests), we only initiate calls if our userId is less than peer's userId.
      // The other user (with larger userId) will receive the offer and respond with an answer.
      peers.forEach(async (peerId) => {
        if (!peerConnections[peerId] && currentUserId < peerId) {
          const pc = new RTCPeerConnection(ICE_SERVERS);
          
          if (localStream) {
            localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
          }

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.send(JSON.stringify({
                type: 'SIGNAL',
                targetId: peerId,
                roomId,
                signal: { type: 'candidate', candidate: event.candidate },
              }));
            }
          };

          pc.ontrack = (event) => {
            set((state) => {
              const updated = { ...state.remoteStreams };
              updated[peerId] = event.streams[0];
              return { remoteStreams: updated };
            });
          };

          set((state) => {
            const updated = { ...state.peerConnections };
            updated[peerId] = pc;
            return { peerConnections: updated };
          });

          // Create offer
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            socket.send(JSON.stringify({
              type: 'SIGNAL',
              targetId: peerId,
              roomId,
              signal: { type: 'offer', sdp: offer.sdp },
            }));
          } catch (e) {
            console.error("Failed to create offer for peer: " + peerId, e);
          }
        }
      });
    },
  };
});
