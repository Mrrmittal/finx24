package com.Finx24.recon.loanins.service;

import com.Finx24.common.exception.BusinessException;
import com.Finx24.common.exception.ResourceNotFoundException;
import com.Finx24.recon.loanins.dto.LoanInsReconRequest;
import com.Finx24.recon.loanins.dto.LoanInsReconResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Loan Insurance Reconciliation Service.
 *
 * Strategy: delegates heavy Excel processing to the existing Python engine
 * via ProcessBuilder (Java calls Python script). This avoids rewriting
 * 1000+ lines of Python logic in Java immediately.
 *
 * Migration path:
 *   Phase 1 → Java calls Python run_recon.py (current)
 *   Phase 2 → Java calls Python OR Apache POI native Java impl
 *   Phase 3 → Full Java/POI impl, Python retired
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LoanInsReconService {

    /** In-memory store for Excel bytes (Phase 1 — move to DB/S3 in Phase 2) */
    private final ConcurrentHashMap<String, byte[]> excelStore = new ConcurrentHashMap<>();

    // ── Run reconciliation ───────────────────────────────────────
    public LoanInsReconResponse runRecon(LoanInsReconRequest request) {
        String reconId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        Path tempDir   = null;

        try {
            // 1. Write uploaded files to temp directory
            tempDir = Files.createTempDirectory("finx24_li_" + reconId);
            Path floatPath = saveFile(request.getFloatFile(), tempDir, "float.xlsx");
            Path hanaPath  = request.getHanaFile() != null
                    ? saveFile(request.getHanaFile(), tempDir, "hana.xlsx") : null;

            // Save all PR files
            List<String> prPaths = new ArrayList<>();
            for (int i = 0; i < request.getPrFiles().size(); i++) {
                prPaths.add(saveFile(request.getPrFiles().get(i),
                        tempDir, "pr_" + i + ".xlsx").toString());
            }

            // Save monthly DR files
            List<String> drPaths = new ArrayList<>();
            if (request.getMonthlyDRFiles() != null) {
                for (int i = 0; i < request.getMonthlyDRFiles().size(); i++) {
                    drPaths.add(saveFile(request.getMonthlyDRFiles().get(i),
                            tempDir, "dr_" + i + ".xlsx").toString());
                }
            }

            // 2. Call Python engine
            // TODO Phase 2: Replace with pure Java Apache POI implementation
            byte[] excelBytes = callPythonEngine(
                    floatPath.toString(),
                    prPaths,
                    hanaPath != null ? hanaPath.toString() : "",
                    drPaths,
                    request.getMonthLabel(),
                    request.getReconMode(),
                    request.getRangeStart(),
                    request.getRangeEnd(),
                    tempDir
            );

            // 3. Store Excel for download
            excelStore.put(reconId, excelBytes);

            // 4. Parse summary from Python output
            // (Phase 2: Python returns JSON summary → parse here)
            return LoanInsReconResponse.builder()
                    .reconId(reconId)
                    .period(request.getMonthLabel())
                    .processedAt(LocalDateTime.now())
                    .downloadUrl("/api/recon/loan-insurance/download/" + reconId)
                    .build();

        } catch (Exception e) {
            log.error("[LIRecon] Failed for reconId={}: {}", reconId, e.getMessage(), e);
            throw new BusinessException(
                    "Reconciliation failed: " + e.getMessage(),
                    "RECON_FAILED",
                    org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR
            );
        } finally {
            // Clean up temp files
            if (tempDir != null) cleanupDir(tempDir);
        }
    }

    // ── Get Excel bytes for download ─────────────────────────────
    public byte[] getExcelBytes(String reconId) {
        byte[] bytes = excelStore.get(reconId);
        if (bytes == null) {
            throw new ResourceNotFoundException(
                    "Recon report not found or expired: " + reconId);
        }
        return bytes;
    }

    // ── History (Phase 2: from DB) ────────────────────────────────
    public List<LoanInsReconResponse> getHistory(int page, int size) {
        // TODO Phase 2: query ReconHistory table
        return List.of();
    }

    // ── Private helpers ───────────────────────────────────────────
    private Path saveFile(MultipartFile file, Path dir, String name) throws IOException {
        Path target = dir.resolve(name);
        file.transferTo(target);
        return target;
    }

    private byte[] callPythonEngine(
            String floatPath, List<String> prPaths, String hanaPath,
            List<String> drPaths, String monthLabel, String reconMode,
            String rangeStart, String rangeEnd, Path outputDir
    ) throws Exception {
        // Build command: python run_recon.py --module loanins ...
        List<String> cmd = new ArrayList<>();
        cmd.add("python3");
        cmd.add("python/run_recon.py");
        cmd.add("--module"); cmd.add("loanins");
        cmd.add("--float");  cmd.add(floatPath);
        cmd.add("--month");  cmd.add(monthLabel);
        if (!hanaPath.isEmpty()) { cmd.add("--hana"); cmd.add(hanaPath); }
        for (String pr : prPaths) { cmd.add("--pr"); cmd.add(pr); }
        for (String dr : drPaths) { cmd.add("--monthly_status"); cmd.add(dr); }

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(outputDir.getParent().toFile());
        pb.redirectErrorStream(true);
        Process process = pb.start();
        int exitCode = process.waitFor();

        if (exitCode != 0) {
            String err = new String(process.getInputStream().readAllBytes());
            throw new RuntimeException("Python engine exited " + exitCode + ": " + err);
        }

        // Read output Excel
        Path outputExcel = outputDir.resolve("LI_Recon_" + monthLabel.replace(" ","_") + ".xlsx");
        return Files.readAllBytes(outputExcel);
    }

    private void cleanupDir(Path dir) {
        try {
            Files.walk(dir)
                    .sorted(java.util.Comparator.reverseOrder())
                    .forEach(p -> { try { Files.delete(p); } catch (Exception ignored) {} });
        } catch (Exception ignored) {}
    }
}
