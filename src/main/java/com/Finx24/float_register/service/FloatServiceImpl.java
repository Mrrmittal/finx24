package com.Finx24.float_register.service;

import com.Finx24.float_register.FloatConstants;
import com.Finx24.float_register.FloatRecord;
import com.Finx24.float_register.entity.*;
import com.Finx24.float_register.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.function.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FloatServiceImpl implements FloatService {

    private final FloatGoDigitLIRepository  goDigitLiRepo;
    private final FloatKotakLIRepository    kotakLiRepo;
    private final FloatTataAIGRepository    tataAigRepo;
    private final FloatIciciGSRepository    iciciGsRepo;
    private final FloatUnitedRepository     unitedRepo;
    private final FloatGoDigitGSRepository  goDigitGsRepo;
    private final FloatKotakGSRepository    kotakGsRepo;
    private final FloatGoDigitI24Repository goDigitI24Repo;
    private final FloatKotakI24Repository   kotakI24Repo;
    private final FloatTataI24Repository    tataI24Repo;
    private final FloatIciciI24Repository   iciciI24Repo;
    private final FloatBajajI24Repository   bajajI24Repo;
    private final FloatGoDigitDORepository  goDigitDoRepo;
    private final FloatBajajEWRepository    bajajEwRepo;

    // Month label formatter: "Apr'25"
    private static final DateTimeFormatter MONTH_FMT =
        DateTimeFormatter.ofPattern("MMM''yy", java.util.Locale.ENGLISH);

    // ── PR Register column config: {policyCol, loanIdCol, isIcici, cleanReg} ──
    // United_MI_GS excluded — float data already carries reg no
    private static final Map<String, String[]> PR_CFG = Map.ofEntries(
        Map.entry("Go_Digit_LI",             new String[]{"POLICY_NUMBER",   "BOOKINGID_PLANID",       "false","false"}),
        Map.entry("Kotak_LI",                new String[]{"POLICY_NUMBER",   "BOOKINGID_PLANID",       "false","false"}),
        Map.entry("Go_Digit_MI_GS",          new String[]{"POLICY_NUMBER",   "VEH_REG_NO",             "false","false"}),
        Map.entry("ICICI_Lombard_MI_GS",     new String[]{"POL_NUM_TXT",     "MOTOR_REGISTRATION_NUM", "true", "false"}),
        Map.entry("Tata_AIG_MI_GS",          new String[]{"policy_no",       "registration_no",        "false","false"}),
        Map.entry("Kotak_MI_GS",             new String[]{"POLICY NO",       "Registration Number",    "false","true" }),
        Map.entry("Go_Digit_INSURE24",       new String[]{"POLICY_NUMBER",   "VEH_REG_NO",             "false","false"}),
        Map.entry("Kotak_INSURE24",          new String[]{"POLICY NO",       "Registration Number",    "false","true" }),
        Map.entry("Tata_INSURE24",           new String[]{"policy_no",       "registration_no",        "false","false"}),
        Map.entry("ICICI_Lombard_INSURE24",  new String[]{"POL_NUM_TXT",     "MOTOR_REGISTRATION_NUM", "true", "false"}),
        Map.entry("Bajaj_INSURE24",          new String[]{"Policy Number",   "Registration Number",    "false","false"}),
        Map.entry("Go_Digit_DO",             new String[]{"POLICY_NUMBER",   "VEH_REG_NO",             "false","false"}),
        Map.entry("Bajaj_EW",                new String[]{"Policy Number",   "Registration Number",    "false","false"})
    );

    // ================================================================
    //  UPLOAD
    // ================================================================
    @Override
    @Transactional
    public Map<String, Object> upload(MultipartFile file, String partnerCode,
                                       String periodLabel, boolean allowOverwrite)
            throws IOException {

        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);

            Row hdr = findHeaderRow(sheet);
            if (hdr == null) throw new IllegalArgumentException(
                "Header row not found. Expected FLOAT_TYPE or TRANS_DATE column.");

            Map<String, Integer> ci = buildColMap(hdr);
            ColMap cm = resolveColumns(ci);

            List<RowData> dataRows = parseRows(sheet, hdr, cm, periodLabel);
            if (dataRows.isEmpty()) {
                return Map.of("partnerCode", partnerCode, "inserted", 0, "message", "No data rows found");
            }

            LocalDate minDate = dataRows.stream().filter(r -> r.transDate != null)
                .map(r -> r.transDate).min(Comparator.naturalOrder()).orElse(null);
            LocalDate maxDate = dataRows.stream().filter(r -> r.transDate != null)
                .map(r -> r.transDate).max(Comparator.naturalOrder()).orElse(null);

            long existingCount = countByPeriodLabel(partnerCode, periodLabel);
            if (existingCount > 0 && !allowOverwrite) {
                throw new IllegalStateException(
                    "Data already exists for period '" + periodLabel +
                    "' (" + existingCount + " rows). Use overwrite=true to replace.");
            }
            if (existingCount > 0) {
                deleteByPartnerPeriod(partnerCode, periodLabel);
                log.info("[Float] Deleted {} existing rows for {} / {}", existingCount, partnerCode, periodLabel);
            }

            int saved = dispatchSave(partnerCode, dataRows);
            log.info("[Float] Saved: partner={} period={} rows={} dates={} to {}",
                partnerCode, periodLabel, saved, minDate, maxDate);

            return Map.of(
                "partnerCode", partnerCode,
                "glAccount",   FloatConstants.getGl(partnerCode),
                "periodLabel", periodLabel,
                "inserted",    saved,
                "dateFrom",    minDate != null ? minDate.toString() : "",
                "dateTo",      maxDate != null ? maxDate.toString() : ""
            );
        }
    }

    // ================================================================
    //  SAVE OPENING BALANCE
    // ================================================================
    @Override
    @Transactional
    public Map<String, Object> saveOpeningBalance(String partnerCode,
                                                   LocalDate asOnDate,
                                                   BigDecimal amount) {
        // Opening balance row
        String monthLbl  = asOnDate.format(MONTH_FMT);
        String periodLbl = "Opening Balance";

        RowData openRow = new RowData();
        openRow.transDate           = asOnDate;
        openRow.monthLabel          = monthLbl;
        openRow.periodLabel         = periodLbl;
        openRow.floatType           = "OPENING_BALANCE";
        openRow.bookingType         = "Opening Balance";
        openRow.transactionDetails  = "As on " + asOnDate;
        openRow.creditAmt           = BigDecimal.ZERO;
        openRow.debitAmt            = BigDecimal.ZERO;
        openRow.balance             = amount;

        dispatchSave(partnerCode, List.of(openRow));
        log.info("[Float] Opening balance saved: partner={} asOn={} amount={}",
            partnerCode, asOnDate, amount);
        return Map.of("partnerCode", partnerCode, "asOnDate", asOnDate, "amount", amount);
    }

    // ================================================================
    //  PARSE ROWS from sheet
    // ================================================================
    private List<RowData> parseRows(Sheet sheet, Row hdr, ColMap cm, String periodLabel) {
        List<RowData> result = new ArrayList<>();
        double runningBalance = 0.0;  // For Bajaj — no balance column
        boolean hasBalanceCol = cm.balanceIdx >= 0;

        for (int r = hdr.getRowNum() + 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;

            // Need at least a TRANS_DATE to be valid
            LocalDate transDate = cm.transDateIdx >= 0
                ? parseDate(cellStr(row.getCell(cm.transDateIdx))) : null;
            if (transDate == null) continue;

            double credit  = cm.creditIdx  >= 0 ? numCell(row.getCell(cm.creditIdx))  : 0;
            double debit   = cm.debitIdx   >= 0 ? numCell(row.getCell(cm.debitIdx))   : 0;
            double balance;
            if (hasBalanceCol) {
                balance = numCell(row.getCell(cm.balanceIdx));
            } else {
                // Bajaj GS/EW: no balance column — compute running balance
                runningBalance += credit - debit;
                balance = runningBalance;
            }
            String bt = cm.bookingTypeIdx >= 0 ? cellStr(row.getCell(cm.bookingTypeIdx)) : "";

            RowData rd = new RowData();
            rd.transDate           = transDate;
            rd.monthLabel          = transDate.format(MONTH_FMT);  // Auto from TRANS_DATE
            rd.periodLabel         = periodLabel;
            // floatType: FLOAT_TYPE / Months column value
            // Note: Kotak top-up now detected via bookingType (Transaction Type column)
            //       not Receipt Status, so we just store the FLOAT_TYPE value
            rd.floatType = cm.floatTypeIdx >= 0 ? cellStr(row.getCell(cm.floatTypeIdx)) : "";
            rd.accountManager      = cm.acctMgrIdx  >= 0 ? cellStr(row.getCell(cm.acctMgrIdx))  : "";
            rd.imdCode             = cm.imdIdx       >= 0 ? cellStr(row.getCell(cm.imdIdx))      : "";
            rd.bookingType         = bt;
            rd.transactionDetails  = cm.detailsIdx  >= 0 ? cellStr(row.getCell(cm.detailsIdx))  : "";
            rd.creditAmt           = bd(credit);
            rd.debitAmt            = bd(debit);
            rd.balance             = bd(balance);
            rd.policyNumber        = cm.policyIdx   >= 0 ? cellStr(row.getCell(cm.policyIdx))   : "";
            rd.loanId              = cm.loanIdIdx   >= 0 ? cellStr(row.getCell(cm.loanIdIdx))   : "";
            result.add(rd);
        }
        return result;
    }

    // ================================================================
    //  DISPATCH SAVE
    // ================================================================
    private int dispatchSave(String partnerCode, List<RowData> rows) {
        return switch (partnerCode) {
            case "Go_Digit_LI"            -> doSave(rows, FloatGoDigitLI::new,    goDigitLiRepo::saveAll);
            case "Kotak_LI"               -> doSave(rows, FloatKotakLI::new,      kotakLiRepo::saveAll);
            case "Tata_AIG_MI_GS"         -> doSave(rows, FloatTataAIG::new,      tataAigRepo::saveAll);
            case "ICICI_Lombard_MI_GS"    -> doSave(rows, FloatIciciGS::new,      iciciGsRepo::saveAll);
            case "United_MI_GS"           -> doSave(rows, FloatUnited::new,       unitedRepo::saveAll);
            case "Go_Digit_MI_GS"         -> doSave(rows, FloatGoDigitGS::new,    goDigitGsRepo::saveAll);
            case "Kotak_MI_GS"            -> doSave(rows, FloatKotakGS::new,      kotakGsRepo::saveAll);
            case "Go_Digit_INSURE24"      -> doSave(rows, FloatGoDigitI24::new,   goDigitI24Repo::saveAll);
            case "Kotak_INSURE24"         -> doSave(rows, FloatKotakI24::new,     kotakI24Repo::saveAll);
            case "Tata_INSURE24"          -> doSave(rows, FloatTataI24::new,      tataI24Repo::saveAll);
            case "ICICI_Lombard_INSURE24" -> doSave(rows, FloatIciciI24::new,     iciciI24Repo::saveAll);
            case "Bajaj_INSURE24"         -> doSave(rows, FloatBajajI24::new,     bajajI24Repo::saveAll);
            case "Go_Digit_DO"            -> doSave(rows, FloatGoDigitDO::new,    goDigitDoRepo::saveAll);
            case "Bajaj_EW"               -> doSave(rows, FloatBajajEW::new,      bajajEwRepo::saveAll);
            default -> { log.warn("[Float] Unknown partner: {}", partnerCode); yield 0; }
        };
    }

    private <T extends FloatRecord> int doSave(List<RowData> rows,
            Supplier<T> factory, Consumer<List<T>> saveAll) {
        List<T> entities = new ArrayList<>();
        for (RowData rd : rows) {
            T e = factory.get();
            e.setMonthLabel(rd.monthLabel);
            e.setPeriodLabel(rd.periodLabel);
            e.setTransDate(rd.transDate);
            e.setFloatType(rd.floatType);
            e.setAccountManager(rd.accountManager);
            e.setImdCode(rd.imdCode);
            e.setBookingType(rd.bookingType);
            e.setTransactionDetails(rd.transactionDetails);
            e.setCreditAmt(rd.creditAmt);
            e.setDebitAmt(rd.debitAmt);
            e.setBalance(rd.balance);
            e.setPolicyNumber(rd.policyNumber);
            e.setLoanId(rd.loanId);
            entities.add(e);
        }
        if (!entities.isEmpty()) saveAll.accept(entities);
        return entities.size();
    }


    private long countByPeriodLabel(String partnerCode, String periodLabel) {
        return switch (partnerCode) {
            case "Go_Digit_LI"            -> goDigitLiRepo.countByPeriodLabel(periodLabel);
            case "Kotak_LI"               -> kotakLiRepo.countByPeriodLabel(periodLabel);
            case "Tata_AIG_MI_GS"         -> tataAigRepo.countByPeriodLabel(periodLabel);
            case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.countByPeriodLabel(periodLabel);
            case "United_MI_GS"           -> unitedRepo.countByPeriodLabel(periodLabel);
            case "Go_Digit_MI_GS"         -> goDigitGsRepo.countByPeriodLabel(periodLabel);
            case "Kotak_MI_GS"            -> kotakGsRepo.countByPeriodLabel(periodLabel);
            case "Go_Digit_INSURE24"      -> goDigitI24Repo.countByPeriodLabel(periodLabel);
            case "Kotak_INSURE24"         -> kotakI24Repo.countByPeriodLabel(periodLabel);
            case "Tata_INSURE24"          -> tataI24Repo.countByPeriodLabel(periodLabel);
            case "ICICI_Lombard_INSURE24" -> iciciI24Repo.countByPeriodLabel(periodLabel);
            case "Bajaj_INSURE24"         -> bajajI24Repo.countByPeriodLabel(periodLabel);
            case "Go_Digit_DO"            -> goDigitDoRepo.countByPeriodLabel(periodLabel);
            case "Bajaj_EW"               -> bajajEwRepo.countByPeriodLabel(periodLabel);
            default -> 0L;
        };
    }

    @Transactional
    protected void deleteByPartnerPeriod(String partnerCode, String periodLabel) {
        switch (partnerCode) {
            case "Go_Digit_LI"            -> goDigitLiRepo.deleteByPeriodLabel(periodLabel);
            case "Kotak_LI"               -> kotakLiRepo.deleteByPeriodLabel(periodLabel);
            case "Tata_AIG_MI_GS"         -> tataAigRepo.deleteByPeriodLabel(periodLabel);
            case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.deleteByPeriodLabel(periodLabel);
            case "United_MI_GS"           -> unitedRepo.deleteByPeriodLabel(periodLabel);
            case "Go_Digit_MI_GS"         -> goDigitGsRepo.deleteByPeriodLabel(periodLabel);
            case "Kotak_MI_GS"            -> kotakGsRepo.deleteByPeriodLabel(periodLabel);
            case "Go_Digit_INSURE24"      -> goDigitI24Repo.deleteByPeriodLabel(periodLabel);
            case "Kotak_INSURE24"         -> kotakI24Repo.deleteByPeriodLabel(periodLabel);
            case "Tata_INSURE24"          -> tataI24Repo.deleteByPeriodLabel(periodLabel);
            case "ICICI_Lombard_INSURE24" -> iciciI24Repo.deleteByPeriodLabel(periodLabel);
            case "Bajaj_INSURE24"         -> bajajI24Repo.deleteByPeriodLabel(periodLabel);
            case "Go_Digit_DO"            -> goDigitDoRepo.deleteByPeriodLabel(periodLabel);
            case "Bajaj_EW"               -> bajajEwRepo.deleteByPeriodLabel(periodLabel);
        }
    }

    // ================================================================
    //  GET REGISTER
    // ================================================================
    @Override
    public List<Map<String, Object>> getRegister(String partnerCode,
                                                   String monthOrPeriod,
                                                   boolean byMonth) {
        List<? extends FloatRecord> records;
        if (monthOrPeriod == null || monthOrPeriod.isBlank()) {
            records = switch (partnerCode) {
                case "Go_Digit_LI"            -> goDigitLiRepo.findAllByOrderByTransDateAsc();
                case "Kotak_LI"               -> kotakLiRepo.findAllByOrderByTransDateAsc();
                case "Tata_AIG_MI_GS"         -> tataAigRepo.findAllByOrderByTransDateAsc();
                case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.findAllByOrderByTransDateAsc();
                case "United_MI_GS"           -> unitedRepo.findAllByOrderByTransDateAsc();
                case "Go_Digit_MI_GS"         -> goDigitGsRepo.findAllByOrderByTransDateAsc();
                case "Kotak_MI_GS"            -> kotakGsRepo.findAllByOrderByTransDateAsc();
                case "Go_Digit_INSURE24"      -> goDigitI24Repo.findAllByOrderByTransDateAsc();
                case "Kotak_INSURE24"         -> kotakI24Repo.findAllByOrderByTransDateAsc();
                case "Tata_INSURE24"          -> tataI24Repo.findAllByOrderByTransDateAsc();
                case "ICICI_Lombard_INSURE24" -> iciciI24Repo.findAllByOrderByTransDateAsc();
                case "Bajaj_INSURE24"         -> bajajI24Repo.findAllByOrderByTransDateAsc();
                case "Go_Digit_DO"            -> goDigitDoRepo.findAllByOrderByTransDateAsc();
                case "Bajaj_EW"               -> bajajEwRepo.findAllByOrderByTransDateAsc();
                default -> List.of();
            };
        } else if (byMonth) {
            records = switch (partnerCode) {
                case "Go_Digit_LI"            -> goDigitLiRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Kotak_LI"               -> kotakLiRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Tata_AIG_MI_GS"         -> tataAigRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "United_MI_GS"           -> unitedRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Go_Digit_MI_GS"         -> goDigitGsRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Kotak_MI_GS"            -> kotakGsRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Go_Digit_INSURE24"      -> goDigitI24Repo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Kotak_INSURE24"         -> kotakI24Repo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Tata_INSURE24"          -> tataI24Repo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "ICICI_Lombard_INSURE24" -> iciciI24Repo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Bajaj_INSURE24"         -> bajajI24Repo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Go_Digit_DO"            -> goDigitDoRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                case "Bajaj_EW"               -> bajajEwRepo.findByMonthLabelOrderByTransDateAsc(monthOrPeriod);
                default -> List.of();
            };
        } else {
            records = switch (partnerCode) {
                case "Go_Digit_LI"            -> goDigitLiRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Kotak_LI"               -> kotakLiRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Tata_AIG_MI_GS"         -> tataAigRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "United_MI_GS"           -> unitedRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Go_Digit_MI_GS"         -> goDigitGsRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Kotak_MI_GS"            -> kotakGsRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Go_Digit_INSURE24"      -> goDigitI24Repo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Kotak_INSURE24"         -> kotakI24Repo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Tata_INSURE24"          -> tataI24Repo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "ICICI_Lombard_INSURE24" -> iciciI24Repo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Bajaj_INSURE24"         -> bajajI24Repo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Go_Digit_DO"            -> goDigitDoRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                case "Bajaj_EW"               -> bajajEwRepo.findByPeriodLabelOrderByTransDateAsc(monthOrPeriod);
                default -> List.of();
            };
        }
        return toRowList(records);
    }

    // ================================================================
    //  AVAILABLE MONTHS / PERIODS
    // ================================================================
    @Override
    public List<String> getAvailableMonths(String partnerCode) {
        return switch (partnerCode) {
            case "Go_Digit_LI"            -> goDigitLiRepo.findAvailableMonths();
            case "Kotak_LI"               -> kotakLiRepo.findAvailableMonths();
            case "Tata_AIG_MI_GS"         -> tataAigRepo.findAvailableMonths();
            case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.findAvailableMonths();
            case "United_MI_GS"           -> unitedRepo.findAvailableMonths();
            case "Go_Digit_MI_GS"         -> goDigitGsRepo.findAvailableMonths();
            case "Kotak_MI_GS"            -> kotakGsRepo.findAvailableMonths();
            case "Go_Digit_INSURE24"      -> goDigitI24Repo.findAvailableMonths();
            case "Kotak_INSURE24"         -> kotakI24Repo.findAvailableMonths();
            case "Tata_INSURE24"          -> tataI24Repo.findAvailableMonths();
            case "ICICI_Lombard_INSURE24" -> iciciI24Repo.findAvailableMonths();
            case "Bajaj_INSURE24"         -> bajajI24Repo.findAvailableMonths();
            case "Go_Digit_DO"            -> goDigitDoRepo.findAvailableMonths();
            case "Bajaj_EW"               -> bajajEwRepo.findAvailableMonths();
            default -> List.of();
        };
    }

    @Override
    public List<String> getAvailablePeriods(String partnerCode) {
        return switch (partnerCode) {
            case "Go_Digit_LI"            -> goDigitLiRepo.findAvailablePeriods();
            case "Kotak_LI"               -> kotakLiRepo.findAvailablePeriods();
            default -> List.of();
        };
    }

    // ================================================================
    //  DASHBOARD
    // ================================================================
    /**
     * Returns the most recent reference balance (Opening or Closing Balance row).
     * For Bajaj I24: Mar'26 closing = 248332 is used as base for Apr'26 onwards.
     */
    private java.math.BigDecimal getOpeningBalance(String partnerCode) {
        try {
            // Try "Closing Balance Mar26" first (more recent reference), fallback to "Opening Balance"
            java.util.List<? extends FloatRecord> refRows = switch (partnerCode) {
                case "Go_Digit_LI"            -> goDigitLiRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Kotak_LI"               -> kotakLiRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Tata_AIG_MI_GS"         -> tataAigRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "United_MI_GS"           -> unitedRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Go_Digit_MI_GS"         -> goDigitGsRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Kotak_MI_GS"            -> kotakGsRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Go_Digit_INSURE24"      -> goDigitI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Kotak_INSURE24"         -> kotakI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Tata_INSURE24"          -> tataI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "ICICI_Lombard_INSURE24" -> iciciI24Repo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Bajaj_INSURE24"         -> bajajI24Repo.findByPeriodLabelOrderByTransDateAsc("Closing Balance Mar26");
                case "Go_Digit_DO"            -> goDigitDoRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                case "Bajaj_EW"               -> bajajEwRepo.findByPeriodLabelOrderByTransDateAsc("Opening Balance");
                default -> java.util.List.of();
            };
            FloatRecord row = firstOrNull(refRows);
            return (row != null && row.getBalance() != null)
                ? row.getBalance()
                : java.math.BigDecimal.ZERO;
        } catch (Exception e) {
            log.warn("[Float] getOpeningBalance error: {}", e.getMessage());
            return java.math.BigDecimal.ZERO;
        }
    }

    private <T extends FloatRecord> FloatRecord firstOrNull(List<T> list) {
        return (list != null && !list.isEmpty()) ? list.get(0) : null;
    }

    @Override
    public Map<String, Object> getDashboard(String partnerCode, String filter) {
        // filter ignored — always return all months, frontend filters by period
        List<Object[]> rows = switch (partnerCode) {
            case "Go_Digit_LI"            -> goDigitLiRepo.findMonthSummary();
            case "Kotak_LI"               -> kotakLiRepo.findMonthSummary();
            case "Tata_AIG_MI_GS"         -> tataAigRepo.findMonthSummary();
            case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.findMonthSummary();
            case "United_MI_GS"           -> unitedRepo.findMonthSummary();
            case "Go_Digit_MI_GS"         -> goDigitGsRepo.findMonthSummary();
            case "Kotak_MI_GS"            -> kotakGsRepo.findMonthSummary();
            case "Go_Digit_INSURE24"      -> goDigitI24Repo.findMonthSummary();
            case "Kotak_INSURE24"         -> kotakI24Repo.findMonthSummary();
            case "Tata_INSURE24"          -> tataI24Repo.findMonthSummary();
            case "ICICI_Lombard_INSURE24" -> iciciI24Repo.findMonthSummary();
            case "Bajaj_INSURE24"         -> bajajI24Repo.findMonthSummary();
            case "Go_Digit_DO"            -> goDigitDoRepo.findMonthSummary();
            case "Bajaj_EW"               -> bajajEwRepo.findMonthSummary();
            default -> List.of();
        };

        // cols: [0]=monthLabel [1]=topUpCredit [2]=cancelCredit [3]=totalDebit [4]=closingBal
        List<Map<String,Object>> summary = new ArrayList<>();
        for (Object[] r : rows) {
            Map<String,Object> m = new LinkedHashMap<>();
            m.put("monthLabel",   r[0]);
            m.put("topUpCredit",  r[1]);
            m.put("cancelCredit", r[2]);
            m.put("totalDebit",   r[3]);
            double debit  = r[3] != null ? ((Number)r[3]).doubleValue() : 0;
            double cancel = r[2] != null ? ((Number)r[2]).doubleValue() : 0;
            m.put("expense",      debit - cancel);
            m.put("closingBal",   r[4]);
            summary.add(m);
        }
        // Fetch the DB opening balance (the dedicated "Opening Balance" period row)
        java.math.BigDecimal dbOpening = getOpeningBalance(partnerCode);

        return Map.of(
            "partnerCode",           partnerCode,
            "glAccount",             FloatConstants.getGl(partnerCode),
            "parentGl",              FloatConstants.getParentGl(
                                         FloatConstants.CATEGORY.getOrDefault(partnerCode, "MI")),
            "initialOpeningBalance", dbOpening,   // DB opening balance (before first transaction)
            "summary",               summary
        );
    }

    // ================================================================
    //  UPLOAD MASTER
    // ================================================================
    @Override
    @Transactional
    public Map<String, Object> uploadMaster(MultipartFile file,
                                             String periodLabel,
                                             boolean allowOverwrite) throws IOException {
        Workbook wb = WorkbookFactory.create(file.getInputStream());
        Map<String,Integer> results = new LinkedHashMap<>();
        int total = 0;
        for (Map.Entry<String,String> e : FloatConstants.SHEET_TO_PARTNER.entrySet()) {
            Sheet sheet = wb.getSheet(e.getKey());
            if (sheet == null) continue;
            String partnerCode = e.getValue();
            try {
                Row hdr = findHeaderRow(sheet);
                if (hdr == null) { log.warn("[Float Master] No header: {}", e.getKey()); continue; }
                Map<String,Integer> ci = buildColMap(hdr);
                ColMap cm = resolveColumns(ci);
                List<RowData> rows = parseRows(sheet, hdr, cm, periodLabel);
                if (!rows.isEmpty() && allowOverwrite) {
                    deleteByPartnerPeriod(partnerCode, periodLabel);
                }
                int saved = dispatchSave(partnerCode, rows);
                results.put(e.getKey(), saved);
                total += saved;
                log.info("[Float Master] {} → {} rows", e.getKey(), saved);
            } catch (Exception ex) {
                log.warn("[Float Master] Sheet={} error: {}", e.getKey(), ex.getMessage());
                results.put(e.getKey() + " [ERROR]", -1);
            }
        }
        wb.close();
        return Map.of("totalSaved", total, "bySheet", results);
    }

    // ================================================================
    //  COLUMN RESOLUTION
    // ================================================================
    private static class ColMap {
        int transDateIdx=-1, floatTypeIdx=-1, acctMgrIdx=-1, imdIdx=-1;
        int bookingTypeIdx=-1, detailsIdx=-1;
        int creditIdx=-1, debitIdx=-1, balanceIdx=-1;
        int policyIdx=-1, loanIdIdx=-1;
        int receiptStatusIdx=-1;  // Kotak: "Receipt Status" stored in floatType
    }

    /**
     * Universal column resolver — handles all 7 partner formats:
     *
     * Go Digit LI/GS/I24/DO : FLOAT_TYPE, TRANS_DATE, BOOKING_TYPE, CREDIT_AMT, DEBIT_AMT, BALANCE, Loan ID / Reg No
     * TATA AIG GS/I24        : Month, Trans Date, Trans_Type, Credit Amount, Debit Amount, Closing Balance, Reg No
     * Kotak GS/I24           : Month, Transaction Date, Transaction Type, Credit, Debit, Balance, Reg number
     * Bajaj GS/I24           : Month, C Trans Date, C Trans Desc, C Credit, C Debit (NO balance col)
     * Bajaj EW               : Month, Trans Date, C Trans Desc, C Credit, C Debit, Expenses (NO balance col)
     * ICICI GS/I24           : entereddate, transaction_type, credit, debit, closingbalance, Reg No (header row 2)
     * United GS              : Name Of Insured, Registration No., Business Type, Trans Date, Credit Amount, Closing
     */
    private ColMap resolveColumns(Map<String,Integer> ci) {
        ColMap cm = new ColMap();

        // ── Trans Date ───────────────────────────────────────────
        cm.transDateIdx = first(ci,
            "TRANS_DATE","Trans Date","Trans_DATE","Trans_Date",
            "Transaction Date","Trans_date",
            "C Trans Date",       // Bajaj GS/EW
            "entereddate",        // ICICI
            "TRANS DATE");

        // ── Float Type / Month label ─────────────────────────────
        cm.floatTypeIdx = first(ci,"FLOAT_TYPE","Months","Month");

        // ── Account Manager / Customer Name ─────────────────────
        cm.acctMgrIdx = first(ci,
            "ACCOUNT_MANAGER","AC HOLDER NAME","Customer Name",
            "C Customer Name",    // Bajaj
            "customername",       // ICICI
            "Name Of Insured",    // United
            "IntermName TaggedtoPolicy");

        // ── IMD / Producer Code ──────────────────────────────────
        cm.imdIdx = first(ci,
            "IMD_CODE","Producer Code","IMD CODE",
            "IntermCode TaggedtoPolicy",  // Kotak
            "code");                      // ICICI

        // ── Booking Type / Transaction Type ──────────────────────
        // TATA AIG: Trans_Type (new business, Negative Endorsement etc)
        // ICICI:    transaction_type ("---" = top up, "Policy Issuance" etc)
        // Go Digit: BOOKING_TYPE
        // Kotak:    Transaction Type
        // Bajaj:    C Trans Desc
        // United:   Business Type ("Credit" = top up)
        cm.bookingTypeIdx = first(ci,
            "BOOKING_TYPE",
            "Trans_Type",          // TATA AIG
            "transaction_type",    // ICICI ← "---" means top up
            "Transaction Type",    // Kotak
            "C Trans Desc",        // Bajaj
            "Business Type",       // United
            "Business_Type");

        // ── Transaction Details / Particulars ────────────────────
        // TATA AIG: "Mode of Payment" = "RTGS/NEFT" for top-up
        // ICICI: "particulars" = description
        cm.detailsIdx = first(ci,
            "TRANSACTION_DETAILS","PARTICULARS","particulars",
            "Mode of Payment",     // TATA AIG ← "RTGS/NEFT" = top up
            "Product Name",        // Kotak
            "applicationname");    // ICICI

        // ── Credit ───────────────────────────────────────────────
        cm.creditIdx = first(ci,
            "CREDIT_AMT","Credit Amount","Credit","CREDIT","credit",
            "C Credit",            // Bajaj
            "Credit Amount");

        // ── Debit ────────────────────────────────────────────────
        cm.debitIdx = first(ci,
            "DEBIT_AMT","Debit Amount","Debit","DEBIT","debit",
            "C Debit",             // Bajaj
            "Total Premium in Portal");

        // ── Balance (Closing) ────────────────────────────────────
        // Bajaj has NO balance col — will be computed via running balance
        cm.balanceIdx = first(ci,
            "BALANCE","Balance","Closing Balance","Closing",
            "CLOSING_BALANCE","closingbalance",  // ICICI
            "Closing");                           // United

        // ── Policy Number ────────────────────────────────────────
        cm.policyIdx = first(ci,
            "POLICY_NUMBER","Policy No","PolicyNumber","POLICY_NO",
            "Policy Number",       // TATA / United
            "C Policy Number",     // Bajaj
            "policyno_endno");     // ICICI

        // ── Reg No (MI) / Loan ID (LI) ──────────────────────────
        // LI uses "Loan ID", all MI partners use Reg Number
        cm.loanIdIdx = first(ci,
            "Reg No",              // Go Digit MI / ICICI / TATA AIG col 42
            "Reg number",          // Kotak
            "Reg Number",          // TATA AIG col 31
            "REG_NO","Reg. No.",
            "Registration No.","REGN_NO",
            "Loan ID","LOAN_ID","loan_id");  // LI only

        // ── Receipt Status (Kotak only → stored in floatType) ───
        cm.receiptStatusIdx = first(ci,"Receipt Status","RECEIPT_STATUS");

        // ── ICICI: use TRANS_DATE not entereddate for primary date ──
        // (entereddate is entry date, TRANS_DATE is actual transaction date)
        if (cm.transDateIdx < 0) {
            cm.transDateIdx = first(ci,"entereddate","ENTEREDDATE");
        }

        // ── Policy No — ensure numeric policies prioritized ────────
        // For MI: policyno_endno may include endorsement suffix, POLICY_NO is clean
        if (first(ci,"POLICY_NO") >= 0) {
            cm.policyIdx = first(ci,"POLICY_NO","policyno_endno","Policy No",
                "Policy Number","C Policy Number","PolicyNumber","POLICY_NUMBER");
        }

        return cm;
    }

    private int first(Map<String,Integer> ci, String... keys) {
        for (String k : keys)
            for (var e : ci.entrySet())
                if (e.getKey().trim().equalsIgnoreCase(k.trim())) return e.getValue();
        return -1;
    }

    private Row findHeaderRow(Sheet sheet) {
        Set<String> keywords = Set.of(
            "TRANS_DATE","Trans Date","Trans_Date","FLOAT_TYPE",
            "CREDIT_AMT","Credit Amount","Credit","C Credit",
            "BOOKING_TYPE","Trans_Type","transaction_type",
            "entereddate","Transaction Date","C Trans Date");
        for (int i = 0; i <= Math.min(12, sheet.getLastRowNum()); i++) {
            Row r = sheet.getRow(i); if (r == null) continue;
            for (Cell c : r)
                if (keywords.contains(cellStr(c).trim())) return r;
        }
        return null;
    }

    private Map<String,Integer> buildColMap(Row hdr) {
        Map<String,Integer> ci = new LinkedHashMap<>();
        for (Cell c : hdr) { String n=cellStr(c).trim(); if (!n.isEmpty()) ci.put(n,c.getColumnIndex()); }
        return ci;
    }

    // ── RowData holder ────────────────────────────────────────────
    private static class RowData {
        String monthLabel, periodLabel, floatType, accountManager, imdCode;
        String bookingType, transactionDetails, policyNumber, loanId;
        LocalDate transDate;
        BigDecimal creditAmt, debitAmt, balance;
    }

    // ── toRowList ─────────────────────────────────────────────────
    private List<Map<String,Object>> toRowList(List<? extends FloatRecord> records) {
        List<Map<String,Object>> result = new ArrayList<>();
        for (FloatRecord r : records) {
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("monthLabel",         r.getMonthLabel());
            row.put("periodLabel",        r.getPeriodLabel());
            row.put("transDate",          r.getTransDate());
            row.put("floatType",          r.getFloatType());
            row.put("bookingType",        r.getBookingType());
            row.put("transactionDetails", r.getTransactionDetails());
            row.put("creditAmt",          r.getCreditAmt());
            row.put("debitAmt",           r.getDebitAmt());
            row.put("balance",            r.getBalance());
            row.put("policyNumber",       r.getPolicyNumber());
            row.put("loanId",             r.getLoanId());
            result.add(row);
        }
        return result;
    }

    // ================================================================
    //  MAP LOAN ID / CAR REG NO FROM PR REGISTER
    // ================================================================
    @Override
    @Transactional
    public Map<String, Object> mapLoanId(MultipartFile file, String partnerCode,
                                          String monthLabel) throws IOException {
        String[] cfg = PR_CFG.get(partnerCode);
        if (cfg == null) throw new IllegalArgumentException(
            "No PR Register config for partner: " + partnerCode +
            " (United_MI_GS is excluded — reg no is already in float data)");

        String policyColName = cfg[0];
        String loanIdColName = cfg[1];
        boolean isIcici      = Boolean.parseBoolean(cfg[2]);
        boolean cleanReg     = Boolean.parseBoolean(cfg[3]);

        Map<String, String> policyMap = parsePrRegister(
            file, policyColName, loanIdColName, isIcici, cleanReg);

        if (policyMap.isEmpty()) {
            return Map.of("partnerCode", partnerCode, "prRows", 0,
                          "floatRows", 0, "mapped", 0, "notFound", 0,
                          "message", "No policy entries found. Check PR Register columns: "
                              + policyColName + " → " + loanIdColName);
        }

        int[] result = applyLoanIdMapping(partnerCode, monthLabel, policyMap, isIcici);
        int mapped = result[0], total = result[1];

        log.info("[Float] LoanID mapping: partner={} month={} prRows={} floatRows={} mapped={}",
            partnerCode, monthLabel, policyMap.size(), total, mapped);

        return Map.of(
            "partnerCode", partnerCode,
            "prRows",      policyMap.size(),
            "floatRows",   total,
            "mapped",      mapped,
            "notFound",    total - mapped
        );
    }

    private Map<String, String> parsePrRegister(MultipartFile file,
            String policyColName, String loanIdColName,
            boolean isIcici, boolean cleanReg) throws IOException {
        Map<String, String> result = new LinkedHashMap<>();
        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            for (int si = 0; si < wb.getNumberOfSheets(); si++) {
                Sheet sheet = wb.getSheetAt(si);
                Row hdr = findPrHeaderRow(sheet, policyColName, loanIdColName);
                if (hdr == null) continue;
                Map<String, Integer> ci = buildColMap(hdr);
                int polIdx  = first(ci, policyColName);
                int lidIdx  = first(ci, loanIdColName);
                if (polIdx < 0 || lidIdx < 0) continue;
                for (int r = hdr.getRowNum() + 1; r <= sheet.getLastRowNum(); r++) {
                    Row row = sheet.getRow(r);
                    if (row == null) continue;
                    String pol   = cellStr(row.getCell(polIdx)).trim();
                    String loanId = cellStr(row.getCell(lidIdx)).trim();
                    if (pol.isEmpty() || loanId.isEmpty()) continue;
                    String key = normalizePolicyKey(pol, isIcici);
                    if (key.isEmpty()) continue;
                    if (cleanReg) loanId = cleanRegNo(loanId);
                    if (!loanId.isEmpty()) result.put(key, loanId);
                }
            }
        }
        return result;
    }

    private Row findPrHeaderRow(Sheet sheet, String col1, String col2) {
        for (int i = 0; i <= Math.min(20, sheet.getLastRowNum()); i++) {
            Row r = sheet.getRow(i);
            if (r == null) continue;
            for (Cell c : r) {
                String cv = cellStr(c).trim();
                if (cv.equalsIgnoreCase(col1.trim()) || cv.equalsIgnoreCase(col2.trim())) return r;
            }
        }
        return null;
    }

    private String normalizePolicyKey(String raw, boolean isIcici) {
        if (raw == null || raw.isBlank()) return "";
        String p = raw.trim();
        if (p.endsWith(".0")) p = p.substring(0, p.length() - 2);
        if (p.equals("---") || p.isEmpty()) return "";
        if (isIcici) {
            String[] parts = p.split("/");
            return parts.length >= 3 ? parts[0] + "/" + parts[1] + "/" + parts[2] : p;
        }
        return p;
    }

    private String cleanRegNo(String reg) {
        if (reg == null) return "";
        return reg.replaceAll("[-/ ]", "").toUpperCase().trim();
    }

    private <T extends FloatRecord> int[] doApplyMap(
            List<T> records, Map<String, String> policyMap,
            Consumer<List<T>> saveAll, boolean isIcici) {
        int mapped = 0;
        for (T rec : records) {
            String pol = rec.getPolicyNumber();
            if (pol == null || pol.isBlank()) continue;
            String key = normalizePolicyKey(pol.trim(), isIcici);
            String loanId = policyMap.get(key);
            if (loanId == null && !key.equals(pol.trim()))
                loanId = policyMap.get(pol.trim()); // fallback to raw key
            if (loanId != null && !loanId.isBlank()) {
                rec.setLoanId(loanId);
                mapped++;
            }
        }
        if (mapped > 0) saveAll.accept(records);
        return new int[]{mapped, records.size()};
    }

    private int[] applyLoanIdMapping(String partnerCode, String monthLabel,
                                      Map<String, String> pm, boolean isIcici) {
        return switch (partnerCode) {
            case "Go_Digit_LI" -> doApplyMap(
                monthLabel != null ? goDigitLiRepo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : goDigitLiRepo.findAllByOrderByTransDateAsc(),
                pm, list -> goDigitLiRepo.saveAll(list), isIcici);
            case "Kotak_LI" -> doApplyMap(
                monthLabel != null ? kotakLiRepo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : kotakLiRepo.findAllByOrderByTransDateAsc(),
                pm, list -> kotakLiRepo.saveAll(list), isIcici);
            case "Tata_AIG_MI_GS" -> doApplyMap(
                monthLabel != null ? tataAigRepo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : tataAigRepo.findAllByOrderByTransDateAsc(),
                pm, list -> tataAigRepo.saveAll(list), isIcici);
            case "ICICI_Lombard_MI_GS" -> doApplyMap(
                monthLabel != null ? iciciGsRepo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : iciciGsRepo.findAllByOrderByTransDateAsc(),
                pm, list -> iciciGsRepo.saveAll(list), isIcici);
            case "Go_Digit_MI_GS" -> doApplyMap(
                monthLabel != null ? goDigitGsRepo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : goDigitGsRepo.findAllByOrderByTransDateAsc(),
                pm, list -> goDigitGsRepo.saveAll(list), isIcici);
            case "Kotak_MI_GS" -> doApplyMap(
                monthLabel != null ? kotakGsRepo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : kotakGsRepo.findAllByOrderByTransDateAsc(),
                pm, list -> kotakGsRepo.saveAll(list), isIcici);
            case "Go_Digit_INSURE24" -> doApplyMap(
                monthLabel != null ? goDigitI24Repo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : goDigitI24Repo.findAllByOrderByTransDateAsc(),
                pm, list -> goDigitI24Repo.saveAll(list), isIcici);
            case "Kotak_INSURE24" -> doApplyMap(
                monthLabel != null ? kotakI24Repo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : kotakI24Repo.findAllByOrderByTransDateAsc(),
                pm, list -> kotakI24Repo.saveAll(list), isIcici);
            case "Tata_INSURE24" -> doApplyMap(
                monthLabel != null ? tataI24Repo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : tataI24Repo.findAllByOrderByTransDateAsc(),
                pm, list -> tataI24Repo.saveAll(list), isIcici);
            case "ICICI_Lombard_INSURE24" -> doApplyMap(
                monthLabel != null ? iciciI24Repo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : iciciI24Repo.findAllByOrderByTransDateAsc(),
                pm, list -> iciciI24Repo.saveAll(list), isIcici);
            case "Bajaj_INSURE24" -> doApplyMap(
                monthLabel != null ? bajajI24Repo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : bajajI24Repo.findAllByOrderByTransDateAsc(),
                pm, list -> bajajI24Repo.saveAll(list), isIcici);
            case "Go_Digit_DO" -> doApplyMap(
                monthLabel != null ? goDigitDoRepo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : goDigitDoRepo.findAllByOrderByTransDateAsc(),
                pm, list -> goDigitDoRepo.saveAll(list), isIcici);
            case "Bajaj_EW" -> doApplyMap(
                monthLabel != null ? bajajEwRepo.findByMonthLabelOrderByTransDateAsc(monthLabel)
                                   : bajajEwRepo.findAllByOrderByTransDateAsc(),
                pm, list -> bajajEwRepo.saveAll(list), isIcici);
            default -> { log.warn("[Float] mapLoanId: unknown partner {}", partnerCode); yield new int[]{0, 0}; }
        };
    }

    // ── Cell helpers ──────────────────────────────────────────────
    private String cellStr(Cell c) {
        if (c==null) return "";
        try { return switch (c.getCellType()) {
            case STRING  -> c.getStringCellValue().trim();
            case NUMERIC -> DateUtil.isCellDateFormatted(c)
                ? c.getLocalDateTimeCellValue().toLocalDate().toString()
                : String.valueOf(c.getNumericCellValue());
            case FORMULA -> { try { yield String.valueOf(c.getNumericCellValue()); }
                              catch(Exception e){ yield c.getStringCellValue().trim(); } }
            default -> "";
        }; } catch(Exception e) { return ""; }
    }

    private double numCell(Cell c) {
        if (c==null) return 0;
        try {
            if (c.getCellType()==CellType.NUMERIC) return c.getNumericCellValue();
            if (c.getCellType()==CellType.FORMULA) return c.getNumericCellValue();
            String s = cellStr(c).replaceAll("[^0-9.\\-]","");
            return s.isEmpty() ? 0 : Double.parseDouble(s);
        } catch(Exception e) { return 0; }
    }

    private BigDecimal bd(double v) {
        return BigDecimal.valueOf(Math.round(v * 10000.0) / 10000.0);
    }

    // Excel epoch for serial date conversion
    private static final java.time.LocalDate EXCEL_EPOCH =
        java.time.LocalDate.of(1899, 12, 30);

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();

        // 1. Excel serial number: "45566" or "45566.457"
        if (t.matches("^\\d{5}(\\.\\d+)?$")) {
            try {
                long serial = (long) Double.parseDouble(t);
                if (serial > 40000 && serial < 60000) {  // sane range: 2009-2064
                    return EXCEL_EPOCH.plusDays(serial);
                }
            } catch (NumberFormatException ignored) {}
        }

        // 2. Normalize missing space: "Dec 1,2025" → "Dec 1, 2025"
        t = t.replaceAll(",(\\S)", ", $1");

        // 3. Try all known string formats
        // NOTE: MM/dd/yyyy comes BEFORE dd/MM/yyyy because TATA AIG & ICICI use US format
        for (String fmt : new String[]{
            "MMM d, yyyy", "MMM dd, yyyy",  // Apr 1, 2025 / Apr 15, 2025
            "yyyy-MM-dd",                    // 2025-04-01
            "MM/dd/yyyy",  "M/d/yyyy",       // 04/01/2025 / 4/1/2025  (TATA AIG, ICICI)
            "dd-MM-yyyy",  "dd/MM/yyyy",     // 01-04-2025 / 01/04/2025 (Indian format)
            "d MMM yyyy",  "dd MMM yyyy",    // 1 Apr 2025 / 15 Apr 2025
        }) {
            try {
                return LocalDate.parse(t,
                    DateTimeFormatter.ofPattern(fmt, java.util.Locale.ENGLISH));
            } catch (DateTimeParseException ignored) {}
        }
        log.warn("[Float] Cannot parse date: '{}'", s);
        return null;
    }
}
