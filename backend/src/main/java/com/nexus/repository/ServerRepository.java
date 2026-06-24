package com.nexus.repository;

import com.nexus.model.Server;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServerRepository extends JpaRepository<Server, Long> {
    Optional<Server> findByInviteCode(String inviteCode);

    @Query("SELECT s FROM Server s JOIN s.members m WHERE m.id = :userId")
    List<Server> findByMemberId(@Param("userId") Long userId);
}
