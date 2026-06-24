package com.nexus.service;

import com.nexus.model.*;
import com.nexus.repository.MessageRepository;
import com.nexus.repository.ReactionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final ReactionRepository reactionRepository;

    public MessageService(MessageRepository messageRepository, ReactionRepository reactionRepository) {
        this.messageRepository = messageRepository;
        this.reactionRepository = reactionRepository;
    }

    @Transactional
    public Message saveChannelMessage(String content, User sender, Channel channel, 
                                      Long parentId, String fileUrl, String fileName, String fileType) {
        Message parent = null;
        if (parentId != null) {
            parent = messageRepository.findById(parentId).orElse(null);
        }

        Message message = Message.builder()
                .content(content)
                .sender(sender)
                .channel(channel)
                .parentMessage(parent)
                .fileUrl(fileUrl)
                .fileName(fileName)
                .fileType(fileType)
                .build();

        Message saved = messageRepository.save(message);
        return messageRepository.findWithAssociationsById(saved.getId()).orElse(saved);
    }

    @Transactional
    public Message saveDirectMessage(String content, User sender, User recipient, 
                                     Long parentId, String fileUrl, String fileName, String fileType) {
        Message parent = null;
        if (parentId != null) {
            parent = messageRepository.findById(parentId).orElse(null);
        }

        Message message = Message.builder()
                .content(content)
                .sender(sender)
                .recipient(recipient)
                .parentMessage(parent)
                .fileUrl(fileUrl)
                .fileName(fileName)
                .fileType(fileType)
                .build();

        Message saved = messageRepository.save(message);
        return messageRepository.findWithAssociationsById(saved.getId()).orElse(saved);
    }

    @Transactional
    public Message editMessage(Long messageId, String newContent, User user) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        if (!message.getSender().getId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized: You cannot edit someone else's message");
        }

        if (message.getDeleted()) {
            throw new RuntimeException("Cannot edit a deleted message");
        }

        message.setContent(newContent);
        message.setEdited(true);
        return messageRepository.save(message);
    }

    @Transactional
    public Message deleteMessage(Long messageId, User user) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        if (!message.getSender().getId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized: You cannot delete someone else's message");
        }

        message.setDeleted(true);
        message.setContent("This message was deleted.");
        message.setFileUrl(null);
        message.setFileName(null);
        message.setFileType(null);
        return messageRepository.save(message);
    }

    @Transactional
    public Reaction addReaction(Long messageId, User user, String emoji) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        Optional<Reaction> existing = reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, user.getId(), emoji);
        if (existing.isPresent()) {
            return existing.get();
        }

        Reaction reaction = Reaction.builder()
                .emoji(emoji)
                .user(user)
                .message(message)
                .build();

        reaction = reactionRepository.save(reaction);
        message.getReactions().add(reaction);
        messageRepository.save(message);

        return reaction;
    }

    @Transactional
    public void removeReaction(Long messageId, User user, String emoji) {
        Reaction reaction = reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, user.getId(), emoji)
                .orElseThrow(() -> new RuntimeException("Reaction not found"));

        Message message = reaction.getMessage();
        message.getReactions().remove(reaction);
        reactionRepository.delete(reaction);
        messageRepository.save(message);
    }

    public List<Message> getChannelMessages(Long channelId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return messageRepository.findByChannelIdOrderByCreatedAtDesc(channelId, pageable);
    }

    public List<Message> getDirectMessages(Long userId1, Long userId2, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return messageRepository.findDirectMessages(userId1, userId2, pageable);
    }

    public Optional<Message> getMessageById(Long id) {
        return messageRepository.findById(id);
    }
}
