package com.Finx24.config;

import com.Finx24.auth.entity.Role;
import com.Finx24.auth.entity.User;
import com.Finx24.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Seeds default users on DEV (H2) startup.
 * NOT used in prod — Flyway V1__initial_schema.sql handles that.
 */
@Slf4j
@Configuration
@Profile("dev")      // only runs with spring.profiles.active=dev
@RequiredArgsConstructor
public class DataInitializer {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    CommandLineRunner seedUsers() {
        return args -> {
            if (userRepository.count() > 0) return;  // already seeded

            userRepository.save(User.builder()
                    .username("admin")
                    .passwordHash(passwordEncoder.encode("Admin@2024"))
                    .fullName("Jatin Mittal")
                    .designation("Finance Head")
                    .role(Role.ADMIN)
                    .active(true)
                    .build());

            userRepository.save(User.builder()
                    .username("user1")
                    .passwordHash(passwordEncoder.encode("User@2024"))
                    .fullName("Finance User")
                    .designation("Accounts Team")
                    .role(Role.USER)
                    .active(true)
                    .build());

            userRepository.save(User.builder()
                    .username("recon")
                    .passwordHash(passwordEncoder.encode("Recon@2024"))
                    .fullName("Recon Analyst")
                    .designation("Recon Team")
                    .role(Role.USER)
                    .active(true)
                    .build());

            log.info("[DataInit] ✓ Default users seeded (admin, user1, recon)");
        };
    }
}