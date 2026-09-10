package com.nexus.controller;

import com.nexus.dto.*;
import com.nexus.model.User;
import com.nexus.service.OtpService;
import com.nexus.service.UserService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import com.nexus.security.JwtTokenProvider;
import com.nexus.security.SimpleRateLimiter;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserService userService;
    private final JwtTokenProvider tokenProvider;
    private final OtpService otpService;
    private final ConcurrentHashMap<String, SimpleRateLimiter> ipLimiters = new ConcurrentHashMap<>();

    public AuthController(UserService userService, JwtTokenProvider tokenProvider, OtpService otpService) {
        this.userService = userService;
        this.tokenProvider = tokenProvider;
        this.otpService = otpService;
    }

    private void setJwtCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from("jwt_token", token)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(7 * 24 * 3600) // 7 days
                .sameSite("None")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest registerRequest, HttpServletRequest request, HttpServletResponse response) {
        String ip = request.getRemoteAddr();
        SimpleRateLimiter limiter = ipLimiters.computeIfAbsent(ip, k -> new SimpleRateLimiter(5, 0.2));
        if (!limiter.tryAcquire()) {
            return ResponseEntity.status(429).body("Too many requests. Please try again later.");
        }

        try {
            User user = userService.registerUser(
                    registerRequest.getUsername(),
                    registerRequest.getEmail(),
                    registerRequest.getPassword()
            );

            // Automatically log in after registration
            String token = userService.loginUser(registerRequest.getUsername(), registerRequest.getPassword());
            setJwtCookie(response, token);
            return ResponseEntity.ok(new JwtResponse(token, user));
        } catch (Exception e) {
            log.error("Registration failed", e);
            return ResponseEntity.badRequest().body("Registration failed. Please check your input.");
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest, HttpServletRequest request, HttpServletResponse response) {
        String ip = request.getRemoteAddr();
        SimpleRateLimiter limiter = ipLimiters.computeIfAbsent(ip, k -> new SimpleRateLimiter(5, 0.2));
        if (!limiter.tryAcquire()) {
            return ResponseEntity.status(429).body("Too many requests. Please try again later.");
        }

        try {
            String token = userService.loginUser(
                    loginRequest.getUsernameOrEmail(),
                    loginRequest.getPassword()
            );

            // Fetch the user details to return in response
            String searchKey = loginRequest.getUsernameOrEmail();
            User user = userService.findByUsername(searchKey)
                    .or(() -> userService.findByEmail(searchKey))
                    .orElseThrow(() -> new RuntimeException("User not found after authentication"));

            setJwtCookie(response, token);
            return ResponseEntity.ok(new JwtResponse(token, user));
        } catch (Exception e) {
            log.error("Login failed", e);
            return ResponseEntity.status(401).body("Invalid username or password.");
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("jwt_token", "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0)
                .sameSite("None")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok("Logged out successfully");
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(jakarta.servlet.http.HttpServletRequest request, HttpServletResponse response) {
        String jwt = null;
        if (request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if ("jwt_token".equals(cookie.getName())) {
                    jwt = cookie.getValue();
                    break;
                }
            }
        }

        if (jwt != null && tokenProvider.validateToken(jwt)) {
            String username = tokenProvider.getUsernameFromToken(jwt);
            User user = userService.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            // Re-authenticate and generate new token
            org.springframework.security.core.userdetails.UserDetails userDetails = 
                    new org.springframework.security.core.userdetails.User(username, "", java.util.Collections.emptyList());
            org.springframework.security.authentication.UsernamePasswordAuthenticationToken authentication =
                    new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                            userDetails, 
                            null, 
                            java.util.Collections.emptyList()
                    );
            String newToken = tokenProvider.generateToken(authentication);
            setJwtCookie(response, newToken);
            return ResponseEntity.ok(new JwtResponse(newToken, user));
        }
        return ResponseEntity.status(401).body("Invalid or expired session");
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            User user = userService.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("Current user not found"));
            return ResponseEntity.ok(user);
        }
        return ResponseEntity.status(401).body("Not authenticated");
    }

    @PostMapping("/otp/send")
    public ResponseEntity<?> sendOtp(@Valid @RequestBody OtpSendRequest sendRequest, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        try {
            OtpSendResponse resp = otpService.sendOtp(sendRequest, ip);
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("OTP send failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<?> verifyOtp(@Valid @RequestBody OtpVerifyRequest verifyRequest, HttpServletResponse response) {
        try {
            OtpVerifyResponse resp = otpService.verifyOtp(verifyRequest.getTarget(), verifyRequest.getCode());
            if (!resp.isNewUser() && resp.getToken() != null) {
                setJwtCookie(response, resp.getToken());
            }
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("OTP verify failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/otp/register-profile")
    public ResponseEntity<?> registerProfile(@Valid @RequestBody RegisterProfileRequest profileRequest, HttpServletResponse response) {
        try {
            OtpVerifyResponse resp = otpService.registerProfile(profileRequest);
            if (resp.getToken() != null) {
                setJwtCookie(response, resp.getToken());
            }
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("Profile registration failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/check-username")
    public ResponseEntity<?> checkUsername(@RequestParam String username) {
        boolean available = otpService.isUsernameAvailable(username);
        Map<String, Object> resp = new HashMap<>();
        resp.put("username", username);
        resp.put("available", available);
        return ResponseEntity.ok(resp);
    }
}
