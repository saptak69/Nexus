package com.nexus.service;

import com.nexus.model.FriendRequest;
import com.nexus.model.FriendRequest.FriendRequestStatus;
import com.nexus.model.User;
import com.nexus.repository.FriendRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FriendService {

    private final FriendRequestRepository friendRequestRepository;

    public FriendService(FriendRequestRepository friendRequestRepository) {
        this.friendRequestRepository = friendRequestRepository;
    }

    @Transactional
    public FriendRequest sendFriendRequest(User sender, User receiver) {
        if (sender.getId().equals(receiver.getId())) {
            throw new RuntimeException("You cannot add yourself as a friend");
        }

        Optional<FriendRequest> existing = friendRequestRepository.findRequestBetweenUsers(sender.getId(), receiver.getId());
        if (existing.isPresent()) {
            FriendRequest request = existing.get();
            if (request.getStatus() == FriendRequestStatus.PENDING) {
                throw new RuntimeException("Friend request is already pending!");
            } else if (request.getStatus() == FriendRequestStatus.ACCEPTED) {
                throw new RuntimeException("You are already friends!");
            } else {
                // If rejected, we can resend it by resetting status and sender
                request.setStatus(FriendRequestStatus.PENDING);
                request.setSender(sender);
                request.setReceiver(receiver);
                return friendRequestRepository.save(request);
            }
        }

        FriendRequest request = FriendRequest.builder()
                .sender(sender)
                .receiver(receiver)
                .status(FriendRequestStatus.PENDING)
                .build();

        return friendRequestRepository.save(request);
    }

    @Transactional
    public FriendRequest acceptFriendRequest(Long requestId, User receiver) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Friend request not found"));

        if (!request.getReceiver().getId().equals(receiver.getId())) {
            throw new RuntimeException("Unauthorized: You cannot accept this request");
        }

        request.setStatus(FriendRequestStatus.ACCEPTED);
        return friendRequestRepository.save(request);
    }

    @Transactional
    public FriendRequest rejectFriendRequest(Long requestId, User receiver) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Friend request not found"));

        if (!request.getReceiver().getId().equals(receiver.getId())) {
            throw new RuntimeException("Unauthorized: You cannot reject this request");
        }

        request.setStatus(FriendRequestStatus.REJECTED);
        return friendRequestRepository.save(request);
    }

    public List<FriendRequest> getPendingRequests(Long receiverId) {
        return friendRequestRepository.findByReceiverIdAndStatus(receiverId, FriendRequestStatus.PENDING);
    }

    public List<User> getFriends(Long userId) {
        List<FriendRequest> friendships = friendRequestRepository.findFriendships(userId);
        return friendships.stream()
                .map(f -> f.getSender().getId().equals(userId) ? f.getReceiver() : f.getSender())
                .collect(Collectors.toList());
    }
}
