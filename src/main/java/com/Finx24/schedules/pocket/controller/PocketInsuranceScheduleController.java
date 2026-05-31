package com.Finx24.schedules.pocket.controller;

import com.Finx24.schedules.pocket.service.PocketInsuranceScheduleService;
import com.Finx24.disbursal.entity.DisbursalRecord;
import com.Finx24.disbursal.repository.DisbursalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/schedules/pocket-insurance")
@RequiredArgsConstructor
public class PocketInsuranceScheduleController {

    private final PocketInsuranceScheduleService service;
    private final DisbursalRepository            repo;

    private static final double NET_COMM = 1550.0;

    /**
     * POST /schedules/pocket-insurance/generate
     * Form params: from, to, monthLabel, disbursalFile (optional)
     */
    /**
     * GET /schedules/pocket-insurance/preview
     * Returns summary stats for the period (for frontend preview before download)
     */
    @GetMapping("/preview")
    public ResponseEntity<Map<String,Object>> preview(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam String monthLabel) {

        var active  = repo.findActivePocketInsurance(from, to);
        var cancel  = repo.findSubCancelPocketInsurance(from, to);

        // Channel breakdown
        Map<String, Map<String,Integer>> byChannel = new LinkedHashMap<>();
        for (DisbursalRecord r : active) {
            String ch = r.getChannel() != null ? r.getChannel().toUpperCase() : "OTHER";
            byChannel.computeIfAbsent(ch, k -> new HashMap<>()).merge("active", 1, Integer::sum);
        }
        for (DisbursalRecord r : cancel) {
            String ch = r.getChannel() != null ? r.getChannel().toUpperCase() : "OTHER";
            byChannel.computeIfAbsent(ch, k -> new HashMap<>()).merge("cancel", 1, Integer::sum);
        }

        Map<String,Object> result = new LinkedHashMap<>();
        result.put("monthLabel",  monthLabel);
        result.put("activeCount", active.size());
        result.put("cancelCount", cancel.size());
        result.put("activeComm",  active.size()  * NET_COMM);
        result.put("cancelComm",  cancel.size()  * NET_COMM);
        result.put("netAccrual",  (active.size() - cancel.size()) * NET_COMM);
        result.put("byChannel",   byChannel);

        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @PostMapping(value = "/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ByteArrayResource> generate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam String monthLabel,
            @RequestPart(value = "disbursalFile", required = false) MultipartFile disbursalFile,
            Authentication auth) throws Exception {

        log.info("[PI Schedule] Generate by {} | period={} to {} | {}",
                auth.getName(), from, to, monthLabel);

        byte[] bytes = service.generateSchedule(from, to, monthLabel, disbursalFile);
        String filename = "Pocket_Insurance_Schedule_"
                        + monthLabel.replace("'", "_") + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }
}
