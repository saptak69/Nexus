package com.nexus.controller;

import com.nexus.model.User;
import com.nexus.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/webrtc")
public class RtcController {

    private static final Logger log = LoggerFactory.getLogger(RtcController.class);

    private final UserService userService;

    @Value("${nexus.webrtc.stun-servers:stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun.cloudflare.com:3478}")
    private String stunServers;

    @Value("${nexus.webrtc.turn-server.url:}")
    private String turnServerUrl;

    @Value("${nexus.webrtc.turn-server.secret:}")
    private String turnServerSecret;

    @Value("${nexus.webrtc.turn-server.ttl-seconds:86400}")
    private long turnTtlSeconds;

    public RtcController(UserService userService) {
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

    @GetMapping("/ice-servers")
    public ResponseEntity<?> getIceServers() {
        User current = getAuthenticatedUser();

        List<Map<String, Object>> iceServers = new ArrayList<>();

        // 1. Multiple STUN server fallbacks (Google + Cloudflare)
        String[] stunList = stunServers.split(",");
        List<String> trimmedStuns = Arrays.stream(stunList)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        Map<String, Object> stunConfig = new HashMap<>();
        stunConfig.put("urls", trimmedStuns);
        iceServers.add(stunConfig);

        // 2. Coturn dynamic time-limited HMAC REST credentials
        if (turnServerUrl != null && !turnServerUrl.trim().isEmpty() &&
            turnServerSecret != null && !turnServerSecret.trim().isEmpty()) {
            try {
                long expiryTimestamp = (System.currentTimeMillis() / 1000) + turnTtlSeconds;
                String turnUsername = expiryTimestamp + ":" + current.getId();

                Mac mac = Mac.getInstance("HmacSHA1");
                SecretKeySpec keySpec = new SecretKeySpec(turnServerSecret.trim().getBytes(StandardCharsets.UTF_8), "HmacSHA1");
                mac.init(keySpec);
                byte[] rawHmac = mac.doFinal(turnUsername.getBytes(StandardCharsets.UTF_8));
                String credential = Base64.getEncoder().encodeToString(rawHmac);

                Map<String, Object> turnConfig = new HashMap<>();
                turnConfig.put("urls", turnServerUrl.trim());
                turnConfig.put("username", turnUsername);
                turnConfig.put("credential", credential);

                iceServers.add(turnConfig);
            } catch (Exception e) {
                log.error("Failed to generate coturn HMAC credentials", e);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("iceServers", iceServers);
        return ResponseEntity.ok(response);
    }
}
