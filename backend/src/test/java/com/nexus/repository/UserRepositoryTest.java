package com.nexus.repository;

import com.nexus.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
public class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    public void shouldSaveAndFindUserByUsername() {
        User user = User.builder()
                .username("john_doe")
                .email("john@example.com")
                .password("password123")
                .userTag("john_doe_1234")
                .presence(User.PresenceStatus.ONLINE)
                .build();

        userRepository.save(user);

        Optional<User> found = userRepository.findByUsername("john_doe");
        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("john@example.com");
    }

    @Test
    public void shouldCheckIfUsernameAndEmailExists() {
        User user = User.builder()
                .username("jane_doe")
                .email("jane@example.com")
                .password("password123")
                .userTag("jane_doe_5678")
                .presence(User.PresenceStatus.ONLINE)
                .build();

        userRepository.save(user);

        assertThat(userRepository.existsByUsername("jane_doe")).isTrue();
        assertThat(userRepository.existsByEmail("jane@example.com")).isTrue();
        assertThat(userRepository.existsByUsername("nonexistent")).isFalse();
    }
}
