package com.Finx24.float_register.repository;

import com.Finx24.float_register.entity.FloatBajajI24;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FloatBajajI24Repository extends GenericFloatRepository<FloatBajajI24> {

    @Query("SELECT DISTINCT r.monthLabel FROM FloatBajajI24 r " +
           "WHERE r.floatType NOT IN ('OPENING_BALANCE','CLOSING_BALANCE') " +
           "ORDER BY r.monthLabel ASC")
    List<String> findAvailableMonths();

    @Query("SELECT DISTINCT r.periodLabel FROM FloatBajajI24 r " +
           "WHERE r.floatType NOT IN ('OPENING_BALANCE','CLOSING_BALANCE') " +
           "ORDER BY r.periodLabel ASC")
    List<String> findAvailablePeriods();

    /** col[0]=monthLabel, [1]=topUpCredit, [2]=cancelCredit, [3]=totalDebit, [4]=maxBalance */
    @Query("SELECT r.monthLabel, " +
           "SUM(CASE WHEN (r.creditAmt > 0) THEN r.creditAmt ELSE 0 END), " +
           "SUM(CASE WHEN NOT (r.creditAmt > 0) AND r.creditAmt > 0 THEN r.creditAmt ELSE 0 END), " +
           "SUM(r.debitAmt), MAX(r.balance) " +
           "FROM FloatBajajI24 r " +
           "WHERE r.floatType NOT IN ('OPENING_BALANCE','CLOSING_BALANCE') " +
           "GROUP BY r.monthLabel ORDER BY r.monthLabel ASC")
    List<Object[]> findMonthSummary();

    @Query("SELECT r.periodLabel, " +
           "SUM(CASE WHEN (r.creditAmt > 0) THEN r.creditAmt ELSE 0 END), " +
           "SUM(CASE WHEN NOT (r.creditAmt > 0) AND r.creditAmt > 0 THEN r.creditAmt ELSE 0 END), " +
           "SUM(r.debitAmt), MAX(r.balance) " +
           "FROM FloatBajajI24 r " +
           "WHERE r.floatType NOT IN ('OPENING_BALANCE','CLOSING_BALANCE') " +
           "GROUP BY r.periodLabel ORDER BY r.periodLabel ASC")
    List<Object[]> findPeriodSummary();
}
