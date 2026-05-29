package com.Finx24.float_register;

import com.Finx24.float_register.entity.*;
import com.Finx24.float_register.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Auto-inserts opening balance entries on first startup.
 *
 * LI:
 *   Go Digit LI  → 31-Mar-2025 → ₹10,13,063.36
 *   Kotak LI     → 31-Mar-2026 → -₹10,530.00 (negative)
 *
 * MI_GS:
 *   Go Digit GS  → 31-Mar-2025 → ₹14,56,623.00
 *   United GS    → 31-Mar-2025 → ₹28,077.00
 *
 * MI_INSURE24:
 *   Go Digit I24 → 31-Mar-2025 → ₹0.00
 *
 * MI_DO:
 *   Go Digit DO  → 31-Mar-2025 → ₹0.00
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FloatDataInitializer implements ApplicationRunner {

    private final FloatGoDigitLIRepository  goDigitLiRepo;
    private final FloatKotakLIRepository    kotakLiRepo;
    private final FloatGoDigitGSRepository  goDigitGsRepo;
    private final FloatGoDigitI24Repository goDigitI24Repo;
    private final FloatGoDigitDORepository  goDigitDoRepo;
    private final FloatUnitedRepository     unitedRepo;

    @Override
    public void run(ApplicationArguments args) {
        // LI
        if (goDigitLiRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            FloatGoDigitLI e = new FloatGoDigitLI();
            fill(e, "Mar'25", LocalDate.of(2025,3,31), new BigDecimal("1013063.36"));
            goDigitLiRepo.save(e);
            log.info("[Float Init] Go Digit LI opening: ₹1,013,063.36 as on 31-Mar-2025");
        }
        if (kotakLiRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            FloatKotakLI e = new FloatKotakLI();
            fill(e, "Mar'26", LocalDate.of(2026,3,31), new BigDecimal("-10530.00"));
            kotakLiRepo.save(e);
            log.info("[Float Init] Kotak LI opening: -₹10,530 as on 31-Mar-2026");
        }
        // MI_GS
        if (goDigitGsRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            FloatGoDigitGS e = new FloatGoDigitGS();
            fill(e, "Mar'25", LocalDate.of(2025,3,31), new BigDecimal("1456623.00"));
            goDigitGsRepo.save(e);
            log.info("[Float Init] Go Digit GS opening: ₹14,56,623 as on 31-Mar-2025");
        }
        if (unitedRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            FloatUnited e = new FloatUnited();
            fill(e, "Mar'25", LocalDate.of(2025,3,31), new BigDecimal("28077.00"));
            unitedRepo.save(e);
            log.info("[Float Init] United GS opening: ₹28,077 as on 31-Mar-2025");
        }
        // MI_INSURE24
        if (goDigitI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            FloatGoDigitI24 e = new FloatGoDigitI24();
            fill(e, "Mar'25", LocalDate.of(2025,3,31), BigDecimal.ZERO);
            goDigitI24Repo.save(e);
            log.info("[Float Init] Go Digit INSURE24 opening: ₹0 as on 31-Mar-2025");
        }
        // MI_DO
        if (goDigitDoRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            FloatGoDigitDO e = new FloatGoDigitDO();
            fill(e, "Mar'25", LocalDate.of(2025,3,31), BigDecimal.ZERO);
            goDigitDoRepo.save(e);
            log.info("[Float Init] Go Digit DO opening: ₹0 as on 31-Mar-2025");
        }
    }

    private void fill(FloatRecord e, String monthLbl, LocalDate date, BigDecimal bal) {
        e.setMonthLabel(monthLbl);
        e.setPeriodLabel("Opening Balance");
        e.setFloatType("OPENING_BALANCE");
        e.setTransDate(date);
        e.setBookingType("Opening Balance");
        e.setTransactionDetails("Opening balance as on " + date);
        e.setCreditAmt(BigDecimal.ZERO);
        e.setDebitAmt(BigDecimal.ZERO);
        e.setBalance(bal);
    }
}