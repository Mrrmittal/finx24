package com.Finx24.schedules.loanins.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;

/**
 * Contract for Loan Insurance Schedule generation.
 * Implementation: LiScheduleServiceImpl
 *
 * Generates a 5-sheet Excel:
 *   1. Summary
 *   2. Accrual Entry
 *   3. Go_Digit Float
 *   4. Disbursal Report - Active
 *   5. Subsequent Cancellation
 */
public interface LiScheduleService {

    /**
     * Generate LI Schedule Excel for given period.
     *
     * @param from       Period start date (e.g. 2026-04-01)
     * @param to         Period end date   (e.g. 2026-04-30)
     * @param monthLabel e.g. "Apr'26"
     * @param floatFile  Go Digit float Excel uploaded by user
     * @return byte[] — Excel file ready for download
     */
    /** Returns total expense from float for the period */
    double getLastTotalExpense();

    byte[] generateSchedule(LocalDate from, LocalDate to,
                            String monthLabel,
                            MultipartFile floatFile) throws IOException;
}