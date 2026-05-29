package com.Finx24.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.time.Instant;

/**
 * Standard API response wrapper for ALL endpoints.
 * Every response — success or error — uses this shape.
 *
 * Success:  { success:true,  data:{...},  message:"OK" }
 * Error:    { success:false, data:null,   message:"...", errorCode:"..." }
 */
@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean  success;
    private final String   message;
    private final T        data;
    private final String   errorCode;
    private final Instant  timestamp = Instant.now();

    // ── Private constructor — use static factories ──────────────
    private ApiResponse(boolean success, String message, T data, String errorCode) {
        this.success   = success;
        this.message   = message;
        this.data      = data;
        this.errorCode = errorCode;
    }

    // ── Success ─────────────────────────────────────────────────
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "Success", data, null);
    }

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, message, data, null);
    }

    public static ApiResponse<Void> ok(String message) {
        return new ApiResponse<>(true, message, null, null);
    }

    // ── Error ────────────────────────────────────────────────────
    public static <T> ApiResponse<T> error(String message, String errorCode) {
        return new ApiResponse<>(false, message, null, errorCode);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null, "GENERIC_ERROR");
    }
}
