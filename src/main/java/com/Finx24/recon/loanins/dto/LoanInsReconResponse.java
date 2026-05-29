package com.Finx24.recon.loanins.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data @Builder
public class LoanInsReconResponse {
    private String        reconId;        // UUID for Excel download
    private String        period;         // "Mar 2026"
    private int           totalLoans;
    private int           matched;
    private double        matchPct;
    private int           openQueries;
    private int           cancelled;
    private int           notDisbursed;
    private int           mismatch;
    private int           prMatch;        // Float vs PR match count
    private int           prMismatch;
    private double        totalFloatDeducted;
    private double        totalSapLi;
    private double        totalGrossPr;
    private int           cancellations;
    private int           topUps;
    private LocalDateTime processedAt;
    private String        downloadUrl;    // /api/recon/loan-insurance/download/{reconId}
}
