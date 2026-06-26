package com.nexus.service;

import com.nexus.model.User;
import com.nexus.repository.UserRepository;
import com.nexus.security.JwtTokenProvider;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authenticationManager;

    public UserService(UserRepository userRepository, 
                       PasswordEncoder passwordEncoder, 
                       JwtTokenProvider tokenProvider, 
                       AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    public User registerUser(String username, String email, String password) {
        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("Username is already taken!");
        }
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email is already in use!");
        }

        // Generate unique user tag (username + 4 random alphanumeric chars)
        String userTag;
        do {
            String randomSuffix = java.util.UUID.randomUUID().toString().substring(0, 4);
            userTag = username.toLowerCase().replaceAll("\\s+", "") + "_" + randomSuffix;
        } while (userRepository.existsByUserTag(userTag));

        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(password))
                .userTag(userTag)
                .presence(User.PresenceStatus.ONLINE) // default to online upon registration
                .build();

        return userRepository.save(user);
    }

    public String loginUser(String usernameOrEmail, String password) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(usernameOrEmail, password)
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        return tokenProvider.generateToken(authentication);
    }

    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    @Transactional
    public User updateStatusMessage(Long userId, String statusMessage) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setStatusMessage(statusMessage);
        return userRepository.save(user);
    }

    @Transactional
    public User updatePresence(Long userId, User.PresenceStatus presence) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPresence(presence);
        return userRepository.save(user);
    }

    @Transactional
    public User updateAvatar(Long userId, String avatarUrl) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setAvatarUrl(avatarUrl);
        return userRepository.save(user);
    }

    public List<User> searchUsers(String query) {
        String cleanedQuery = query.trim();
        if (cleanedQuery.startsWith("@")) {
            cleanedQuery = cleanedQuery.substring(1).trim();
        }
        
        Optional<User> userOpt = userRepository.findByUserTagIgnoreCase(cleanedQuery);
        if (userOpt.isPresent()) {
            return List.of(userOpt.get());
        }
        return List.of();
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public List<User> findAllExcept(Long userId) {
        return userRepository.findChatPartners(userId);
    }
}
