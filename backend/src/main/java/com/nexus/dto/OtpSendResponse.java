package com.nexus.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OtpSendResponse {

    private String message;
    private String target;
    private String targetType;
    private Long cooldownSeconds;

    // Only present when dev-mode=true and NOT in production
    private String devCode;
}
