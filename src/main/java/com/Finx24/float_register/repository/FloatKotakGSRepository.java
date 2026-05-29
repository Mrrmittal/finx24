package com.Finx24.float_register.repository;

import com.Finx24.float_register.entity.FloatKotakGS;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FloatKotakGSRepository extends GenericFloatRepository<FloatKotakGS> {

    @Query("SELECT DISTINCT r.monthLabel FROM FloatKotakGS r ORDER BY r.monthLabel ASC")
    List<String> findAvailableMonths();

    @Query("SELECT DISTINCT r.periodLabel FROM FloatKotakGS r ORDER BY r.periodLabel ASC")
    List<String> findAvailablePeriods();

    /** All months summary — col[0]=month, [1]=topUp, [2]=cancelCredit, [3]=debit, [4]=closingBal */
    @Query("SELECT r.monthLabel, " +
           "SUM(CASE WHEN LOWER(r.bookingType) LIKE '%manual payment slip%' " +
           "         OR LOWER(r.bookingType) LIKE '%online%' " +
           "         THEN r.creditAmt ELSE 0 END), " +
           "SUM(CASE WHEN LOWER(r.bookingType) NOT LIKE '%manual payment slip%' " +
           "         AND LOWER(r.bookingType) NOT LIKE '%online%' " +
           "         THEN r.creditAmt ELSE 0 END), " +
           "SUM(r.debitAmt), MAX(r.balance) " +
           "FROM FloatKotakGS r GROUP BY r.monthLabel ORDER BY r.monthLabel ASC")
    List<Object[]> findMonthSummary();

    /** Period summary by periodLabel */
    @Query("SELECT r.periodLabel, " +
           "SUM(CASE WHEN LOWER(r.bookingType) LIKE '%manual payment slip%' " +
           "         OR LOWER(r.bookingType) LIKE '%online%' " +
           "         THEN r.creditAmt ELSE 0 END), " +
           "SUM(CASE WHEN LOWER(r.bookingType) NOT LIKE '%manual payment slip%' " +
           "         AND LOWER(r.bookingType) NOT LIKE '%online%' " +
           "         THEN r.creditAmt ELSE 0 END), " +
           "SUM(r.debitAmt), MAX(r.balance) " +
           "FROM FloatKotakGS r GROUP BY r.periodLabel ORDER BY r.periodLabel ASC")
    List<Object[]> findPeriodSummary();

    /** Register rows for a specific month */
    List<FloatKotakGS> findByMonthLabelOrderByTransDateAsc(String monthLabel);
}
