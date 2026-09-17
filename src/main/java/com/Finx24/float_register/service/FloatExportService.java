package com.Finx24.float_register.service;

public interface FloatExportService {
    /**
     * Generate Float Register Excel for given category across a month range.
     * Each partner sheet contains every month's rows from fromMonth..toMonth
     * (inclusive), and the summary formulas total across the full range.
     *
     * @param category  "LI" or "MI"
     * @param fromMonth e.g. "Apr'26" (period start, inclusive)
     * @param toMonth   e.g. "Jun'26" (period end, inclusive); pass the same
     *                  value as fromMonth for a single-month report
     * @return Excel file bytes (formula-based, not hardcoded)
     */
    byte[] generateReport(String category, String fromMonth, String toMonth) throws Exception;
}
