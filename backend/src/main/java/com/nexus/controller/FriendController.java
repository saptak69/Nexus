package com.nexus.controller;

import com.nexus.model.FriendRequest;
import com.nexus.model.User;
import com.nexus.service.FriendService;
import com.nexus.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private final FriendService friendService;
    private final UserService userService;

    public FriendController(FriendService friendService, UserService userService) {
        this.friendService = friendService;
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

    @PostMapping("/request")
    public ResponseEntity<?> sendFriendRequest(@RequestBody Map<String, Long> body) {
        try {
            User current = getAuthenticatedUser();
            Long receiverId = body.get("receiverId");
            if (receiverId == null) {
                return ResponseEntity.badRequest().body("Receiver ID is required");
            }

            User receiver = userService.findById(receiverId)
                    .orElseThrow(() -> new RuntimeException("Receiver not found"));

            FriendRequest request = friendService.sendFriendRequest(current, receiver);
            return ResponseEntity.ok(request);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/request/accept/{requestId}")
    public ResponseEntity<?> acceptRequest(@PathVariable Long requestId) {
        try {
            User current = getAuthenticatedUser();
            FriendRequest request = friendService.acceptFriendRequest(requestId, current);
            return ResponseEntity.ok(request);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/request/reject/{requestId}")
    public ResponseEntity<?> rejectRequest(@PathVariable Long requestId) {
        try {
            User current = getAuthenticatedUser();
            FriendRequest request = friendService.rejectFriendRequest(requestId, current);
            return ResponseEntity.ok(request);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/pending")
    public ResponseEntity<?> getPendingRequests() {
        try {
            User current = getAuthenticatedUser();
            List<FriendRequest> requests = friendService.getPendingRequests(current.getId());
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> getFriends() {
        try {
            User current = getAuthenticatedUser();
            List<User> friends = friendService.getFriends(current.getId());
            return ResponseEntity.ok(friends);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
