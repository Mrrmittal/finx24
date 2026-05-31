package com.Finx24.float_register.repository;

import com.Finx24.float_register.entity.FloatTataI24;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

/**
 * Top-up condition: TATA INSURE24 — Mode of Payment RTGS/NEFT
 */
@Repository
public interface FloatTataI24Repository extends GenericFloatRepository<FloatTataI24> {

    @Query("SELECT DISTINCT r.monthLabel FROM FloatTataI24 r ORDER BY r.monthLabel ASC")
    List<String> findAvailableMonths();

    @Query("SELECT DISTINCT r.periodLabel FROM FloatTataI24 r ORDER BY r.periodLabel ASC")
    List<String> findAvailablePeriods();

    /**
     * Monthly summary:
     * col[0]=monthLabel, [1]=topUpCredit, [2]=cancelCredit, [3]=totalDebit, [4]=maxBalance
     */
    @Query("SELECT r.monthLabel, " +
           "SUM(CASE WHEN (LOWER(r.transactionDetails) = 'rtgs/neft' OR LOWER(r.transactionDetails) LIKE '%rtgs%' OR LOWER(r.transactionDetails) LIKE '%neft%') THEN r.creditAmt ELSE 0 END), " +
           "SUM(CASE WHEN NOT (LOWER(r.transactionDetails) = 'rtgs/neft' OR LOWER(r.transactionDetails) LIKE '%rtgs%' OR LOWER(r.transactionDetails) LIKE '%neft%') AND r.creditAmt > 0 THEN r.creditAmt ELSE 0 END), " +
           "SUM(r.debitAmt), MAX(r.balance) " +
           "FROM FloatTataI24 r " +
           "WHERE r.periodLabel != 'Opening Balance' " +
           "GROUP BY r.monthLabel ORDER BY r.monthLabel ASC")
    List<Object[]> findMonthSummary();

    @Query("SELECT r.periodLabel, " +
           "SUM(CASE WHEN (LOWER(r.transactionDetails) = 'rtgs/neft' OR LOWER(r.transactionDetails) LIKE '%rtgs%' OR LOWER(r.transactionDetails) LIKE '%neft%') THEN r.creditAmt ELSE 0 END), " +
           "SUM(CASE WHEN NOT (LOWER(r.transactionDetails) = 'rtgs/neft' OR LOWER(r.transactionDetails) LIKE '%rtgs%' OR LOWER(r.transactionDetails) LIKE '%neft%') AND r.creditAmt > 0 THEN r.creditAmt ELSE 0 END), " +
           "SUM(r.debitAmt), MAX(r.balance) " +
           "FROM FloatTataI24 r " +
           "WHERE r.periodLabel != 'Opening Balance' " +
           "GROUP BY r.periodLabel ORDER BY r.periodLabel ASC")
    List<Object[]> findPeriodSummary();
}
