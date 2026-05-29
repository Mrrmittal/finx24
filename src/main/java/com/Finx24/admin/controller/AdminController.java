package com.Finx24.admin.controller;

import com.Finx24.admin.dto.CreateUserRequest;
import com.Finx24.auth.entity.Role;
import com.Finx24.auth.entity.User;
import com.Finx24.auth.repository.UserRepository;
import com.Finx24.auth.service.AuthService;
import com.Finx24.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")   // ALL endpoints in this controller require ADMIN
@Tag(name = "Admin Panel", description = "Admin-only: user management, system settings")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {

    private final AuthService    authService;
    private final UserRepository userRepository;

    @GetMapping("/users")
    @Operation(summary = "List all users")
    public ResponseEntity<ApiResponse<List<User>>> listUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userRepository.findAll()));
    }

    @PostMapping("/users")
    @Operation(summary = "Create a new user")
    public ResponseEntity<ApiResponse<Void>> createUser(
            @Valid @RequestBody CreateUserRequest request) {
        authService.createUser(
                request.getFullName(),
                request.getUsername(),
                request.getPassword(),
                Role.valueOf(request.getRole().toUpperCase())
        );
        return ResponseEntity.ok(ApiResponse.ok("User created successfully"));
    }

    @DeleteMapping("/users/{id}")
    @Operation(summary = "Deactivate a user")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(@PathVariable Long id) {
        authService.deactivateUser(id);
        return ResponseEntity.ok(ApiResponse.ok("User deactivated"));
    }

    @GetMapping("/system")
    @Operation(summary = "System information")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> systemInfo() {
        return ResponseEntity.ok(ApiResponse.ok(java.util.Map.of(
                "application",    "FinX24 — NBFC Finance Suite",
                "version",        "1.0.0",
                "javaVersion",    System.getProperty("java.version"),
                "springProfile",  "production",
                "dbStatus",       "connected",
                "liReconEngine",  "v5.0 — Python bridge",
                "miReconEngine",  "v2.0 — Python bridge"
        )));
    }
}
