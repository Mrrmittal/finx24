package com.Finx24.float_register.repository;

import com.Finx24.float_register.entity.FloatTataI24;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FloatTataI24Repository extends GenericFloatRepository<FloatTataI24> {

    @Query("SELECT DISTINCT r.monthLabel FROM FloatTataI24 r ORDER BY r.monthLabel ASC")
    List<String> findAvailableMonths();

    @Query("SELECT DISTINCT r.periodLabel FROM FloatTataI24 r ORDER BY r.periodLabel ASC")
    List<String> findAvailablePeriods();

    @Query("SELECT r.monthLabel, SUM(r.creditAmt), SUM(r.debitAmt), MAX(r.balance) " +
            "FROM FloatTataI24 r GROUP BY r.monthLabel ORDER BY r.monthLabel ASC")
    List<Object[]> findMonthSummary();

    @Query("SELECT r.periodLabel, SUM(r.creditAmt), SUM(r.debitAmt), MAX(r.balance) " +
            "FROM FloatTataI24 r GROUP BY r.periodLabel ORDER BY r.periodLabel ASC")
    List<Object[]> findPeriodSummary();
}