package com.nexus.repository;

import com.nexus.model.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    
    @EntityGraph(attributePaths = {"sender", "channel", "recipient", "reactions", "parentMessage", "parentMessage.sender"})
    List<Message> findByChannelIdOrderByCreatedAtDesc(Long channelId, Pageable pageable);

    @EntityGraph(attributePaths = {"sender", "channel", "recipient", "reactions", "parentMessage", "parentMessage.sender"})
    @Query("SELECT m FROM Message m WHERE " +
           "(m.sender.id = :user1Id AND m.recipient.id = :user2Id) OR " +
           "(m.sender.id = :user2Id AND m.recipient.id = :user1Id) " +
           "ORDER BY m.createdAt DESC")
    List<Message> findDirectMessages(
            @Param("user1Id") Long user1Id, 
            @Param("user2Id") Long user2Id, 
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"sender", "channel", "recipient", "reactions", "parentMessage", "parentMessage.sender"})
    Optional<Message> findWithAssociationsById(Long id);
}
