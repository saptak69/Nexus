package com.nexus.controller;

import com.nexus.model.User;
import com.nexus.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
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

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUserById(@PathVariable Long userId) {
        try {
            User user = userService.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/presence")
    public ResponseEntity<?> updatePresence(@RequestBody Map<String, String> body) {
        try {
            User current = getAuthenticatedUser();
            String presenceStr = body.get("presence");
            User.PresenceStatus presence = User.PresenceStatus.valueOf(presenceStr.toUpperCase());
            User updated = userService.updatePresence(current.getId(), presence);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error updating presence: " + e.getMessage());
        }
    }

    @PutMapping("/status")
    public ResponseEntity<?> updateStatusMessage(@RequestBody Map<String, String> body) {
        try {
            User current = getAuthenticatedUser();
            String statusMessage = body.get("statusMessage");
            User updated = userService.updateStatusMessage(current.getId(), statusMessage);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/avatar")
    public ResponseEntity<?> updateAvatar(@RequestBody Map<String, String> body) {
        try {
            User current = getAuthenticatedUser();
            String avatarUrl = body.get("avatarUrl");
            User updated = userService.updateAvatar(current.getId(), avatarUrl);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(@RequestParam String query) {
        try {
            User current = getAuthenticatedUser();
            List<User> users = userService.searchUsers(query).stream()
                    .filter(u -> !u.getId().equals(current.getId()))
                    .toList();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> getAllUsers() {
        try {
            User current = getAuthenticatedUser();
            List<User> users = userService.findAllExcept(current.getId());
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            return ResponseEntity.ok(userService.findAll());
        }
    }
}
