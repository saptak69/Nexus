package com.nexus.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "otp_tokens",
    indexes = {
        @Index(name = "idx_otp_target_consumed", columnList = "target, consumed"),
        @Index(name = "idx_otp_ticket_jti", columnList = "ticketJti")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OtpToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String target;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TargetType targetType;

    @Column(nullable = false)
    private String codeHash;

    @Column(unique = true)
    private String ticketJti;

    @Builder.Default
    @Column(nullable = false)
    private boolean consumed = false;

    @Builder.Default
    @Column(nullable = false)
    private int attempts = 0;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum TargetType {
        EMAIL, PHONE
    }
}
