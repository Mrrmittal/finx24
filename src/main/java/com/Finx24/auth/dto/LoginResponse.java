package com.Finx24.auth.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LoginResponse {
    private String token;
    private String username;
    private String fullName;
    private String initials;
    private String designation;
    private String role;
}
