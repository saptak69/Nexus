package com.nexus.repository;

import com.nexus.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Boolean existsByUsername(String username);
    Boolean existsByEmail(String email);
    List<User> findByUsernameContainingIgnoreCase(String query);
    
    Optional<User> findByUserTag(String userTag);
    Optional<User> findByUserTagIgnoreCase(String userTag);
    Boolean existsByUserTag(String userTag);

    @Query("SELECT DISTINCT u FROM User u WHERE (u.username = 'nexus_ai' OR u.id IN (" +
           "SELECT m.recipient.id FROM Message m WHERE m.sender.id = :userId AND m.recipient IS NOT NULL" +
           ") OR u.id IN (" +
           "SELECT m.sender.id FROM Message m WHERE m.recipient.id = :userId" +
           ")) AND u.id != :userId")
    List<User> findChatPartners(@Param("userId") Long userId);
}
