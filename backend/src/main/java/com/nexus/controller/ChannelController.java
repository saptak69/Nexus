package com.nexus.controller;

import com.nexus.model.Channel;
import com.nexus.model.Server;
import com.nexus.model.User;
import com.nexus.service.ChannelService;
import com.nexus.service.ServerService;
import com.nexus.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/channels")
public class ChannelController {

    private final ChannelService channelService;
    private final ServerService serverService;
    private final UserService userService;

    public ChannelController(ChannelService channelService, ServerService serverService, UserService userService) {
        this.channelService = channelService;
        this.serverService = serverService;
        this.userService = userService;
    }

    private User getAuthenticatedUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return userService.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("Current user session is invalid"));
        }
        throw new RuntimeException("Unauthorized");
    }

    @GetMapping("/server/{serverId}")
    public ResponseEntity<?> getChannelsByServer(@PathVariable Long serverId) {
        try {
            Server server = serverService.getServerById(serverId)
                    .orElseThrow(() -> new RuntimeException("Server not found"));

            User current = getAuthenticatedUser();
            boolean isMember = server.getMembers().stream()
                    .anyMatch(m -> m.getId().equals(current.getId()));

            if (!isMember) {
                return ResponseEntity.status(403).body("You are not a member of this server");
            }

            List<Channel> channels = channelService.getChannelsByServer(serverId);
            return ResponseEntity.ok(channels);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/server/{serverId}")
    public ResponseEntity<?> createChannel(@PathVariable Long serverId, @RequestBody Map<String, String> body) {
        try {
            Server server = serverService.getServerById(serverId)
                    .orElseThrow(() -> new RuntimeException("Server not found"));

            User current = getAuthenticatedUser();
            // Only server owner or members can create channels (normally only owner or admins, let's allow all members for simplicity, or restrict to owner)
            // Let's restrict to owner for a more realistic permission flow, or allow anyone. Restricting to owner is very professional!
            if (!server.getOwner().getId().equals(current.getId())) {
                return ResponseEntity.status(403).body("Only the server owner can create channels");
            }

            String name = body.get("name");
            String typeStr = body.get("type");

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Channel name is required");
            }

            Channel.ChannelType type = Channel.ChannelType.TEXT;
            if (typeStr != null) {
                type = Channel.ChannelType.valueOf(typeStr.toUpperCase());
            }

            Channel channel = channelService.createChannel(name, type, server);
            return ResponseEntity.ok(channel);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{channelId}")
    public ResponseEntity<?> deleteChannel(@PathVariable Long channelId) {
        try {
            Channel channel = channelService.getChannelById(channelId)
                    .orElseThrow(() -> new RuntimeException("Channel not found"));

            User current = getAuthenticatedUser();
            // Only owner of the server can delete channels
            if (!channel.getServer().getOwner().getId().equals(current.getId())) {
                return ResponseEntity.status(403).body("Only the server owner can delete channels");
            }

            channelService.deleteChannel(channelId);
            return ResponseEntity.ok("Channel deleted successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
