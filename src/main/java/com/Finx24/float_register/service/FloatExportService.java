package com.Finx24.float_register.service;

public interface FloatExportService {
    /**
     * Generate Float Register Excel for given category and month.
     * @param category "LI" or "MI"
     * @param monthLabel e.g. "Apr'26"
     * @return Excel file bytes (formula-based, not hardcoded)
     */
    byte[] generateMonthReport(String category, String monthLabel) throws Exception;
}
