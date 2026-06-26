package com.nexus.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(min = 3, max = 50)
    @Column(unique = true, nullable = false)
    private String username;

    @NotBlank
    @Email
    @Size(max = 100)
    @Column(unique = true, nullable = false)
    private String email;

    @NotBlank
    @Size(max = 120)
    @JsonIgnore
    @Column(nullable = false)
    private String password;

    private String avatarUrl;

    private String statusMessage;

    @Column(unique = true, nullable = false)
    private String userTag;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PresenceStatus presence = PresenceStatus.OFFLINE;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @ManyToMany(mappedBy = "members")
    @JsonIgnore
    @Builder.Default
    private Set<Server> servers = new HashSet<>();

    public enum PresenceStatus {
        ONLINE, AWAY, DND, OFFLINE
    }
}
