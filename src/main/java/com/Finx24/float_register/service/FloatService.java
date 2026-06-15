package com.Finx24.float_register.service;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface FloatService {
    Map<String, Object> upload(MultipartFile file, String partnerCode,
                               String periodLabel, boolean allowOverwrite) throws IOException;
    Map<String, Object> uploadMaster(MultipartFile file, String periodLabel,
                                     boolean allowOverwrite) throws IOException;
    Map<String, Object> saveOpeningBalance(String partnerCode, LocalDate asOnDate, BigDecimal amount);
    List<Map<String, Object>> getRegister(String partnerCode, String monthOrPeriod, boolean byMonth);
    List<String> getAvailableMonths(String partnerCode);
    List<String> getAvailablePeriods(String partnerCode);
    Map<String, Object> getDashboard(String partnerCode, String filter);

    /**
     * Maps Loan ID (LI) or Car Reg No (MI) from a PR Register Excel file
     * into existing float records by matching policyNumber.
     * United_MI_GS is excluded — its float data already carries the reg no.
     *
     * @param monthLabel optional — if supplied, only records for that month are updated;
     *                   if null/blank, all months for the partner are updated
     */
    Map<String, Object> mapLoanId(MultipartFile file, String partnerCode,
                                   String monthLabel) throws IOException;
}