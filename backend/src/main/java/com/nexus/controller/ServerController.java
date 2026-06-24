package com.nexus.controller;

import com.nexus.model.Server;
import com.nexus.model.User;
import com.nexus.service.ServerService;
import com.nexus.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/servers")
public class ServerController {

    private final ServerService serverService;
    private final UserService userService;

    public ServerController(ServerService serverService, UserService userService) {
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

    @PostMapping
    public ResponseEntity<?> createServer(@RequestBody Map<String, String> body) {
        try {
            User current = getAuthenticatedUser();
            String name = body.get("name");
            String iconUrl = body.get("iconUrl");
            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Server name is required");
            }

            Server server = serverService.createServer(name, iconUrl, current);
            return ResponseEntity.ok(server);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> getMyServers() {
        try {
            User current = getAuthenticatedUser();
            List<Server> servers = serverService.getServersForUser(current.getId());
            return ResponseEntity.ok(servers);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinServer(@RequestBody Map<String, String> body) {
        try {
            User current = getAuthenticatedUser();
            String inviteCode = body.get("inviteCode");
            if (inviteCode == null || inviteCode.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Invite code is required");
            }

            Server server = serverService.joinServer(inviteCode, current);
            return ResponseEntity.ok(server);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{serverId}/leave")
    public ResponseEntity<?> leaveServer(@PathVariable Long serverId) {
        try {
            User current = getAuthenticatedUser();
            Server server = serverService.leaveServer(serverId, current);
            return ResponseEntity.ok("Successfully left server: " + server.getName());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{serverId}")
    public ResponseEntity<?> getServerById(@PathVariable Long serverId) {
        try {
            Server server = serverService.getServerById(serverId)
                    .orElseThrow(() -> new RuntimeException("Server not found"));

            // Secure membership check
            User current = getAuthenticatedUser();
            boolean isMember = server.getMembers().stream()
                    .anyMatch(m -> m.getId().equals(current.getId()));

            if (!isMember) {
                return ResponseEntity.status(403).body("You are not a member of this server");
            }

            return ResponseEntity.ok(server);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
