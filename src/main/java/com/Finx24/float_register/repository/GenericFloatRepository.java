package com.Finx24.float_register.repository;

import com.Finx24.float_register.FloatRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;
import java.time.LocalDate;
import java.util.List;

@NoRepositoryBean
public interface GenericFloatRepository<T extends FloatRecord>
        extends JpaRepository<T, Long> {

    // ── Standard Spring Data methods (no @Query needed) ──────────
    List<T> findByMonthLabelOrderByTransDateAsc(String monthLabel);
    List<T> findByPeriodLabelOrderByTransDateAsc(String periodLabel);
    List<T> findAllByOrderByTransDateAsc();

    void deleteByMonthLabel(String monthLabel);
    void deleteByPeriodLabel(String periodLabel);

    // NOTE: findMonthSummary, findPeriodSummary, findAvailableMonths,
    // findAvailablePeriods, countByDateRange are declared in each
    // concrete repo with @Query — NOT here in the base interface.
    // Spring Data tries to parse method names as property queries
    // on the base interface, which fails for custom queries.
}