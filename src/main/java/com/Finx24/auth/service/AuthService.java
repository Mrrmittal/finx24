package com.Finx24.auth.service;

import com.Finx24.common.exception.ResourceNotFoundException;
import com.Finx24.auth.dto.LoginRequest;
import com.Finx24.auth.dto.LoginResponse;
import com.Finx24.auth.entity.Role;
import com.Finx24.auth.entity.User;
import com.Finx24.auth.repository.UserRepository;
import com.Finx24.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository      userRepository;
    private final JwtService          jwtService;
    private final PasswordEncoder     passwordEncoder;
    private final AuthenticationManager authManager;

    // ── Login ────────────────────────────────────────────────────
    public LoginResponse login(LoginRequest request) {
        try {
            authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(), request.getPassword()
                    )
            );
        } catch (AuthenticationException ex) {
            log.warn("[Auth] Failed login attempt for: {}", request.getUsername());
            throw BusinessException.badRequest("Invalid username or password.", "INVALID_CREDENTIALS");
        }

        User user = userRepository.findByUsernameAndActiveTrue(request.getUsername())
                .orElseThrow(() -> BusinessException.badRequest("Account not found or inactive.", "ACCOUNT_INACTIVE"));

        // Role mismatch check (user trying admin tab, or vice versa)
        if (request.getExpectedRole() != null &&
            !user.getRole().name().equalsIgnoreCase(request.getExpectedRole())) {
            throw BusinessException.badRequest(
                    user.getRole() == Role.USER
                            ? "This account does not have Admin access."
                            : "Please use Admin Login for this account.",
                    "ROLE_MISMATCH"
            );
        }

        String token = jwtService.generateToken(user);
        log.info("[Auth] Login success: {} ({})", user.getUsername(), user.getRole());

        return LoginResponse.builder()
                .token(token)
                .username(user.getUsername())
                .fullName(user.getFullName())
                .initials(user.getInitials())
                .designation(user.getDesignation())
                .role(user.getRole().name())
                .build();
    }

    // ── Create user (admin only) ──────────────────────────────────
    @Transactional
    public void createUser(String fullName, String username, String rawPassword, Role role) {
        if (userRepository.existsByUsername(username)) {
            throw BusinessException.conflict("Username '" + username + "' already exists.", "USERNAME_TAKEN");
        }
        User user = User.builder()
                .fullName(fullName)
                .username(username)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(role)
                .active(true)
                .build();
        userRepository.save(user);
        log.info("[Auth] User created: {} ({})", username, role);
    }

    // ── Deactivate user ───────────────────────────────────────────
    @Transactional
    public void deactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        user.setActive(false);
        userRepository.save(user);
        log.info("[Auth] User deactivated: {}", user.getUsername());
    }
}
