package com.Finx24.auth.service;

import com.Finx24.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Moved out of SecurityConfig to break the circular dependency:
 * SecurityConfig → JwtAuthFilter → UserDetailsService → SecurityConfig
 *
 * Now:
 * SecurityConfig     → UserDetailsServiceImpl  (no cycle)
 * JwtAuthFilter      → UserDetailsServiceImpl  (no cycle)
 */
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByUsernameAndActiveTrue(username)
                .map(user -> User.builder()
                        .username(user.getUsername())
                        .password(user.getPasswordHash())
                        .roles(user.getRole().name())   // → ROLE_ADMIN or ROLE_USER
                        .build())
                .orElseThrow(() ->
                        new UsernameNotFoundException("User not found: " + username));
    }
}