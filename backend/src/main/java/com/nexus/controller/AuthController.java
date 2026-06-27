package com.nexus.controller;

import com.nexus.dto.JwtResponse;
import com.nexus.dto.LoginRequest;
import com.nexus.dto.RegisterRequest;
import com.nexus.model.User;
import com.nexus.service.UserService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import com.nexus.security.JwtTokenProvider;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final JwtTokenProvider tokenProvider;

    public AuthController(UserService userService, JwtTokenProvider tokenProvider) {
        this.userService = userService;
        this.tokenProvider = tokenProvider;
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
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest registerRequest, HttpServletResponse response) {
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
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest, HttpServletResponse response) {
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
            return ResponseEntity.status(401).body("Invalid username or password: " + e.getMessage());
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
}
