package com.Finx24.disbursal.repository;

import com.Finx24.disbursal.entity.DisbursalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Repository
public interface DisbursalRepository extends JpaRepository<DisbursalRecord, String> {

    // ── Dashboard: fetch all records relevant to a period ─────────
    // Includes:
    //   1. Active loans disbursed IN period
    //   2. Same Month Cancellations disbursed IN period
    //   3. Old Month Cancellations whose cancel_date falls IN period
    // Dashboard query — fetch ALL records relevant to period using DATES ONLY
    // Bucket assignment is done in service layer, not here
    //   disbDate IN period                          → could be Active or Same Month Cancel
    //   cancelDate IN period (disbDate before)      → Old Month Cancellation
    //   disbDate IN period AND cancelDate IN period → Same Month Cancellation
    @Query("""
        SELECT r FROM DisbursalRecord r
        WHERE r.disbursementDate BETWEEN :from AND :to
           OR r.cancellationDate BETWEEN :from AND :to
        ORDER BY r.disbursementDate ASC NULLS LAST
        """)
    List<DisbursalRecord> findForPeriod(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── Export: same as dashboard but all records ─────────────────
    @Query("""
        SELECT r FROM DisbursalRecord r
        WHERE r.disbursementDate BETWEEN :from AND :to
           OR r.cancellationDate BETWEEN :from AND :to
        ORDER BY r.disbursementDate ASC NULLS LAST
        """)
    List<DisbursalRecord> findForExport(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── Mark existing active loan as cancelled (Old Month logic) ──
    @Modifying
    @Query("""
        UPDATE DisbursalRecord r SET
            r.loanStatus       = 'Cancelled',
            r.status           = 'Old Month Cancellation',
            r.cancellationDate = :cancelDate,
            r.lastUpdatedAt    = CURRENT_TIMESTAMP
        WHERE r.loanApplicationId = :loanId
          AND (LOWER(r.loanStatus) = 'active'
               OR r.loanStatus IS NULL)
        """)
    int markAsCancelled(
            @Param("loanId")     String    loanId,
            @Param("cancelDate") LocalDate cancelDate);

    // ── Check available periods in DB (for calendar view) ─────────
    @Query(value = """
        SELECT DISTINCT
            YEAR(DISBURSEMENT_DATE)  AS yr,
            MONTH(DISBURSEMENT_DATE) AS mo
        FROM disbursal_records
        WHERE DISBURSEMENT_DATE IS NOT NULL
        ORDER BY yr DESC, mo DESC
        """, nativeQuery = true)
    List<Map<String, Object>> findAvailableMonths();

    // ── KPI aggregates for period (native for performance) ────────
    @Query(value = """
        SELECT
            COUNT(CASE WHEN loan_status = 'ACTIVE' THEN 1 END)               AS active_count,
            COUNT(CASE WHEN status = 'Same Month Cancellation' THEN 1 END)    AS same_month_cancel,
            COUNT(CASE WHEN status = 'Old Month Cancellation'
                        AND cancellation_date BETWEEN :from AND :to
                        AND disbursement_date < :from THEN 1 END)             AS old_month_cancel,
            COALESCE(SUM(CASE WHEN loan_status = 'ACTIVE'
                          THEN net_disbursal_amount ELSE 0 END), 0)           AS net_active_amount,
            COALESCE(SUM(CASE WHEN status = 'Old Month Cancellation'
                          AND cancellation_date BETWEEN :from AND :to
                          AND disbursement_date < :from
                          THEN net_disbursal_amount ELSE 0 END), 0)           AS net_cancel_amount,
            COALESCE(SUM(CASE WHEN loan_status = 'ACTIVE'
                          THEN li_charges ELSE 0 END), 0)                     AS li_charges,
            COALESCE(SUM(CASE WHEN loan_status = 'ACTIVE'
                          THEN mi_charges ELSE 0 END), 0)                     AS mi_charges
        FROM disbursal_records
        WHERE (disbursement_date BETWEEN :from AND :to)
           OR (status = 'Old Month Cancellation'
               AND cancellation_date BETWEEN :from AND :to)
        """, nativeQuery = true)
    Map<String, Object> getKpiAggregates(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── Segment breakdown ─────────────────────────────────────────
    @Query(value = """
        SELECT segment,
            COUNT(CASE WHEN loan_status='ACTIVE' THEN 1 END)       AS cnt,
            SUM(CASE WHEN loan_status='ACTIVE'
                     THEN net_disbursal_amount ELSE 0 END)         AS amount
        FROM disbursal_records
        WHERE disbursement_date BETWEEN :from AND :to
          AND loan_status = 'ACTIVE'
        GROUP BY segment
        ORDER BY amount DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getSegmentBreakdown(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── Channel breakdown ─────────────────────────────────────────
    @Query(value = """
        SELECT channel,
            COUNT(CASE WHEN loan_status='ACTIVE' THEN 1 END)       AS cnt,
            SUM(CASE WHEN loan_status='ACTIVE'
                     THEN net_disbursal_amount ELSE 0 END)         AS amount
        FROM disbursal_records
        WHERE disbursement_date BETWEEN :from AND :to
          AND loan_status = 'ACTIVE'
        GROUP BY channel
        ORDER BY amount DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getChannelBreakdown(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── City breakdown (top 10) ───────────────────────────────────
    @Query(value = """
        SELECT TOP 10 city,
            COUNT(*)  AS cnt,
            SUM(CASE WHEN loan_status='ACTIVE'
                     THEN net_disbursal_amount ELSE 0 END) AS amount
        FROM disbursal_records
        WHERE disbursement_date BETWEEN :from AND :to
          AND loan_status = 'ACTIVE'
          AND city IS NOT NULL
        GROUP BY city
        ORDER BY cnt DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCityBreakdown(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── Daily trend (for chart) ───────────────────────────────────
    @Query(value = """
        SELECT
            disbursement_date AS dt,
            COUNT(*)          AS cnt,
            SUM(CASE WHEN loan_status='ACTIVE'
                     THEN net_disbursal_amount ELSE 0 END) AS amount
        FROM disbursal_records
        WHERE disbursement_date BETWEEN :from AND :to
        GROUP BY disbursement_date
        ORDER BY disbursement_date ASC
        """, nativeQuery = true)
    List<Map<String, Object>> getDailyTrend(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── LI Schedule: Active records by DISBURSEMENT_DATE ─────────
    // LI Schedule — Active: disbDate IN period AND cancelDate NULL or after period
    @Query("""
        SELECT r FROM DisbursalRecord r
        WHERE r.disbursementDate BETWEEN :from AND :to
          AND (r.cancellationDate IS NULL
               OR r.cancellationDate > :to)
        ORDER BY r.disbursementDate ASC
        """)
    List<DisbursalRecord> findActiveByPeriod(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── LI Schedule: Old Month Cancellations by CANCELLATION_DATE
    // LI Schedule — Subsequent Cancellation:
    //   cancelDate IN period AND disbDate BEFORE period (old month)
    @Query("""
        SELECT r FROM DisbursalRecord r
        WHERE r.cancellationDate BETWEEN :from AND :to
          AND r.disbursementDate < :from
        ORDER BY r.cancellationDate ASC
        """)
    List<DisbursalRecord> findCancellationsByPeriod(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    // ── Pocket Insurance Schedule ─────────────────────────────────
    /** Active cases in period WITH pocket insurance charge > 0 */
    @Query("""
        SELECT r FROM DisbursalRecord r
        WHERE r.disbursementDate >= :from
          AND r.disbursementDate <= :to
          AND (r.cancellationDate IS NULL OR r.cancellationDate > :to)
          AND r.pocketInsuranceCharge > 0
        ORDER BY r.channel ASC, r.disbursementDate ASC
        """)
    List<DisbursalRecord> findActivePocketInsurance(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);

    /** Sub-cancellations: cancelled IN period, disbursed BEFORE period, PI > 0 */
    @Query("""
        SELECT r FROM DisbursalRecord r
        WHERE r.cancellationDate >= :from
          AND r.cancellationDate <= :to
          AND r.disbursementDate < :from
          AND r.pocketInsuranceCharge > 0
        ORDER BY r.cancellationDate ASC
        """)
    List<DisbursalRecord> findSubCancelPocketInsurance(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);
}
