package com.Finx24.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class BusinessException extends RuntimeException {

    private final String     errorCode;
    private final HttpStatus status;

    public BusinessException(String message, String errorCode, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status    = status;
    }

    // ── Convenience factories ────────────────────────────────────
    public static BusinessException badRequest(String message, String errorCode) {
        return new BusinessException(message, errorCode, HttpStatus.BAD_REQUEST);
    }

    public static BusinessException conflict(String message, String errorCode) {
        return new BusinessException(message, errorCode, HttpStatus.CONFLICT);
    }

    public static BusinessException unprocessable(String message, String errorCode) {
        return new BusinessException(message, errorCode, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
