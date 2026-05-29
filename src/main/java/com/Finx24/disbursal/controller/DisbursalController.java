package com.Finx24.disbursal.controller;

import com.Finx24.common.response.ApiResponse;
import com.Finx24.disbursal.dto.DisbursalDashboardResponse;
import com.Finx24.disbursal.dto.DisbursalUploadResponse;
import com.Finx24.disbursal.service.DisbursalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/disbursal")
@RequiredArgsConstructor
@Tag(name = "Disbursal Report", description = "Admin: upload data | User: dashboard + export")
public class DisbursalController {

    private final DisbursalService disbursalService;

    // ─────────────────────────────────────────────────────────────
    //  ADMIN ONLY — Upload disbursal report to database
    // ─────────────────────────────────────────────────────────────
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "[ADMIN] Upload disbursal report Excel to database",
            description = "UPSERT by LOAN_APPLICATION_ID. Old Month Cancellations update existing records.")
    public ResponseEntity<ApiResponse<DisbursalUploadResponse>> upload(
            @RequestPart("file") MultipartFile file,
            Authentication auth
    ) throws Exception {

        if (file.isEmpty())
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File is empty", "EMPTY_FILE"));

        String uploadedBy = auth.getName();
        log.info("[Disbursal] Upload started by {} | file={} size={}",
                uploadedBy, file.getOriginalFilename(), file.getSize());

        DisbursalUploadResponse response = disbursalService.upload(file, uploadedBy);
        return ResponseEntity.ok(ApiResponse.ok(response,
                "Upload complete: " + response.getTotalRows() + " records processed"));
    }

    // ─────────────────────────────────────────────────────────────
    //  USER + ADMIN — Dashboard with period filter
    // ─────────────────────────────────────────────────────────────
    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('USER','ADMIN')")
    @Operation(summary = "Get disbursal dashboard for a period",
            description = "3-bucket logic: Active=+ve, SameMonth=0, OldMonth=-ve")
    public ResponseEntity<ApiResponse<DisbursalDashboardResponse>> dashboard(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        log.info("[Disbursal] Dashboard request: {} to {}", from, to);
        DisbursalDashboardResponse dash = disbursalService.getDashboard(from, to);
        return ResponseEntity.ok(ApiResponse.ok(dash));
    }

    // ─────────────────────────────────────────────────────────────
    //  USER + ADMIN — Export formatted Excel
    // ─────────────────────────────────────────────────────────────
    @GetMapping("/export")
    @PreAuthorize("hasAnyRole('USER','ADMIN')")
    @Operation(summary = "Export disbursal data as formatted Excel",
            description = "Returns Raw Data sheet + Summary Dashboard sheet")
    public ResponseEntity<ByteArrayResource> export(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth
    ) throws Exception {

        log.info("[Disbursal] Export by {} | {} to {}", auth.getName(), from, to);
        byte[] bytes = disbursalService.exportExcel(from, to);
        String filename = "Disbursal_" + from + "_to_" + to + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(new ByteArrayResource(bytes));
    }

    // ─────────────────────────────────────────────────────────────
    //  Available months (for calendar picker)
    // ─────────────────────────────────────────────────────────────
    @GetMapping("/available-months")
    @PreAuthorize("hasAnyRole('USER','ADMIN')")
    @Operation(summary = "Get list of months available in database")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> availableMonths() {
        return ResponseEntity.ok(ApiResponse.ok(disbursalService.getAvailableMonths()));
    }
}