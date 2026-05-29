package com.Finx24.disbursal.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @Builder
public class DisbursalUploadResponse {
    private String        fileName;
    private int           totalRows;
    private int           insertedRows;
    private int           updatedRows;
    private int           cancelledRows;
    private LocalDate     periodFrom;
    private LocalDate     periodTo;
    private LocalDateTime uploadedAt;
}