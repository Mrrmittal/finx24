package com.Finx24.schedules.pocket.service;

import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDate;

/**
 * Pocket Insurance Schedule generation.
 *
 * Business Logic:
 *   - Product cost   : ₹2,360 (incl. GST 18%)
 *   - Base (ex-GST)  : ₹2,000
 *   - Partner share  : ₹550  (Assurekit — vendor)
 *   - Our share      : ₹1,550 (Net Commission)
 *
 * Schedule has 4 sheets:
 *   1. Summary          — period KPIs + channel breakdown (C2C / UCB)
 *   2. Accrual Entry    — accounting entry for the period
 *   3. Disbursal Active — active cases with pocket insurance
 *   4. Sub Cancellation — previous month cancellations (reversed)
 */
public interface PocketInsuranceScheduleService {

    /**
     * @param from          Period start date
     * @param to            Period end date
     * @param monthLabel    e.g. "Mar'26"
     * @param disbursalFile Disbursal report Excel (same format as LI schedule)
     */
    byte[] generateSchedule(LocalDate from, LocalDate to,
                             String monthLabel,
                             MultipartFile disbursalFile) throws Exception;
}
