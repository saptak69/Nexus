package com.nexus;

import com.nexus.model.User;
import com.nexus.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final ReactionRepository reactionRepository;
    private final ServerRepository serverRepository;
    private final PasswordEncoder passwordEncoder;

    public DatabaseSeeder(UserRepository userRepository,
                          MessageRepository messageRepository,
                          FriendRequestRepository friendRequestRepository,
                          ReactionRepository reactionRepository,
                          ServerRepository serverRepository,
                          PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.reactionRepository = reactionRepository;
        this.serverRepository = serverRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // Remove demo users if they exist in the repository to clean them up
        List<String> demoUsernames = List.of("alice", "bob", "charlie", "maria", "nexus_bot");
        for (String username : demoUsernames) {
            userRepository.findByUsername(username).ifPresent(user -> {
                try {
                    // Remove all friend requests involving this user
                    friendRequestRepository.findAll().forEach(fr -> {
                        if (fr.getSender().getId().equals(user.getId()) || fr.getReceiver().getId().equals(user.getId())) {
                            friendRequestRepository.delete(fr);
                        }
                    });

                    // Remove all reactions
                    reactionRepository.deleteAll();

                    // Disassociate parents for all messages to avoid self-referential constraint issues
                    messageRepository.findAll().forEach(m -> {
                        if (m.getParentMessage() != null) {
                            m.setParentMessage(null);
                            messageRepository.save(m);
                        }
                    });

                    // Delete messages involving this user
                    messageRepository.findAll().forEach(m -> {
                        if (m.getSender().getId().equals(user.getId()) || (m.getRecipient() != null && m.getRecipient().getId().equals(user.getId()))) {
                            messageRepository.delete(m);
                        }
                    });

                    // Remove from servers
                    serverRepository.findAll().forEach(s -> {
                        if (s.getMembers().contains(user)) {
                            s.getMembers().remove(user);
                            serverRepository.save(s);
                        }
                        if (s.getOwner().getId().equals(user.getId())) {
                            serverRepository.delete(s);
                        }
                    });

                    // Delete the user
                    userRepository.delete(user);
                    System.out.println("Cleaned up demo user: " + username);
                } catch (Exception e) {
                    System.err.println("Error removing demo user " + username + ": " + e.getMessage());
                }
            });
        }

        // Safe migration: populate missing user tags for any existing users
        userRepository.findAll().forEach(user -> {
            if (user.getUserTag() == null || user.getUserTag().trim().isEmpty()) {
                String userTag;
                do {
                    String randomSuffix = java.util.UUID.randomUUID().toString().substring(0, 4);
                    userTag = user.getUsername().toLowerCase().replaceAll("\\s+", "") + "_" + randomSuffix;
                } while (userRepository.existsByUserTag(userTag));
                user.setUserTag(userTag);
                userRepository.save(user);
                System.out.println("Migrated user " + user.getUsername() + " with tag: " + userTag);
            }
        });

        // Now seed nexus_ai if it doesn't exist
        if (userRepository.findByUsername("nexus_ai").isEmpty()) {
            User nexusBot = User.builder()
                    .username("nexus_ai")
                    .userTag("nexus_ai")
                    .email("bot@nexus.chat")
                    .password(passwordEncoder.encode("password123"))
                    .presence(User.PresenceStatus.ONLINE)
                    .avatarUrl("https://api.dicebear.com/7.x/bottts/svg?seed=NexusBot")
                    .statusMessage("AI Assistant 🤖")
                    .build();

            userRepository.save(nexusBot);
            System.out.println("Seeded database with nexus_ai!");
        }
    }
}
