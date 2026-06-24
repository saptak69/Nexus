package com.nexus.service;

import com.nexus.model.Channel;
import com.nexus.model.Server;
import com.nexus.model.User;
import com.nexus.repository.ServerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ServerService {

    private final ServerRepository serverRepository;

    public ServerService(ServerRepository serverRepository) {
        this.serverRepository = serverRepository;
    }

    @Transactional
    public Server createServer(String name, String iconUrl, User owner) {
        String inviteCode = UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        Server server = Server.builder()
                .name(name)
                .iconUrl(iconUrl)
                .owner(owner)
                .inviteCode(inviteCode)
                .build();

        // Owner is automatically a member
        server.getMembers().add(owner);

        // Create a default text channel
        Channel defaultChannel = Channel.builder()
                .name("general")
                .type(Channel.ChannelType.TEXT)
                .server(server)
                .build();

        // Create a default video channel
        Channel defaultVideoRoom = Channel.builder()
                .name("General Video")
                .type(Channel.ChannelType.VIDEO)
                .server(server)
                .build();

        server.getChannels().add(defaultChannel);
        server.getChannels().add(defaultVideoRoom);

        return serverRepository.save(server);
    }

    @Transactional
    public Server joinServer(String inviteCode, User user) {
        Server server = serverRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new RuntimeException("Server not found with invite code: " + inviteCode));

        server.getMembers().add(user);
        return serverRepository.save(server);
    }

    @Transactional
    public Server leaveServer(Long serverId, User user) {
        Server server = serverRepository.findById(serverId)
                .orElseThrow(() -> new RuntimeException("Server not found"));

        if (server.getOwner().getId().equals(user.getId())) {
            throw new RuntimeException("Owner cannot leave the server. Delete or transfer ownership first.");
        }

        server.getMembers().removeIf(m -> m.getId().equals(user.getId()));
        return serverRepository.save(server);
    }

    public List<Server> getServersForUser(Long userId) {
        return serverRepository.findByMemberId(userId);
    }

    public Optional<Server> getServerById(Long id) {
        return serverRepository.findById(id);
    }
}
