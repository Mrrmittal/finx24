package com.Finx24.auth.repository;

import com.Finx24.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsernameAndActiveTrue(String username);

    boolean existsByUsername(String username);
}
