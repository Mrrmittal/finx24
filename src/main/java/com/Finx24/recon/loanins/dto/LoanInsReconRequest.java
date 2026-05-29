package com.Finx24.recon.loanins.dto;

import lombok.Builder;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Data @Builder
public class LoanInsReconRequest {
    private MultipartFile       floatFile;
    private List<MultipartFile> prFiles;
    private MultipartFile       hanaFile;
    private List<MultipartFile> monthlyDRFiles;
    private String              monthLabel;
    private String              reconMode;    // "month" | "range"
    private String              rangeStart;   // "2026-02-01"
    private String              rangeEnd;     // "2026-03-31"
}
