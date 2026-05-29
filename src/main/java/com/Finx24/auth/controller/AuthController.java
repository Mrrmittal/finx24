package com.Finx24.auth.controller;

import com.Finx24.auth.dto.LoginRequest;
import com.Finx24.auth.dto.LoginResponse;
import com.Finx24.auth.service.AuthService;
import com.Finx24.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Login / logout endpoints")
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/login
     * Body: { username, password, expectedRole }
     * Returns: JWT token + user info
     */
    @PostMapping("/login")
    @Operation(summary = "Login", description = "Returns JWT token on success")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok(response, "Login successful"));
    }

    /**
     * POST /api/auth/logout
     * Client just discards the token — stateless JWT.
     */
    @PostMapping("/logout")
    @Operation(summary = "Logout", description = "Stateless — client discards JWT")
    public ResponseEntity<ApiResponse<Void>> logout() {
        return ResponseEntity.ok(ApiResponse.ok("Logged out successfully"));
    }
}
