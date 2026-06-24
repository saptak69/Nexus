package com.nexus.service;

import com.nexus.model.Channel;
import com.nexus.model.Server;
import com.nexus.repository.ChannelRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ChannelService {

    private final ChannelRepository channelRepository;

    public ChannelService(ChannelRepository channelRepository) {
        this.channelRepository = channelRepository;
    }

    @Transactional
    public Channel createChannel(String name, Channel.ChannelType type, Server server) {
        // Clean channel name (lowercase, replace spaces with hyphens for text channels)
        String cleanedName = name.toLowerCase().trim();
        if (type == Channel.ChannelType.TEXT) {
            cleanedName = cleanedName.replace(" ", "-");
        }

        Channel channel = Channel.builder()
                .name(cleanedName)
                .type(type)
                .server(server)
                .build();

        return channelRepository.save(channel);
    }

    public List<Channel> getChannelsByServer(Long serverId) {
        return channelRepository.findByServerId(serverId);
    }

    public Optional<Channel> getChannelById(Long id) {
        return channelRepository.findById(id);
    }

    @Transactional
    public void deleteChannel(Long id) {
        channelRepository.deleteById(id);
    }
}
