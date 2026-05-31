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
 * Opening Balances (auto-insert on first startup):
 *
 * As on Mar'25 (31-Mar-2025):
 *   Go Digit LI     → ₹10,13,063.36  (GL 8503595, Parent 13126064)
 *   Kotak LI        → -₹10,530.00    (GL 8503598, Parent 13126064) [as on Mar'26]
 *   TATA AIG GS     → ₹47,35,251     (GL 6000015)
 *   ICICI GS        → ₹36,14,011     (GL 6000005)
 *   Go Digit GS     → ₹14,56,622.87  (GL 6000000)
 *   Kotak GS        → ₹29,59,582     (GL 6000002)
 *   United GS       → ₹28,077        (GL 6000007)
 *   Go Digit I24    → ₹0             (GL 6000030)
 *   Kotak I24       → ₹0             (GL 6000032)
 *   ICICI I24       → ₹0             (GL 6000038)
 *   Tata I24        → ₹0             (GL 6000031)
 *   Bajaj I24       → ₹0             (GL 6000037)
 *   Go Digit DO     → ₹0             (GL 6000040)
 *   Bajaj EW        → ₹1,37,553      (GL 6000009) [as on Apr'26]
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FloatDataInitializer implements ApplicationRunner {

    private final FloatGoDigitLIRepository  goDigitLiRepo;
    private final FloatKotakLIRepository    kotakLiRepo;
    private final FloatTataAIGRepository    tataAigRepo;
    private final FloatIciciGSRepository    iciciGsRepo;
    private final FloatGoDigitGSRepository  goDigitGsRepo;
    private final FloatKotakGSRepository    kotakGsRepo;
    private final FloatUnitedRepository     unitedRepo;
    private final FloatGoDigitI24Repository goDigitI24Repo;
    private final FloatKotakI24Repository   kotakI24Repo;
    private final FloatIciciI24Repository   iciciI24Repo;
    private final FloatTataI24Repository    tataI24Repo;
    private final FloatBajajI24Repository   bajajI24Repo;
    private final FloatGoDigitDORepository  goDigitDoRepo;
    private final FloatBajajEWRepository    bajajEwRepo;

    private static final LocalDate MAR25 = LocalDate.of(2025, 3, 31);
    private static final LocalDate MAR26 = LocalDate.of(2026, 3, 31);
    private static final LocalDate APR26 = LocalDate.of(2026, 4, 30);

    @Override
    public void run(ApplicationArguments args) {
        // ── LI ────────────────────────────────────────────────
        if (goDigitLiRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            goDigitLiRepo.save(build(new FloatGoDigitLI(), "Mar'25", MAR25, new BigDecimal("1013063.36")));
            log.info("[Init] Go Digit LI: ₹10,13,063.36");
        }
        if (kotakLiRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            kotakLiRepo.save(build(new FloatKotakLI(), "Mar'26", MAR26, new BigDecimal("-10530.00")));
            log.info("[Init] Kotak LI: -₹10,530");
        }
        // ── MI_GS ─────────────────────────────────────────────
        if (tataAigRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            tataAigRepo.save(build(new FloatTataAIG(), "Mar'25", MAR25, new BigDecimal("4735251")));
            log.info("[Init] TATA AIG GS: ₹47,35,251");
        }
        if (iciciGsRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            iciciGsRepo.save(build(new FloatIciciGS(), "Mar'25", MAR25, new BigDecimal("3614011")));
            log.info("[Init] ICICI GS: ₹36,14,011");
        }
        if (goDigitGsRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            goDigitGsRepo.save(build(new FloatGoDigitGS(), "Mar'25", MAR25, new BigDecimal("1456622.87")));
            log.info("[Init] Go Digit GS: ₹14,56,622.87");
        }
        {
            var kotakGsOb = kotakGsRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
            FloatKotakGS kg = kotakGsOb.isEmpty() ? new FloatKotakGS() : kotakGsOb.get(0);
            build(kg, "Mar'25", MAR25, new BigDecimal("2942016.00"));
            kotakGsRepo.save(kg);
            log.info("[Init] Kotak GS opening upserted: ₹29,42,016");
        }
        if (unitedRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            unitedRepo.save(build(new FloatUnited(), "Mar'25", MAR25, new BigDecimal("28077")));
            log.info("[Init] United GS: ₹28,077");
        }
        // ── MI_INSURE24 ───────────────────────────────────────
        if (goDigitI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            goDigitI24Repo.save(build(new FloatGoDigitI24(), "Mar'25", MAR25, BigDecimal.ZERO));
            log.info("[Init] Go Digit INSURE24: ₹0");
        }
        if (kotakI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            kotakI24Repo.save(build(new FloatKotakI24(), "Mar'25", MAR25, BigDecimal.ZERO));
            log.info("[Init] Kotak INSURE24: ₹0");
        }
        if (iciciI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            iciciI24Repo.save(build(new FloatIciciI24(), "Mar'25", MAR25, BigDecimal.ZERO));
            log.info("[Init] ICICI INSURE24: ₹0");
        }
        if (tataI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            tataI24Repo.save(build(new FloatTataI24(), "Mar'25", MAR25, BigDecimal.ZERO));
            log.info("[Init] Tata INSURE24: ₹0");
        }
        if (bajajI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            // Mar'25 opening = 0
            bajajI24Repo.save(build(new FloatBajajI24(), "Mar'25", MAR25, BigDecimal.ZERO));
            log.info("[Init] Bajaj INSURE24: Opening ₹0 as on Mar'25");
        }
        // Mar'26 closing balance = ₹2,48,332 — used as reference for Apr'26 opening
        if (bajajI24Repo.findByPeriodLabelOrderByTransDateAsc("Closing Balance Mar26").isEmpty()) {
            FloatBajajI24 mar26Close = new FloatBajajI24();
            mar26Close.setMonthLabel("Mar'26");
            mar26Close.setPeriodLabel("Closing Balance Mar26");
            mar26Close.setFloatType("CLOSING_BALANCE");
            mar26Close.setTransDate(MAR26);
            mar26Close.setBookingType("Closing Balance");
            mar26Close.setTransactionDetails("Closing balance as on 31-Mar-2026");
            mar26Close.setCreditAmt(BigDecimal.ZERO);
            mar26Close.setDebitAmt(BigDecimal.ZERO);
            mar26Close.setBalance(new BigDecimal("248332"));
            bajajI24Repo.save(mar26Close);
            log.info("[Init] Bajaj INSURE24: Closing ₹2,48,332 as on 31-Mar-2026 (ref for Apr'26 opening)");
        }
        // ── MI_DO ─────────────────────────────────────────────
        if (goDigitDoRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            goDigitDoRepo.save(build(new FloatGoDigitDO(), "Mar'25", MAR25, BigDecimal.ZERO));
            log.info("[Init] Go Digit DO: ₹0");
        }
        // ── EW ────────────────────────────────────────────────
        if (bajajEwRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance").isEmpty()) {
            bajajEwRepo.save(build(new FloatBajajEW(), "Apr'26", APR26, new BigDecimal("137553")));
            log.info("[Init] Bajaj EW: ₹1,37,553 as on Apr'26");
        }
    }

    private <T extends FloatRecord> T build(T e, String monthLbl,
                                            LocalDate date, BigDecimal bal) {
        e.setMonthLabel(monthLbl);
        e.setPeriodLabel("Opening Balance");
        e.setFloatType("OPENING_BALANCE");
        e.setTransDate(date);
        e.setBookingType("Opening Balance");
        e.setTransactionDetails("Opening balance as on " + date);
        e.setCreditAmt(BigDecimal.ZERO);
        e.setDebitAmt(BigDecimal.ZERO);
        e.setBalance(bal);
        return e;
    }
}