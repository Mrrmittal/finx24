package com.Finx24.float_register.controller;

import com.Finx24.float_register.service.FloatExportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/float")
@RequiredArgsConstructor
public class FloatExportController {

    private final FloatExportService exportService;

    /**
     * GET /float/export?category=LI&month=Apr'26
     * GET /float/export?category=MI&month=Apr'26
     * GET /float/export?category=MI&month=Apr'26&toMonth=Jun'26   (period range)
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(defaultValue = "MI") String category,
            @RequestParam String month,
            @RequestParam(required = false) String toMonth) {
        try {
            String to = (toMonth == null || toMonth.isBlank()) ? month : toMonth;
            log.info("[Float Export] category={} from={} to={}", category, month, to);
            byte[] data = exportService.generateReport(category, month, to);
            String safeFrom = month.replace("'", "");
            String safeTo   = to.replace("'", "");
            String filename = category + "_Float_Register_" + safeFrom
                    + (safeTo.equals(safeFrom) ? "" : "_to_" + safeTo) + ".xlsx";
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
        } catch (Exception e) {
            log.error("[Float Export] Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
