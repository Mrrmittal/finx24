package com.Finx24.float_register.repository;

import com.Finx24.float_register.entity.FloatIciciI24;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

/**
 * Top-up condition: ICICI INSURE24 — transaction_type = '---'
 */
@Repository
public interface FloatIciciI24Repository extends GenericFloatRepository<FloatIciciI24> {

    @Query("SELECT DISTINCT r.monthLabel FROM FloatIciciI24 r ORDER BY r.monthLabel ASC")
    List<String> findAvailableMonths();

    @Query("SELECT DISTINCT r.periodLabel FROM FloatIciciI24 r ORDER BY r.periodLabel ASC")
    List<String> findAvailablePeriods();

    /**
     * Monthly summary:
     * col[0]=monthLabel, [1]=topUpCredit, [2]=cancelCredit, [3]=totalDebit, [4]=maxBalance
     */
    @Query("SELECT r.monthLabel, " +
           "SUM(CASE WHEN (r.bookingType = '---') THEN r.creditAmt ELSE 0 END), " +
           "SUM(CASE WHEN NOT (r.bookingType = '---') AND r.creditAmt > 0 THEN r.creditAmt ELSE 0 END), " +
           "SUM(r.debitAmt), MAX(r.balance) " +
           "FROM FloatIciciI24 r " +
           "WHERE r.periodLabel != 'Opening Balance' " +
           "GROUP BY r.monthLabel ORDER BY r.monthLabel ASC")
    List<Object[]> findMonthSummary();

    @Query("SELECT r.periodLabel, " +
           "SUM(CASE WHEN (r.bookingType = '---') THEN r.creditAmt ELSE 0 END), " +
           "SUM(CASE WHEN NOT (r.bookingType = '---') AND r.creditAmt > 0 THEN r.creditAmt ELSE 0 END), " +
           "SUM(r.debitAmt), MAX(r.balance) " +
           "FROM FloatIciciI24 r " +
           "WHERE r.periodLabel != 'Opening Balance' " +
           "GROUP BY r.periodLabel ORDER BY r.periodLabel ASC")
    List<Object[]> findPeriodSummary();
}
