package com.nexus;

import com.nexus.model.User;
import com.nexus.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DatabaseSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        if (userRepository.count() == 0) {
            // Seed default users
            User alice = User.builder()
                    .username("alice")
                    .email("alice@nexus.chat")
                    .password(passwordEncoder.encode("password123"))
                    .presence(User.PresenceStatus.ONLINE)
                    .avatarUrl("https://api.dicebear.com/7.x/adventurer/svg?seed=Alice")
                    .statusMessage("Coding away... 🚀")
                    .build();

            User bob = User.builder()
                    .username("bob")
                    .email("bob@nexus.chat")
                    .password(passwordEncoder.encode("password123"))
                    .presence(User.PresenceStatus.ONLINE)
                    .avatarUrl("https://api.dicebear.com/7.x/adventurer/svg?seed=Bob")
                    .statusMessage("Gym mode 🏋️‍♂️")
                    .build();

            User charlie = User.builder()
                    .username("charlie")
                    .email("charlie@nexus.chat")
                    .password(passwordEncoder.encode("password123"))
                    .presence(User.PresenceStatus.AWAY)
                    .avatarUrl("https://api.dicebear.com/7.x/adventurer/svg?seed=Charlie")
                    .statusMessage("Out for lunch 🍔")
                    .build();

            User maria = User.builder()
                    .username("maria")
                    .email("maria@nexus.chat")
                    .password(passwordEncoder.encode("password123"))
                    .presence(User.PresenceStatus.ONLINE)
                    .avatarUrl("https://api.dicebear.com/7.x/adventurer/svg?seed=Maria")
                    .statusMessage("Hey there! I am using Nexus Chat.")
                    .build();

            User nexusBot = User.builder()
                    .username("nexus_bot")
                    .email("bot@nexus.chat")
                    .password(passwordEncoder.encode("password123"))
                    .presence(User.PresenceStatus.ONLINE)
                    .avatarUrl("https://api.dicebear.com/7.x/bottts/svg?seed=NexusBot")
                    .statusMessage("AI Assistant 🤖")
                    .build();

            userRepository.saveAll(List.of(alice, bob, charlie, maria, nexusBot));
            System.out.println("Seeded database with Alice, Bob, Charlie, Maria, and NexusBot!");
        }
    }
}
