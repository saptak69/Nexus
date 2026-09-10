package com.nexus.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.HexFormat;

@Component
public class SecurityConfigValidator {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfigValidator.class);

    private final Environment environment;

    @Value("${nexus.jwt.secret:}")
    private String jwtSecret;

    @Value("${nexus.otp.ticket-secret:}")
    private String ticketSecret;

    private String resolvedJwtSecret;
    private String resolvedTicketSecret;

    public SecurityConfigValidator(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validateAndResolveSecrets() {
        boolean isProd = environment.acceptsProfiles(Profiles.of("prod", "production"));

        if (isProd) {
            if (jwtSecret == null || jwtSecret.trim().isEmpty() || jwtSecret.length() < 32) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production deployment requires a non-empty JWT_SECRET with at least 256-bit entropy (64 hex characters or 32+ chars).");
            }
            if (ticketSecret == null || ticketSecret.trim().isEmpty() || ticketSecret.length() < 32) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production deployment requires a non-empty TICKET_SECRET with at least 256-bit entropy.");
            }
            resolvedJwtSecret = jwtSecret.trim();
            resolvedTicketSecret = ticketSecret.trim();
        } else {
            // Local development mode: generate ephemeral secure keys if not explicitly supplied
            if (jwtSecret == null || jwtSecret.trim().isEmpty()) {
                byte[] randomBytes = new byte[32];
                new SecureRandom().nextBytes(randomBytes);
                resolvedJwtSecret = HexFormat.of().formatHex(randomBytes);
                log.warn("[DEV MODE] JWT_SECRET was not provided. Generated ephemeral 256-bit key for this run.");
            } else {
                resolvedJwtSecret = jwtSecret.trim();
            }

            if (ticketSecret == null || ticketSecret.trim().isEmpty()) {
                byte[] randomBytes = new byte[32];
                new SecureRandom().nextBytes(randomBytes);
                resolvedTicketSecret = HexFormat.of().formatHex(randomBytes);
                log.warn("[DEV MODE] TICKET_SECRET was not provided. Generated ephemeral 256-bit key for this run.");
            } else {
                resolvedTicketSecret = ticketSecret.trim();
            }
        }
    }

    public String getJwtSecret() {
        return resolvedJwtSecret != null ? resolvedJwtSecret : jwtSecret;
    }

    public String getTicketSecret() {
        return resolvedTicketSecret != null ? resolvedTicketSecret : ticketSecret;
    }
}
