package com.nexus.controller;

import com.nexus.dto.JwtResponse;
import com.nexus.dto.LoginRequest;
import com.nexus.dto.RegisterRequest;
import com.nexus.model.User;
import com.nexus.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        try {
            User user = userService.registerUser(
                    registerRequest.getUsername(),
                    registerRequest.getEmail(),
                    registerRequest.getPassword()
            );

            // Automatically log in after registration
            String token = userService.loginUser(registerRequest.getUsername(), registerRequest.getPassword());
            return ResponseEntity.ok(new JwtResponse(token, user));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
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

            return ResponseEntity.ok(new JwtResponse(token, user));
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid username or password: " + e.getMessage());
        }
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
