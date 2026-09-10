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
    Optional<User> findByUsernameIgnoreCase(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByPhoneNumber(String phoneNumber);
    Boolean existsByUsername(String username);
    Boolean existsByUsernameIgnoreCase(String username);
    Boolean existsByEmail(String email);
    Boolean existsByPhoneNumber(String phoneNumber);
    List<User> findByUsernameContainingIgnoreCase(String query);
    
    Optional<User> findByUserTag(String userTag);
    Optional<User> findByUserTagIgnoreCase(String userTag);
    Boolean existsByUserTag(String userTag);

    @Query("SELECT u FROM User u WHERE LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "(u.displayName IS NOT NULL AND LOWER(u.displayName) LIKE LOWER(CONCAT('%', :query, '%'))) OR " +
           "(u.phoneNumber IS NOT NULL AND u.phoneNumber LIKE CONCAT('%', :query, '%')) OR " +
           "(u.userTag IS NOT NULL AND LOWER(u.userTag) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<User> searchUsers(@Param("query") String query);

    @Query("SELECT DISTINCT u FROM User u WHERE (u.username = 'nexus_ai' OR u.id IN (" +
           "SELECT m.recipient.id FROM Message m WHERE m.sender.id = :userId AND m.recipient IS NOT NULL" +
           ") OR u.id IN (" +
           "SELECT m.sender.id FROM Message m WHERE m.recipient.id = :userId" +
           ")) AND u.id != :userId")
    List<User> findChatPartners(@Param("userId") Long userId);
}
