package com.nexus.repository;

import com.nexus.model.FriendRequest;
import com.nexus.model.FriendRequest.FriendRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    List<FriendRequest> findByReceiverIdAndStatus(Long receiverId, FriendRequestStatus status);

    @Query("SELECT f FROM FriendRequest f WHERE " +
           "(f.sender.id = :userId OR f.receiver.id = :userId) AND " +
           "f.status = 'ACCEPTED'")
    List<FriendRequest> findFriendships(@Param("userId") Long userId);

    @Query("SELECT f FROM FriendRequest f WHERE " +
           "(f.sender.id = :u1 AND f.receiver.id = :u2) OR " +
           "(f.sender.id = :u2 AND f.receiver.id = :u1)")
    Optional<FriendRequest> findRequestBetweenUsers(@Param("u1") Long u1, @Param("u2") Long u2);
}
