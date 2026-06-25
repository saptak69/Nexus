package com.nexus.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.model.Channel;
import com.nexus.model.Message;
import com.nexus.model.User;
import com.nexus.security.JwtTokenProvider;
import com.nexus.service.ChannelService;
import com.nexus.service.MessageService;
import com.nexus.service.UserService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class NexusWebSocketHandler extends TextWebSocketHandler {

    private final JwtTokenProvider tokenProvider;
    private final UserService userService;
    private final ChannelService channelService;
    private final MessageService messageService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Map: userId -> WebSocketSession (to find open sockets for DMs / direct calls)
    private final ConcurrentHashMap<Long, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    
    // Map: sessionId -> userId (for reverse lookup on disconnect)
    private final ConcurrentHashMap<String, Long> sessionUsers = new ConcurrentHashMap<>();

    // Map: roomId (channel_id or custom dm call id) -> Set<userId> (for WebRTC and presence broadcasting in rooms)
    private final ConcurrentHashMap<String, CopyOnWriteArraySet<Long>> roomParticipants = new ConcurrentHashMap<>();

    public NexusWebSocketHandler(JwtTokenProvider tokenProvider,
                                 UserService userService,
                                 ChannelService channelService,
                                 MessageService messageService) {
        this.tokenProvider = tokenProvider;
        this.userService = userService;
        this.channelService = channelService;
        this.messageService = messageService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        if (uri == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String query = uri.getQuery();
        String token = null;
        if (query != null && query.contains("token=")) {
            token = query.split("token=")[1].split("&")[0];
        }

        if (token == null || !tokenProvider.validateToken(token)) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }

        String username = tokenProvider.getUsernameFromToken(token);
        User user = userService.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Long userId = user.getId();
        
        // Save connection mapping
        userSessions.put(userId, session);
        sessionUsers.put(session.getId(), userId);

        // Update user status to ONLINE in DB
        userService.updatePresence(userId, User.PresenceStatus.ONLINE);

        // Broadcast presence change to all active friends / connected users
        broadcastPresence(userId, "ONLINE");
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Long senderId = sessionUsers.get(session.getId());
        if (senderId == null) return;

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(message.getPayload(), Map.class);
        } catch (Exception e) {
            return; // Bad JSON payload
        }

        String type = (String) payload.get("type");
        if (type == null) return;

        switch (type.toUpperCase()) {
            case "JOIN_ROOM":
                handleJoinRoom(senderId, payload);
                break;
            case "LEAVE_ROOM":
                handleLeaveRoom(senderId, payload);
                break;
            case "SIGNAL":
                handleSignal(senderId, payload);
                break;
            case "DECLINE_CALL":
                handleDeclineCall(senderId, payload);
                break;
            case "TYPING":
                handleTyping(senderId, payload);
                break;
            case "CHAT_MESSAGE":
                handleChatMessage(senderId, payload);
                break;
            default:
                // Unknown message type
                break;
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        Long userId = sessionUsers.remove(session.getId());
        if (userId != null) {
            userSessions.remove(userId);

            // Clean user from all video rooms
            for (Map.Entry<String, CopyOnWriteArraySet<Long>> entry : roomParticipants.entrySet()) {
                if (entry.getValue().remove(userId)) {
                    broadcastRoomUpdate(entry.getKey());
                }
            }

            // Set user presence to OFFLINE in DB
            userService.updatePresence(userId, User.PresenceStatus.OFFLINE);

            // Broadcast status change
            broadcastPresence(userId, "OFFLINE");
        }
    }

    private void handleJoinRoom(Long userId, Map<String, Object> payload) {
        String roomId = (String) payload.get("roomId");
        if (roomId == null) return;

        roomParticipants.putIfAbsent(roomId, new CopyOnWriteArraySet<>());
        roomParticipants.get(roomId).add(userId);

        // Notify room members
        broadcastRoomUpdate(roomId);

        // For direct message video calls, notify the other participant
        if (roomId.startsWith("dm_")) {
            String[] parts = roomId.split("_");
            if (parts.length == 3) {
                try {
                    Long id1 = Long.valueOf(parts[1]);
                    Long id2 = Long.valueOf(parts[2]);
                    Long targetId = userId.equals(id1) ? id2 : id1;

                    CopyOnWriteArraySet<Long> participants = roomParticipants.get(roomId);
                    if (participants != null && !participants.contains(targetId)) {
                        WebSocketSession targetSession = userSessions.get(targetId);
                        if (targetSession != null && targetSession.isOpen()) {
                            User sender = userService.findById(userId).orElse(null);
                            Map<String, Object> callInvite = new HashMap<>();
                            callInvite.put("type", "INCOMING_CALL");
                            callInvite.put("senderId", userId);
                            callInvite.put("senderName", sender != null ? sender.getUsername() : "Someone");
                            callInvite.put("roomId", roomId);
                            sendJson(targetSession, callInvite);
                        }
                    }
                } catch (NumberFormatException e) {
                    // Ignore
                }
            }
        }
    }

    private void handleLeaveRoom(Long userId, Map<String, Object> payload) {
        String roomId = (String) payload.get("roomId");
        if (roomId == null) return;

        if (roomParticipants.containsKey(roomId)) {
            roomParticipants.get(roomId).remove(userId);
            broadcastRoomUpdate(roomId);
        }
    }

    private void handleSignal(Long senderId, Map<String, Object> payload) {
        // WebRTC Signaling routing: send candidate/offer/answer to target user
        Object targetIdObj = payload.get("targetId");
        if (targetIdObj == null) return;

        Long targetId = Long.valueOf(targetIdObj.toString());
        WebSocketSession targetSession = userSessions.get(targetId);

        if (targetSession != null && targetSession.isOpen()) {
            Map<String, Object> forward = new HashMap<>();
            forward.put("type", "SIGNAL");
            forward.put("senderId", senderId);
            forward.put("signal", payload.get("signal"));
            forward.put("roomId", payload.get("roomId"));
            
            sendJson(targetSession, forward);
        }
    }

    private void handleDeclineCall(Long senderId, Map<String, Object> payload) {
        Object targetIdObj = payload.get("targetId");
        if (targetIdObj == null) return;

        Long targetId = Long.valueOf(targetIdObj.toString());
        WebSocketSession targetSession = userSessions.get(targetId);

        if (targetSession != null && targetSession.isOpen()) {
            User sender = userService.findById(senderId).orElse(null);
            Map<String, Object> forward = new HashMap<>();
            forward.put("type", "DECLINE_CALL");
            forward.put("senderId", senderId);
            forward.put("senderName", sender != null ? sender.getUsername() : "User");
            forward.put("roomId", payload.get("roomId"));
            
            sendJson(targetSession, forward);
        }
    }

    private void handleTyping(Long senderId, Map<String, Object> payload) {
        String roomId = (String) payload.get("roomId"); // Can be channel ID
        if (roomId == null) return;

        CopyOnWriteArraySet<Long> participants = roomParticipants.get(roomId);
        if (participants == null) return;

        Map<String, Object> typingEvent = new HashMap<>();
        typingEvent.put("type", "TYPING");
        typingEvent.put("senderId", senderId);
        typingEvent.put("senderName", payload.get("senderName"));
        typingEvent.put("isTyping", payload.get("isTyping"));
        typingEvent.put("roomId", roomId);

        // Broadcast to everyone else in the room
        for (Long recipientId : participants) {
            if (!recipientId.equals(senderId)) {
                WebSocketSession session = userSessions.get(recipientId);
                if (session != null && session.isOpen()) {
                    sendJson(session, typingEvent);
                }
            }
        }
    }

    private void handleChatMessage(Long senderId, Map<String, Object> payload) {
        try {
            String content = (String) payload.get("content");
            String fileUrl = (String) payload.get("fileUrl");
            String fileName = (String) payload.get("fileName");
            String fileType = (String) payload.get("fileType");
            Object channelIdObj = payload.get("channelId");
            Object recipientIdObj = payload.get("recipientId");
            Object parentIdObj = payload.get("parentId");

            Long parentId = parentIdObj != null ? Long.valueOf(parentIdObj.toString()) : null;
            User sender = userService.findById(senderId)
                    .orElseThrow(() -> new RuntimeException("Sender not found"));

            Message savedMessage;

            if (channelIdObj != null) {
                Long channelId = Long.valueOf(channelIdObj.toString());
                Channel channel = channelService.getChannelById(channelId)
                        .orElseThrow(() -> new RuntimeException("Channel not found"));

                savedMessage = messageService.saveChannelMessage(content, sender, channel, parentId, fileUrl, fileName, fileType);
                
                // Broadcast to all active users in the channel room
                String roomId = "channel_" + channelId;
                CopyOnWriteArraySet<Long> members = roomParticipants.get(roomId);
                
                Map<String, Object> chatEvent = new HashMap<>();
                chatEvent.put("type", "CHAT_MESSAGE");
                chatEvent.put("message", savedMessage);
                chatEvent.put("roomId", roomId);

                boolean senderNotified = false;
                if (members != null) {
                    for (Long memberId : members) {
                        if (memberId.equals(senderId)) {
                            senderNotified = true;
                        }
                        WebSocketSession session = userSessions.get(memberId);
                        if (session != null && session.isOpen()) {
                            sendJson(session, chatEvent);
                        }
                    }
                }
                // Fallback: ensure sender session receives the message event even if they aren't in the room list
                if (!senderNotified) {
                    WebSocketSession senderSession = userSessions.get(senderId);
                    if (senderSession != null && senderSession.isOpen()) {
                        sendJson(senderSession, chatEvent);
                    }
                }
            } else if (recipientIdObj != null) {
                Long recipientId = Long.valueOf(recipientIdObj.toString());
                User recipient = userService.findById(recipientId)
                        .orElseThrow(() -> new RuntimeException("Recipient not found"));

                savedMessage = messageService.saveDirectMessage(content, sender, recipient, parentId, fileUrl, fileName, fileType);

                Map<String, Object> chatEvent = new HashMap<>();
                chatEvent.put("type", "CHAT_MESSAGE");
                chatEvent.put("message", savedMessage);

                // Send to recipient
                WebSocketSession recipientSession = userSessions.get(recipientId);
                if (recipientSession != null && recipientSession.isOpen()) {
                    sendJson(recipientSession, chatEvent);
                }

                // Send back to sender for optimistic updates synching
                WebSocketSession senderSession = userSessions.get(senderId);
                if (senderSession != null && senderSession.isOpen()) {
                    sendJson(senderSession, chatEvent);
                }

                // AI Bot automated reply check
                if (recipient.getUsername().equals("nexus_bot")) {
                    final String userMsg = content;
                    final String userFileUrl = fileUrl;
                    final String userFileName = fileName;
                    final String userFileType = fileType;
                    new Thread(() -> {
                        try {
                            Thread.sleep(1000);
                            
                            // Send typing indicator start
                            Map<String, Object> typingStart = new HashMap<>();
                            typingStart.put("type", "TYPING");
                            typingStart.put("senderId", recipient.getId());
                            typingStart.put("senderName", recipient.getUsername());
                            typingStart.put("isTyping", true);
                            typingStart.put("roomId", "dm_" + recipient.getId());
                            
                            if (senderSession != null && senderSession.isOpen()) {
                                sendJson(senderSession, typingStart);
                            }
                            
                            Thread.sleep(1500); // simulate typing for 1.5 seconds
                            
                            // Send typing indicator stop
                            Map<String, Object> typingStop = new HashMap<>();
                            typingStop.put("type", "TYPING");
                            typingStop.put("senderId", recipient.getId());
                            typingStop.put("senderName", recipient.getUsername());
                            typingStop.put("isTyping", false);
                            typingStop.put("roomId", "dm_" + recipient.getId());
                            
                            if (senderSession != null && senderSession.isOpen()) {
                                sendJson(senderSession, typingStop);
                            }

                            // Generate bot content
                            String replyContent = "Hi! I am Nexus Bot. 🤖 I received your message: \"" + userMsg + "\". I can help you test this WhatsApp clone. Feel free to upload files using the attachment icon (📎) or test the mobile layout by resizing your window!";
                            
                            if (userFileUrl != null) {
                                replyContent = "Awesome file! 📎 I received your attachment \"" + userFileName + "\" (" + userFileType + "). I can render images, audio, video, and download links directly in our chat!";
                            }
                            
                            Message botSaved = messageService.saveDirectMessage(replyContent, recipient, sender, null, null, null, null);
                            
                            Map<String, Object> botChatEvent = new HashMap<>();
                            botChatEvent.put("type", "CHAT_MESSAGE");
                            botChatEvent.put("message", botSaved);
                            
                            if (senderSession != null && senderSession.isOpen()) {
                                sendJson(senderSession, botChatEvent);
                            }
                        } catch (InterruptedException e) {
                            // ignore
                        }
                    }).start();
                }
            }
        } catch (Exception e) {
            // Log error saving message
        }
    }

    private void broadcastRoomUpdate(String roomId) {
        CopyOnWriteArraySet<Long> participants = roomParticipants.get(roomId);
        if (participants == null) return;

        Map<String, Object> roomUpdate = new HashMap<>();
        roomUpdate.put("type", "ROOM_USERS");
        roomUpdate.put("roomId", roomId);
        roomUpdate.put("users", participants);

        for (Long userId : participants) {
            WebSocketSession session = userSessions.get(userId);
            if (session != null && session.isOpen()) {
                sendJson(session, roomUpdate);
            }
        }
    }

    private void broadcastPresence(Long userId, String presenceStatus) {
        Map<String, Object> presenceEvent = new HashMap<>();
        presenceEvent.put("type", "PRESENCE");
        presenceEvent.put("userId", userId);
        presenceEvent.put("presence", presenceStatus);

        // Broadcast to all active socket sessions (simplifies propagation across active workspace clients)
        for (WebSocketSession session : userSessions.values()) {
            if (session.isOpen()) {
                sendJson(session, presenceEvent);
            }
        }
    }

    private void sendJson(WebSocketSession session, Object obj) {
        try {
            String json = objectMapper.writeValueAsString(obj);
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            // Log socket send failure
        }
    }
}
