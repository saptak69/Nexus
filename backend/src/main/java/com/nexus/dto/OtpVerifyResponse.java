package com.nexus.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.nexus.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OtpVerifyResponse {

    private boolean isNewUser;
    private String verificationTicket;
    private String token;
    private User user;
    private String message;
}
