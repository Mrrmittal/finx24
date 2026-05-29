package com.Finx24.recon.loanins.controller;

import com.Finx24.common.response.ApiResponse;
import com.Finx24.recon.loanins.dto.LoanInsReconRequest;
import com.Finx24.recon.loanins.dto.LoanInsReconResponse;
import com.Finx24.recon.loanins.service.LoanInsReconService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/recon/loan-insurance")
@RequiredArgsConstructor
@Tag(name = "Loan Insurance Recon", description = "LI Float Reconciliation — v5")
@SecurityRequirement(name = "bearerAuth")
public class LoanInsReconController {

    private final LoanInsReconService reconService;

    /**
     * POST /api/recon/loan-insurance/run
     *
     * Accepts multipart form:
     *   floatFile     : Go Digit Float Register (.xlsx)
     *   prFiles       : PR Register files (one or more for date range)
     *   hanaFile      : SAP HANA loan sheet (optional)
     *   monthlyDRFiles: Monthly disbursal reports (optional, multiple)
     *   monthLabel    : "Mar 2026" (for single month mode)
     *   reconMode     : "month" | "range"
     *   rangeStart    : "2026-02-01" (for range mode)
     *   rangeEnd      : "2026-03-31" (for range mode)
     */
    @PostMapping(value = "/run", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('USER','ADMIN')")
    @Operation(summary = "Run LI reconciliation",
               description = "Processes uploaded files and returns reconciliation summary + Excel download URL")
    public ResponseEntity<ApiResponse<LoanInsReconResponse>> runRecon(
            @RequestPart("floatFile")                    MultipartFile floatFile,
            @RequestPart("prFiles")                      List<MultipartFile> prFiles,
            @RequestPart(value = "hanaFile",   required = false) MultipartFile hanaFile,
            @RequestPart(value = "monthlyDRFiles", required = false) List<MultipartFile> monthlyDRFiles,
            @RequestParam("monthLabel")                  String monthLabel,
            @RequestParam(value = "reconMode",  defaultValue = "month") String reconMode,
            @RequestParam(value = "rangeStart", required = false) String rangeStart,
            @RequestParam(value = "rangeEnd",   required = false) String rangeEnd
    ) {
        log.info("[LIRecon] Run | mode={} | period={} | prFiles={} | monthlyDR={}",
                reconMode, monthLabel,
                prFiles.size(),
                monthlyDRFiles != null ? monthlyDRFiles.size() : 0);

        LoanInsReconRequest request = LoanInsReconRequest.builder()
                .floatFile(floatFile)
                .prFiles(prFiles)
                .hanaFile(hanaFile)
                .monthlyDRFiles(monthlyDRFiles)
                .monthLabel(monthLabel)
                .reconMode(reconMode)
                .rangeStart(rangeStart)
                .rangeEnd(rangeEnd)
                .build();

        LoanInsReconResponse response = reconService.runRecon(request);
        return ResponseEntity.ok(ApiResponse.ok(response, "Reconciliation completed"));
    }

    /**
     * GET /api/recon/loan-insurance/download/{reconId}
     * Download the generated Excel report.
     */
    @GetMapping("/download/{reconId}")
    @PreAuthorize("hasAnyRole('USER','ADMIN')")
    @Operation(summary = "Download recon Excel")
    public ResponseEntity<ByteArrayResource> download(@PathVariable String reconId) {
        byte[] excelBytes = reconService.getExcelBytes(reconId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"LI_Recon_" + reconId + ".xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(new ByteArrayResource(excelBytes));
    }

    /**
     * GET /api/recon/loan-insurance/history
     * Fetch past recon runs for the current user.
     * ADMIN sees all users' history.
     */
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('USER','ADMIN')")
    @Operation(summary = "Get recon history")
    public ResponseEntity<ApiResponse<List<LoanInsReconResponse>>> history(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(ApiResponse.ok(reconService.getHistory(page, size)));
    }
}
