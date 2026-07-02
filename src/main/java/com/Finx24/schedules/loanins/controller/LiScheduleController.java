package com.Finx24.schedules.loanins.controller;

import com.Finx24.schedules.loanins.entity.LiAccrualActualized;
import com.Finx24.schedules.loanins.service.LiScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/schedules/loan-insurance")
@RequiredArgsConstructor
@Tag(name = "Loan Insurance Schedule", description = "Generate & export LI Schedule Excel")
public class LiScheduleController {

    private final LiScheduleService liScheduleService;

    // ── Generate + Download LI Schedule ─────────────────────────────
    @PostMapping("/generate")
    @Operation(summary = "Generate LI Schedule for selected period")
    public ResponseEntity<ByteArrayResource> generate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam String monthLabel,
            Authentication auth
    ) throws Exception {

        log.info("[LI Schedule] Generate by {} | period={} to {} | label={}",
                auth.getName(), from, to, monthLabel);

        byte[] bytes = liScheduleService.generateSchedule(from, to, monthLabel);
        String filename = "LI_Schedule_" + monthLabel.replace("'", "_") + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(new ByteArrayResource(bytes));
    }

    // ── Accrual vs Actual ────────────────────────────────────────────
    @GetMapping("/accrual-months")
    @Operation(summary = "Get months that have accrual entries in LI_ACCRUAL_ACTUALIZED")
    public ResponseEntity<List<String>> getAccrualMonths() {
        return ResponseEntity.ok(liScheduleService.getAccrualMonths());
    }

    @GetMapping("/accrual-records")
    @Operation(summary = "Get accrual records for a specific month")
    public ResponseEntity<List<LiAccrualActualized>> getAccrualRecords(@RequestParam String month) {
        return ResponseEntity.ok(liScheduleService.getAccrualRecords(month));
    }

    @GetMapping("/accrual-template")
    @Operation(summary = "Download blank accrual template XLSX for manual upload")
    public ResponseEntity<ByteArrayResource> getAccrualTemplate() throws Exception {
        byte[] bytes = liScheduleService.generateAccrualTemplate();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"LI_Accrual_Template.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(new ByteArrayResource(bytes));
    }

    @PostMapping(value = "/accrual-manual-upload",
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload manual accrual entries — upserts into LI_ACCRUAL_ACTUALIZED")
    public ResponseEntity<Map<String, Integer>> manualUpload(
            @RequestPart("file") MultipartFile file,
            Authentication auth) throws Exception {
        log.info("[LI Accrual] Manual upload by {} | file={} size={}",
                auth.getName(), file.getOriginalFilename(), file.getSize());
        return ResponseEntity.ok(liScheduleService.processManualUpload(file));
    }

    @PostMapping("/accrual-records")
    @Operation(summary = "Create or update a single accrual record — upsert by (month, loanApplicationId)")
    public ResponseEntity<LiAccrualActualized> upsertRecord(@RequestBody Map<String, Object> data) {
        return ResponseEntity.ok(liScheduleService.upsertAccrualRecord(data));
    }

    @PatchMapping("/accrual-records/{id}")
    @Operation(summary = "Update editable fields on an accrual record (invoice amount, status, etc.)")
    public ResponseEntity<LiAccrualActualized> updateRecord(
            @PathVariable Long id,
            @RequestBody Map<String, Object> updates) {
        return ResponseEntity.ok(liScheduleService.updateAccrualRecord(id, updates));
    }

    @PostMapping(value = "/commission-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload Go Digit commission file + PR file to actualize accruals")
    public ResponseEntity<Map<String, Integer>> commissionUpload(
            @RequestParam  String accrualMonth,
            @RequestPart("commissionFile") MultipartFile commissionFile,
            @RequestPart("prFile")         MultipartFile prFile,
            Authentication auth) throws Exception {
        log.info("[LI Commission] Upload by {} | month={} | commFile={} | prFile={}",
                auth.getName(), accrualMonth,
                commissionFile.getOriginalFilename(), prFile.getOriginalFilename());
        return ResponseEntity.ok(
                liScheduleService.processCommissionUpload(accrualMonth, commissionFile, prFile));
    }
}