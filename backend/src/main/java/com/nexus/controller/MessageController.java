package com.nexus.controller;

import com.nexus.model.Message;
import com.nexus.model.Reaction;
import com.nexus.model.User;
import com.nexus.service.MessageService;
import com.nexus.service.UserService;
import com.nexus.service.CloudinaryService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService messageService;
    private final UserService userService;
    private final CloudinaryService cloudinaryService;

    public MessageController(MessageService messageService, UserService userService, CloudinaryService cloudinaryService) {
        this.messageService = messageService;
        this.userService = userService;
        this.cloudinaryService = cloudinaryService;
    }

    private User getAuthenticatedUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return userService.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("Current user session is invalid"));
        }
        throw new RuntimeException("Unauthorized");
    }

    @GetMapping("/channel/{channelId}")
    public ResponseEntity<?> getChannelMessages(
            @PathVariable Long channelId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        try {
            List<Message> messages = messageService.getChannelMessages(channelId, page, size);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/dm/{userId}")
    public ResponseEntity<?> getDirectMessages(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        try {
            User current = getAuthenticatedUser();
            List<Message> messages = messageService.getDirectMessages(current.getId(), userId, page, size);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{messageId}")
    public ResponseEntity<?> editMessage(@PathVariable Long messageId, @RequestBody Map<String, String> body) {
        try {
            User current = getAuthenticatedUser();
            String content = body.get("content");
            if (content == null || content.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Content cannot be empty");
            }

            Message edited = messageService.editMessage(messageId, content, current);
            return ResponseEntity.ok(edited);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{messageId}")
    public ResponseEntity<?> deleteMessage(@PathVariable Long messageId) {
        try {
            User current = getAuthenticatedUser();
            Message deleted = messageService.deleteMessage(messageId, current);
            return ResponseEntity.ok(deleted);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{messageId}/react")
    public ResponseEntity<?> addReaction(@PathVariable Long messageId, @RequestParam String emoji) {
        try {
            User current = getAuthenticatedUser();
            Reaction reaction = messageService.addReaction(messageId, current, emoji);
            return ResponseEntity.ok(reaction);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{messageId}/react")
    public ResponseEntity<?> removeReaction(@PathVariable Long messageId, @RequestParam String emoji) {
        try {
            User current = getAuthenticatedUser();
            messageService.removeReaction(messageId, current, emoji);
            return ResponseEntity.ok("Reaction removed");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body("File is empty");
            }

            Map<?, ?> uploadResult = cloudinaryService.upload(file);
            String fileUrl = (String) uploadResult.get("secure_url");
            String originalFileName = file.getOriginalFilename();

            Map<String, String> response = new HashMap<>();
            response.put("fileUrl", fileUrl);
            response.put("fileName", originalFileName);
            response.put("fileType", file.getContentType());

            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(500).body("Could not store file on Cloudinary. Error: " + e.getMessage());
        }
    }
}
