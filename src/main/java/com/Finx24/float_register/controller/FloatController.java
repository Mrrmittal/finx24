package com.Finx24.float_register.controller;

import com.Finx24.common.response.ApiResponse;
import com.Finx24.float_register.FloatConstants;
import com.Finx24.float_register.service.FloatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/float")
@RequiredArgsConstructor
public class FloatController {

    private final FloatService floatService;

    // ── Upload single partner file ─────────────────────────────────
    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(
            @RequestParam("file")                             MultipartFile file,
            @RequestParam("partnerCode")                      String partnerCode,
            @RequestParam("period")                           String period,
            @RequestParam(value="overwrite", defaultValue="false") boolean overwrite
    ) {
        try {
            log.info("[Float] Upload partner={} period={} overwrite={}", partnerCode, period, overwrite);
            return ResponseEntity.ok(ApiResponse.ok(
                    floatService.upload(file, partnerCode, period, overwrite)));
        } catch (IllegalStateException e) {
            // Duplicate data detected
            return ResponseEntity.status(409)
                    .body(ApiResponse.error(e.getMessage(), "DUPLICATE_DATA"));
        } catch (Exception e) {
            log.error("[Float] Upload error: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage(), "FLOAT_UPLOAD_ERROR"));
        }
    }

    // ── Upload master file ─────────────────────────────────────────
    @PostMapping("/upload-master")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadMaster(
            @RequestParam("file")                             MultipartFile file,
            @RequestParam("period")                           String period,
            @RequestParam(value="overwrite", defaultValue="false") boolean overwrite
    ) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(
                    floatService.uploadMaster(file, period, overwrite)));
        } catch (Exception e) {
            log.error("[Float] Master upload error: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage(), "FLOAT_MASTER_ERROR"));
        }
    }

    // ── Save opening balance ───────────────────────────────────────
    @PostMapping("/opening-balance")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveOpeningBalance(
            @RequestParam("partnerCode") String partnerCode,
            @RequestParam("asOnDate")    String asOnDate,    // yyyy-MM-dd
            @RequestParam("amount")      BigDecimal amount
    ) {
        try {
            LocalDate date = LocalDate.parse(asOnDate);
            return ResponseEntity.ok(ApiResponse.ok(
                    floatService.saveOpeningBalance(partnerCode, date, amount)));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage(), "OPENING_BALANCE_ERROR"));
        }
    }

    // ── Get register data ──────────────────────────────────────────
    @GetMapping("/register")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getRegister(
            @RequestParam("partnerCode")                          String partnerCode,
            @RequestParam(value="month",  required=false)         String month,
            @RequestParam(value="period", required=false)         String period
    ) {
        String filter  = month != null ? month : period;
        boolean byMonth = month != null;
        return ResponseEntity.ok(ApiResponse.ok(
                floatService.getRegister(partnerCode, filter, byMonth)));
    }

    // ── Available months ───────────────────────────────────────────
    @GetMapping("/months")
    public ResponseEntity<ApiResponse<List<String>>> getMonths(
            @RequestParam("partnerCode") String partnerCode) {
        return ResponseEntity.ok(ApiResponse.ok(
                floatService.getAvailableMonths(partnerCode)));
    }

    // ── Available periods ──────────────────────────────────────────
    @GetMapping("/periods")
    public ResponseEntity<ApiResponse<List<String>>> getPeriods(
            @RequestParam("partnerCode") String partnerCode) {
        return ResponseEntity.ok(ApiResponse.ok(
                floatService.getAvailablePeriods(partnerCode)));
    }

    // ── Dashboard ──────────────────────────────────────────────────
    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDashboard(
            @RequestParam("partnerCode")                    String partnerCode,
            @RequestParam(value="month", required=false)    String month
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                floatService.getDashboard(partnerCode, month)));
    }

    // ── Partner config for frontend ────────────────────────────────
    @GetMapping("/partners")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPartners(
            @RequestParam("category") String category) {
        Map<String, Object> result = new LinkedHashMap<>();
        if ("LI".equalsIgnoreCase(category)) {
            result.put("parentGl", FloatConstants.PARENT_GL_LI);
            result.put("partners", FloatConstants.LI_PARTNERS.entrySet().stream()
                    .map(e -> Map.of(
                            "code", e.getKey(),
                            "display", FloatConstants.DISPLAY.getOrDefault(e.getKey(), e.getKey()),
                            "gl", e.getValue()
                    )).toList());
        } else {
            result.put("parentGl", FloatConstants.PARENT_GL_MI);
            Map<String, List<Map<String,String>>> segs = new LinkedHashMap<>();
            FloatConstants.MI_SEGMENTS.forEach((seg, map) -> {
                segs.put(seg, map.entrySet().stream()
                        .map(e -> Map.of(
                                "code", e.getKey(),
                                "display", FloatConstants.DISPLAY.getOrDefault(e.getKey(), e.getKey()),
                                "gl", e.getValue()
                        )).toList());
            });
            result.put("segments", segs);
        }
        return ResponseEntity.ok(ApiResponse.ok(result));
    }
}