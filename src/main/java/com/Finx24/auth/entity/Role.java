package com.Finx24.auth.entity;

public enum Role {
    USER,   // Run recon, view reports, download output
    ADMIN   // Everything USER can do + manage users + DB settings + data modification
}
