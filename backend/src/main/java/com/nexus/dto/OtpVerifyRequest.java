package com.nexus.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OtpVerifyRequest {

    @NotBlank(message = "Target phone or email is required")
    private String target;

    @NotBlank(message = "Verification code is required")
    private String code;
}
