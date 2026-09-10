package com.nexus.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterProfileRequest {

    @NotBlank(message = "Verification ticket is required")
    private String verificationTicket;

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 32, message = "Username must be between 3 and 32 characters")
    @Pattern(regexp = "^@?[a-zA-Z0-9_]{3,32}$", message = "Username must be alphanumeric with optional underscores")
    private String username;

    @Size(max = 50, message = "Display name cannot exceed 50 characters")
    private String displayName;

    private String avatarUrl;

    @Size(min = 6, max = 100, message = "Password must be at least 6 characters if set")
    private String password;
}
