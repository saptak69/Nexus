package com.nexus.dto;

import com.nexus.model.User;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private final String tokenType = "Bearer";
    private User user;
}
