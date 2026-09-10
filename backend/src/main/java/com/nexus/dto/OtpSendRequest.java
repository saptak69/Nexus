package com.nexus.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OtpSendRequest {

    @NotBlank(message = "Target phone or email is required")
    private String target;

    // Optional override: "PHONE" or "EMAIL" (auto-detected if null)
    private String type;
}
