package com.Finx24.schedules.loanins.service;

import com.Finx24.schedules.loanins.entity.LiAccrualActualized;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Contract for Loan Insurance Schedule generation.
 */
public interface LiScheduleService {

    byte[] generateSchedule(LocalDate from, LocalDate to, String monthLabel) throws IOException;

    List<String> getAccrualMonths();

    List<LiAccrualActualized> getAccrualRecords(String month);

    byte[] generateAccrualTemplate() throws IOException;

    Map<String, Integer> processManualUpload(MultipartFile file) throws IOException;

    LiAccrualActualized updateAccrualRecord(Long id, Map<String, Object> updates);

    /**
     * Create or update a single accrual record by (month, loanApplicationId).
     * If a matching record exists it is updated; otherwise a new one is inserted.
     */
    LiAccrualActualized upsertAccrualRecord(Map<String, Object> data);

    /**
     * Upload Go Digit commission file (with PR file for policy→loan ID mapping).
     * Stores all rows in LI_COMMISSION_FILE and actualizes matching LI_ACCRUAL_ACTUALIZED entries.
     * @return map with keys: stored, actualized, skipped
     */
    Map<String, Integer> processCommissionUpload(
            String accrualMonth,
            MultipartFile commissionFile,
            MultipartFile prFile) throws IOException;
}