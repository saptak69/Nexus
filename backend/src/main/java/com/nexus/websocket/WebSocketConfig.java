package com.nexus.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final NexusWebSocketHandler nexusWebSocketHandler;

    public WebSocketConfig(NexusWebSocketHandler nexusWebSocketHandler) {
        this.nexusWebSocketHandler = nexusWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(nexusWebSocketHandler, "/ws")
                .setAllowedOriginPatterns(
                        "https://nexus-chat-iota-dun.vercel.app",
                        "https://*.vercel.app",
                        "http://localhost:5173",
                        "http://127.0.0.1:5173",
                        "http://192.168.*:5173",
                        "http://10.*:5173",
                        "http://172.*:5173"
                );
    }
}
