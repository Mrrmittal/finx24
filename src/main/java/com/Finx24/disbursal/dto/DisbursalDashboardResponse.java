package com.Finx24.disbursal.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data @Builder
public class DisbursalDashboardResponse {
    private LocalDate periodFrom;
    private LocalDate periodTo;

    // ── Core KPIs ─────────────────────────────────────────────────
    private long   netLoanCount;           // active - old_month_cancel
    private long   activeLoans;
    private long   sameMonthCancellations; // 0 treatment
    private long   oldMonthCancellations;  // -ve treatment

    // ── Amounts ───────────────────────────────────────────────────
    private double netDisbursalAmount;     // active - old_month_cancel
    private double cancelledAmount;
    private double avgLoanPerLead;
    private long   liChargesLoanCount;      // count of loans with LI_CHARGES > 0
    private double liNetDisbursalAmount;    // sum of NET_DISBURSAL_AMOUNT where LI_CHARGES > 0        // total old month cancel amount
    private double liCharges;
    private double miCharges;

    // ── Breakdowns ────────────────────────────────────────────────
    private List<Map<String, Object>> bySegment;
    private List<Map<String, Object>> byChannel;
    private List<Map<String, Object>> byLoanBook;  // CARS24 Book, Bajaj Colending, PMax Book
    private List<Map<String, Object>> topCities;
    private List<Map<String, Object>> dailyTrend;
    private List<Map<String, Object>> topLoans;    // Top 20 active loans by gross (TOTAL_LOAN_AMOUNT)

    // ── Calendar picker data ──────────────────────────────────────
    private List<Map<String, Object>> availableMonths;
}