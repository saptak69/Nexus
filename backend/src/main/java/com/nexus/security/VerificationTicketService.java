package com.nexus.security;

import com.nexus.config.SecurityConfigValidator;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class VerificationTicketService {

    private final SecretKey ticketKey;
    private final long expirationMs;

    public record VerifiedTicketData(
            String target,
            String targetType,
            String jti
    ) {}

    public VerificationTicketService(
            SecurityConfigValidator validator,
            @Value("${nexus.otp.ticket-expiration-minutes:10}") long expirationMinutes) {
        String secret = validator.getTicketSecret();
        byte[] keyBytes;
        try {
            keyBytes = HexFormat.of().parseHex(secret);
        } catch (Exception e) {
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, Math.min(keyBytes.length, 32));
            keyBytes = padded;
        }
        this.ticketKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMinutes * 60 * 1000L;
    }

    public String createTicket(String target, String targetType, String jti) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(target)
                .claim("targetType", targetType)
                .id(jti)
                .claim("purpose", "REGISTER")
                .issuedAt(now)
                .expiration(expiry)
                .signWith(ticketKey)
                .compact();
    }

    public VerifiedTicketData validateTicket(String ticket) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(ticketKey)
                    .build()
                    .parseSignedClaims(ticket)
                    .getPayload();

            String purpose = claims.get("purpose", String.class);
            if (!"REGISTER".equals(purpose)) {
                throw new SecurityException("Invalid token purpose");
            }

            return new VerifiedTicketData(
                    claims.getSubject(),
                    claims.get("targetType", String.class),
                    claims.getId()
            );
        } catch (JwtException | IllegalArgumentException e) {
            throw new SecurityException("Invalid or expired verification ticket: " + e.getMessage());
        }
    }
}
