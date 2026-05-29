package com.Finx24.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;

    /** "USER" or "ADMIN" — from frontend tab selection */
    private String expectedRole;
}
