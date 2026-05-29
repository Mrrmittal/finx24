package com.Finx24.float_register.repository;

import com.Finx24.float_register.entity.FloatGoDigitDO;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FloatGoDigitDORepository extends GenericFloatRepository<FloatGoDigitDO> {

    @Query("SELECT DISTINCT r.monthLabel FROM FloatGoDigitDO r ORDER BY r.monthLabel ASC")
    List<String> findAvailableMonths();

    @Query("SELECT DISTINCT r.periodLabel FROM FloatGoDigitDO r ORDER BY r.periodLabel ASC")
    List<String> findAvailablePeriods();

    @Query("SELECT r.monthLabel, SUM(r.creditAmt), SUM(r.debitAmt), " +
            "SUM(r.expense), MAX(r.balance) " +
            "FROM FloatGoDigitDO r GROUP BY r.monthLabel ORDER BY r.monthLabel ASC")
    List<Object[]> findMonthSummary();

    @Query("SELECT r.periodLabel, SUM(r.creditAmt), SUM(r.debitAmt), " +
            "SUM(r.expense), MAX(r.balance) " +
            "FROM FloatGoDigitDO r GROUP BY r.periodLabel ORDER BY r.periodLabel ASC")
    List<Object[]> findPeriodSummary();
}