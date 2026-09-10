package com.nexus.repository;

import com.nexus.model.OtpToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface OtpTokenRepository extends JpaRepository<OtpToken, Long> {

    Optional<OtpToken> findTopByTargetAndConsumedFalseOrderByCreatedAtDesc(String target);

    Optional<OtpToken> findByTicketJtiAndConsumedFalse(String ticketJti);

    @Modifying
    @Query("UPDATE OtpToken o SET o.attempts = o.attempts + 1 WHERE o.id = :id AND o.attempts < 5")
    int incrementAttemptsAtomically(@Param("id") Long id);

    void deleteByExpiresAtBefore(LocalDateTime threshold);

    void deleteByTarget(String target);
}
