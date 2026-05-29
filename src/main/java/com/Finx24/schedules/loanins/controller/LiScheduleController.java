package com.Finx24.schedules.loanins.controller;

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
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/schedules/loan-insurance")
@RequiredArgsConstructor
@Tag(name = "Loan Insurance Schedule", description = "Generate & export LI Schedule Excel")
public class LiScheduleController {

    private final LiScheduleService liScheduleService;

    // ── Generate + Download LI Schedule ─────────────────────────
    @PostMapping(value = "/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Generate LI Schedule for selected period",
            description = "Returns 5-sheet Excel: Summary + Accrual + Float + Active + Cancellation")
    public ResponseEntity<ByteArrayResource> generate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam String monthLabel,
            @RequestPart("floatFile") MultipartFile floatFile,
            Authentication auth
    ) throws Exception {

        log.info("[LI Schedule] Generate by {} | period={} to {} | label={}",
                auth.getName(), from, to, monthLabel);

        byte[] bytes = liScheduleService.generateSchedule(from, to, monthLabel, floatFile);

        String filename = "LI_Schedule_" + monthLabel.replace("'", "_") + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(new ByteArrayResource(bytes));
    }

    @GetMapping("/last-expense")
    public ResponseEntity<Map<String, Object>> getLastExpense() {
        return ResponseEntity.ok(Map.of("totalExpense", liScheduleService.getLastTotalExpense()));
    }
}