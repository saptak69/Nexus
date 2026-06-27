package com.nexus.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.LoginRequest;
import com.nexus.dto.RegisterRequest;
import com.nexus.model.User;
import com.nexus.security.CustomUserDetailsService;
import com.nexus.security.JwtAuthenticationFilter;
import com.nexus.security.JwtTokenProvider;
import com.nexus.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
public class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtTokenProvider tokenProvider;

    @MockBean
    private CustomUserDetailsService customUserDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser
    public void shouldRegisterUserAndReturnToken() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("newuser");
        request.setEmail("newuser@example.com");
        request.setPassword("password");

        User user = User.builder()
                .id(1L)
                .username("newuser")
                .email("newuser@example.com")
                .build();

        when(userService.registerUser("newuser", "newuser@example.com", "password")).thenReturn(user);
        when(userService.loginUser("newuser", "password")).thenReturn("mock-jwt-token");

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock-jwt-token"))
                .andExpect(jsonPath("$.user.username").value("newuser"));
    }

    @Test
    @WithMockUser
    public void shouldLoginUserAndReturnToken() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("user");
        request.setPassword("password");

        User user = User.builder()
                .id(1L)
                .username("user")
                .email("user@example.com")
                .build();

        when(userService.loginUser("user", "password")).thenReturn("mock-jwt-token");
        when(userService.findByUsername("user")).thenReturn(java.util.Optional.of(user));

        mockMvc.perform(post("/api/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock-jwt-token"))
                .andExpect(jsonPath("$.user.username").value("user"));
    }
}
