package com.Finx24.float_register.service;

import com.Finx24.float_register.FloatRecord;
import com.Finx24.float_register.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FloatExportServiceImpl implements FloatExportService {

    // LI repos
    private final FloatGoDigitLIRepository  goDigitLiRepo;
    private final FloatKotakLIRepository    kotakLiRepo;
    // MI_GS repos
    private final FloatTataAIGRepository    tataAigRepo;
    private final FloatIciciGSRepository    iciciGsRepo;
    private final FloatGoDigitGSRepository  goDigitGsRepo;
    private final FloatKotakGSRepository    kotakGsRepo;
    private final FloatUnitedRepository     unitedRepo;
    // MI_INSURE24 repos
    private final FloatGoDigitI24Repository goDigitI24Repo;
    private final FloatKotakI24Repository   kotakI24Repo;
    private final FloatIciciI24Repository   iciciI24Repo;
    private final FloatTataI24Repository    tataI24Repo;
    private final FloatBajajI24Repository   bajajI24Repo;
    // DO + EW
    private final FloatGoDigitDORepository  goDigitDoRepo;
    private final FloatBajajEWRepository    bajajEwRepo;

    // ── Partner config: {code, displayName, gl, sheetName} ────────
    private static final String[][] LI_PARTNERS = {
            {"Go_Digit_LI",  "Go Digit LI",  "8503595", "Go Digit LI"},
            {"Kotak_LI",     "Kotak LI",     "8503598", "Kotak LI"},
    };
    private static final String PARENT_GL_LI = "13126064";

    private static final String[][] MI_PARTNERS = {
            // MI_GS
            {"Tata_AIG_MI_GS",         "TATA AIG GS",      "6000015", "TATA AIG GS"},
            {"ICICI_Lombard_MI_GS",    "ICICI Lombard GS", "6000005", "ICICI GS"},
            {"Go_Digit_MI_GS",         "Go Digit GS",      "6000000", "Go Digit GS"},
            {"Kotak_MI_GS",            "Kotak GS",         "6000002", "Kotak GS"},
            {"United_MI_GS",           "United GS",        "6000007", "United GS"},
            // MI_INSURE24
            {"Go_Digit_INSURE24",      "Go Digit I24",     "6000030", "Go Digit I24"},
            {"Kotak_INSURE24",         "Kotak I24",        "6000032", "Kotak I24"},
            {"ICICI_Lombard_INSURE24", "ICICI I24",        "6000038", "ICICI I24"},
            {"Tata_INSURE24",          "TATA I24",         "6000031", "TATA I24"},
            {"Bajaj_INSURE24",         "Bajaj I24",        "6000037", "Bajaj I24"},
            // DO + EW
            {"Go_Digit_DO",            "Go Digit DO",      "6000040", "Go Digit DO"},
            {"Bajaj_EW",               "Bajaj EW",         "6000009", "Bajaj EW"},
    };
    private static final String PARENT_GL_MI = "13126051";

    private static final Map<String, BigDecimal> OPENING = Map.ofEntries(
            Map.entry("Go_Digit_LI",          new BigDecimal("1013063.36")),
            Map.entry("Kotak_LI",             new BigDecimal("-10530.00")),
            Map.entry("Tata_AIG_MI_GS",       new BigDecimal("4735251")),
            Map.entry("ICICI_Lombard_MI_GS",  new BigDecimal("3614011")),
            Map.entry("Go_Digit_MI_GS",       new BigDecimal("1456622.87")),
            Map.entry("Kotak_MI_GS",          new BigDecimal("2942016.00")),
            Map.entry("United_MI_GS",         new BigDecimal("28077")),
            Map.entry("Go_Digit_INSURE24",    BigDecimal.ZERO),
            Map.entry("Kotak_INSURE24",       BigDecimal.ZERO),
            Map.entry("ICICI_Lombard_INSURE24", BigDecimal.ZERO),
            Map.entry("Tata_INSURE24",        BigDecimal.ZERO),
            Map.entry("Bajaj_INSURE24",       new BigDecimal("248332")),
            Map.entry("Go_Digit_DO",          BigDecimal.ZERO),
            Map.entry("Bajaj_EW",             new BigDecimal("137553"))
    );

    // ── Color helpers ──────────────────────────────────────────────
    private static final String NAVY="0B1F3A", WHITE="FFFFFF", GOLD="E8B84B",
            GREEN="1D6F42", RED="8B2121", PURPLE="5A2D82",
            LTGRAY="F2F4F7", GOLDLITE="FFF8E7", MUTED="9AA5B4";

    private XSSFColor rgb(String hex) {
        return new XSSFColor(new byte[]{
                (byte)Integer.parseInt(hex.substring(0,2),16),
                (byte)Integer.parseInt(hex.substring(2,4),16),
                (byte)Integer.parseInt(hex.substring(4,6),16)
        }, null);
    }

    private CellStyle hdrStyle(XSSFWorkbook wb, String bg, String fg,
                               boolean bold, int sz, HorizontalAlignment ha) {
        XSSFCellStyle st = wb.createCellStyle();
        st.setFillForegroundColor(rgb(bg));
        st.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        st.setAlignment(ha);
        st.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorderAll(st);
        XSSFFont f = wb.createFont();
        f.setBold(bold); f.setColor(rgb(fg));
        f.setFontHeightInPoints((short)sz); f.setFontName("Arial");
        st.setFont(f);
        return st;
    }

    private CellStyle numStyle(XSSFWorkbook wb, String bg, String fg, boolean bold) {
        XSSFCellStyle st = wb.createCellStyle();
        st.setFillForegroundColor(rgb(bg));
        st.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        st.setAlignment(HorizontalAlignment.RIGHT);
        st.setVerticalAlignment(VerticalAlignment.CENTER);
        st.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));
        setBorderAll(st);
        XSSFFont f = wb.createFont();
        f.setBold(bold); f.setColor(rgb(fg));
        f.setFontHeightInPoints((short)9); f.setFontName("Arial");
        st.setFont(f);
        return st;
    }

    private void setBorderAll(XSSFCellStyle st) {
        st.setBorderBottom(BorderStyle.THIN); st.setBorderTop(BorderStyle.THIN);
        st.setBorderLeft(BorderStyle.THIN);   st.setBorderRight(BorderStyle.THIN);
    }

    private void sv(Row row, int col, Object val, CellStyle st) {
        Cell c = row.createCell(col);
        if (val instanceof String s)   c.setCellValue(s);
        else if (val instanceof Number n) c.setCellValue(n.doubleValue());
        if (st != null) c.setCellStyle(st);
    }

    // ── MAIN ───────────────────────────────────────────────────────
    @Override
    public byte[] generateMonthReport(String category, String month) throws Exception {
        boolean isLI    = "LI".equalsIgnoreCase(category);
        String[][] pArr = isLI ? LI_PARTNERS : MI_PARTNERS;
        String parentGl = isLI ? PARENT_GL_LI : PARENT_GL_MI;
        String title    = isLI ? "LI Float Register" : "MI Float Register";

        XSSFWorkbook wb = new XSSFWorkbook();

        // Compute opening balance for each partner for selected month (from DB)
        Map<String, Double> computedOpenings = new LinkedHashMap<>();
        for (String[] p : pArr) {
            double ob = computeOpeningForMonth(p[0], month);
            computedOpenings.put(p[0], ob);
            log.info("[Export] {} opening for {}: {}", p[1], month, ob);
        }

        // Build partner sheets first (summary will formula-ref them)
        for (String[] p : pArr) {
            List<? extends FloatRecord> rows = fetchByMonth(p[0], month);
            buildPartnerSheet(wb, p[3], p[0], p[2], month, parentGl, rows);
            log.info("[Export] {} {} → {} rows", p[1], month, rows.size());
        }

        // Build summary with correct opening balances
        buildSummarySheet(wb, pArr, title, month, parentGl, computedOpenings);
        wb.setSheetOrder("Float Summary", 0);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return out.toByteArray();
    }

    // ── Summary sheet ──────────────────────────────────────────────
    private void buildSummarySheet(XSSFWorkbook wb, String[][] pArr,
                                   String title, String month, String parentGl,
                                   Map<String, Double> computedOpenings) {
        Sheet ws = wb.createSheet("Float Summary");
        ws.createFreezePane(1, 4);
        ws.setColumnWidth(0, 7500);
        for (int i = 1; i <= pArr.length; i++) ws.setColumnWidth(i, 5200);

        CellStyle titleSt = hdrStyle(wb, NAVY, WHITE,    true,  12, HorizontalAlignment.CENTER);
        CellStyle subSt   = hdrStyle(wb, NAVY, GOLD,     false, 9,  HorizontalAlignment.CENTER);
        CellStyle glSt    = hdrStyle(wb, GOLDLITE, MUTED,false, 8,  HorizontalAlignment.CENTER);
        CellStyle nameSt  = hdrStyle(wb, NAVY, GOLD,     true,  9,  HorizontalAlignment.CENTER);
        CellStyle lblBold = hdrStyle(wb, NAVY, WHITE,    true,  9,  HorizontalAlignment.LEFT);
        CellStyle lblNorm = hdrStyle(wb, LTGRAY, NAVY,   false, 9,  HorizontalAlignment.LEFT);

        // Row 0 — Title
        Row r0 = ws.createRow(0); r0.setHeightInPoints(28);
        Cell tc = r0.createCell(0);
        tc.setCellValue("FINX24  ·  " + title + "  ·  Month: " + month
                + "  ·  Parent GL: " + parentGl);
        tc.setCellStyle(titleSt);
        ws.addMergedRegion(new CellRangeAddress(0, 0, 0, pArr.length));

        // Row 1 — GL codes
        Row r1 = ws.createRow(1); r1.setHeightInPoints(14);
        sv(r1, 0, "GL Account", glSt);
        for (int i = 0; i < pArr.length; i++) sv(r1, i+1, pArr[i][2], glSt);

        // Row 2 — Partner names
        Row r2 = ws.createRow(2); r2.setHeightInPoints(22);
        sv(r2, 0, "Particulars", nameSt);
        for (int i = 0; i < pArr.length; i++) sv(r2, i+1, pArr[i][1], nameSt);

        // Summary rows 3-8
        record SummRow(String label, String metric, CellStyle lblSt, CellStyle numSt) {}
        List<SummRow> summRows = List.of(
                new SummRow("Opening Balance (" + getPrevMonth(month) + ")",
                        "openingBal", lblBold, numStyle(wb,NAVY,WHITE,true)),
                new SummRow("Float Top-Up",
                        "topUp",      lblNorm, numStyle(wb,LTGRAY,GREEN,false)),
                new SummRow("Cancellation Received",
                        "cancelCredit",lblNorm,numStyle(wb,LTGRAY,PURPLE,false)),
                new SummRow("Total Debit",
                        "totalDebit",  lblNorm,numStyle(wb,LTGRAY,RED,false)),
                new SummRow("Expense  (Debit − Cancellation Rcvd)",
                        "expense",     lblNorm,numStyle(wb,LTGRAY,"C8992A",false)),
                new SummRow("Closing Balance (End of " + month + ")",
                        "closingBal",  lblBold,numStyle(wb,NAVY,WHITE,true))
        );

        for (int ri = 0; ri < summRows.size(); ri++) {
            Row row = ws.createRow(3 + ri);
            row.setHeightInPoints(20);
            sv(row, 0, summRows.get(ri).label(), summRows.get(ri).lblSt());
            for (int pi = 0; pi < pArr.length; pi++) {
                String code  = pArr[pi][0];
                String sname = pArr[pi][3];
                Cell fc = row.createCell(pi + 1);
                fc.setCellStyle(summRows.get(ri).numSt());
                String formula = buildFormula(summRows.get(ri).metric(), sname, code, computedOpenings);
                if (formula.matches("[-\\d.]+")) fc.setCellValue(Double.parseDouble(formula));
                else fc.setCellFormula(formula);
            }
        }

        // Note row
        Row rN = ws.createRow(9); rN.setHeightInPoints(13);
        Cell nc = rN.createCell(0);
        nc.setCellValue("All values are formula-based · Closing = Opening + Top-Up + Cancel − Debit");
        XSSFCellStyle noteSt = wb.createCellStyle();
        XSSFFont nf = wb.createFont();
        nf.setItalic(true); nf.setColor(rgb(MUTED)); nf.setFontHeightInPoints((short)8);
        noteSt.setFont(nf);
        nc.setCellStyle(noteSt);
        ws.addMergedRegion(new CellRangeAddress(9, 9, 0, pArr.length));
    }

    // ── Partner detail sheet ───────────────────────────────────────
    private void buildPartnerSheet(XSSFWorkbook wb, String sname, String code,
                                   String gl, String month, String parentGl,
                                   List<? extends FloatRecord> rows) {
        Sheet ws = wb.createSheet(sname);
        ws.createFreezePane(0, 2);

        CellStyle titleSt = hdrStyle(wb, NAVY, WHITE,  true,  11, HorizontalAlignment.LEFT);
        CellStyle hdrSt   = hdrStyle(wb, NAVY, GOLD,   true,  9,  HorizontalAlignment.CENTER);
        CellStyle dataSt  = hdrStyle(wb, WHITE, "000000", false, 9, HorizontalAlignment.LEFT);
        CellStyle altSt   = hdrStyle(wb, LTGRAY,"000000",false, 9, HorizontalAlignment.LEFT);
        CellStyle numSt   = numStyle(wb, WHITE, "000000", false);
        CellStyle numAlt  = numStyle(wb, LTGRAY,"000000", false);
        CellStyle numRed  = numStyle(wb, WHITE, RED, false);

        // Title
        Row r0 = ws.createRow(0); r0.setHeightInPoints(22);
        Cell tc = r0.createCell(0);
        tc.setCellValue(sname + "  ·  GL: " + gl + "  ·  Month: " + month
                + "  ·  Parent GL: " + parentGl);
        tc.setCellStyle(titleSt);
        ws.addMergedRegion(new CellRangeAddress(0, 0, 0, 8));

        // Headers
        String[] hdrs = {"Month","Trans Date","Booking Type","Transaction Details",
                "Credit (₹)","Debit (₹)","Balance (₹)","Policy No","Reg No"};
        int[]    widths= {2800, 3200, 7000, 10000, 4200, 4200, 4500, 5500, 4500};
        Row r1 = ws.createRow(1); r1.setHeightInPoints(18);
        for (int i = 0; i < hdrs.length; i++) {
            sv(r1, i, hdrs[i], hdrSt);
            ws.setColumnWidth(i, widths[i]);
        }

        // Data
        int rn = 2;
        for (FloatRecord rec : rows) {
            Row row = ws.createRow(rn);
            row.setHeightInPoints(14);
            boolean alt = (rn % 2 == 0);
            CellStyle ts = alt ? altSt : dataSt;
            CellStyle ns = alt ? numAlt : numSt;

            sv(row, 0, rec.getMonthLabel(), ts);
            sv(row, 1, rec.getTransDate() != null ? rec.getTransDate().toString() : "", ts);
            sv(row, 2, rec.getBookingType(), ts);
            sv(row, 3, rec.getTransactionDetails(), ts);

            double cr = rec.getCreditAmt() != null ? rec.getCreditAmt().doubleValue() : 0;
            double dr = rec.getDebitAmt()  != null ? rec.getDebitAmt().doubleValue()  : 0;
            double bl = rec.getBalance()   != null ? rec.getBalance().doubleValue()   : 0;

            Cell cCell = row.createCell(4); cCell.setCellValue(cr); cCell.setCellStyle(ns);
            Cell dCell = row.createCell(5); dCell.setCellValue(dr); dCell.setCellStyle(ns);
            Cell bCell = row.createCell(6); bCell.setCellValue(bl);
            bCell.setCellStyle(bl < 0 ? numRed : ns);

            sv(row, 7, rec.getPolicyNumber() != null ? rec.getPolicyNumber() : "", ts);
            sv(row, 8, rec.getLoanId()       != null ? rec.getLoanId()       : "", ts);
            rn++;
        }

    }

    // ── Formula builder for summary ────────────────────────────────
    private String buildFormula(String metric, String sname, String code,
                                Map<String, Double> computedOpenings) {
        String s  = "'" + sname + "'";
        String tu = getTopUpCriteria(code);
        // TATA: top-up stored in col D (Mode of Payment / transactionDetails)
        // Others: top-up stored in col C (bookingType)
        String tc = isTataPartner(code) ? "D" : "C";

        return switch (metric) {
            case "openingBal" ->
                    String.valueOf(computedOpenings.getOrDefault(code,
                            OPENING.getOrDefault(code, BigDecimal.ZERO).doubleValue()));

            case "topUp" ->
                    "SUMIF(" + s + "!" + tc + ":" + tc + "," + tu + "," + s + "!E:E)";

            case "cancelCredit" -> {
                String tuSum = "SUMIF(" + s + "!" + tc + ":" + tc + "," + tu + "," + s + "!E:E)";
                yield "SUMIF(" + s + "!E:E,\">0\"," + s + "!E:E)-" + tuSum;
            }

            case "totalDebit" ->
                    "SUM(" + s + "!F:F)";

            case "expense" -> {
                String tuSum = "SUMIF(" + s + "!" + tc + ":" + tc + "," + tu + "," + s + "!E:E)";
                String cancel = "SUMIF(" + s + "!E:E,\">0\"," + s + "!E:E)-" + tuSum;
                yield "SUM(" + s + "!F:F)-(" + cancel + ")";
            }

            case "closingBal" -> {
                double ob    = computedOpenings.getOrDefault(code,
                        OPENING.getOrDefault(code, BigDecimal.ZERO).doubleValue());
                String topUp = "SUMIF(" + s + "!" + tc + ":" + tc + "," + tu + "," + s + "!E:E)";
                String cancel= "SUMIF(" + s + "!E:E,\">0\"," + s + "!E:E)-" + topUp;
                String debit = "SUM(" + s + "!F:F)";
                yield ob + "+" + topUp + "+(" + cancel + ")-" + debit;
            }
            default -> "0";
        };
    }

    // Top-up SUMIF criteria per partner
    // Top-up SUMIF criteria per partner
    // Top-up SUMIF criteria per partner (returns Excel SUMIF criteria string)
    private String getTopUpCriteria(String code) {
        return switch (code) {
            case "Tata_AIG_MI_GS","Tata_INSURE24"
                    -> "\"RTGS/NEFT\"";
            case "ICICI_Lombard_MI_GS","ICICI_Lombard_INSURE24"
                    -> "\"---\"";
            case "United_MI_GS"
                    -> "\"Credit\"";
            case "Kotak_MI_GS","Kotak_INSURE24"
                    -> "\"*Credit Received*\"";
            case "Bajaj_INSURE24","Bajaj_EW"
                    -> "\"*\"";
            default
                    -> "\"*manual payment slip*\"";
        };
    }


    private boolean isTataPartner(String code) {
        return code.equals("Tata_AIG_MI_GS") || code.equals("Tata_INSURE24");
    }


    // ── DB fetch ───────────────────────────────────────────────────
    /**
     * Computes the opening balance for a partner for the given month.
     * Opening = Initial Opening Balance + sum of all months BEFORE selected month.
     * Formula: opening + sum(topUpCredit + cancelCredit - totalDebit) for all prior months
     */
    private double computeOpeningForMonth(String partnerCode, String monthLabel) {
        double initial = OPENING.getOrDefault(partnerCode, BigDecimal.ZERO).doubleValue();

        // Get all monthly summaries from DB
        List<Object[]> allMonths = fetchMonthSummary(partnerCode);

        // Sort by month label chronologically
        allMonths.sort((a, b) -> monthOrder(String.valueOf(a[0])) - monthOrder(String.valueOf(b[0])));

        // Sum all months BEFORE the selected month
        double running = initial;
        for (Object[] row : allMonths) {
            String mo = String.valueOf(row[0]);
            if (monthOrder(mo) >= monthOrder(monthLabel)) break;
            double tu  = row[1] != null ? ((Number) row[1]).doubleValue() : 0;
            double ca  = row[2] != null ? ((Number) row[2]).doubleValue() : 0;
            double dr  = row[3] != null ? ((Number) row[3]).doubleValue() : 0;
            running = running + tu + ca - dr;
        }
        return running;
    }

    private int monthOrder(String label) {
        if (label == null || label.length() < 5) return 9999;
        String[] MO = {"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"};
        try {
            int yr = Integer.parseInt(label.substring(4));
            for (int i = 0; i < MO.length; i++) {
                if (MO[i].equals(label.substring(0, 3))) return yr * 100 + i;
            }
        } catch (Exception ignored) {}
        return 9999;
    }

    private List<Object[]> fetchMonthSummary(String partnerCode) {
        return switch (partnerCode) {
            case "Go_Digit_LI"            -> goDigitLiRepo.findMonthSummary();
            case "Kotak_LI"               -> kotakLiRepo.findMonthSummary();
            case "Tata_AIG_MI_GS"         -> tataAigRepo.findMonthSummary();
            case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.findMonthSummary();
            case "Go_Digit_MI_GS"         -> goDigitGsRepo.findMonthSummary();
            case "Kotak_MI_GS"            -> kotakGsRepo.findMonthSummary();
            case "United_MI_GS"           -> unitedRepo.findMonthSummary();
            case "Go_Digit_INSURE24"      -> goDigitI24Repo.findMonthSummary();
            case "Kotak_INSURE24"         -> kotakI24Repo.findMonthSummary();
            case "ICICI_Lombard_INSURE24" -> iciciI24Repo.findMonthSummary();
            case "Tata_INSURE24"          -> tataI24Repo.findMonthSummary();
            case "Bajaj_INSURE24"         -> bajajI24Repo.findMonthSummary();
            case "Go_Digit_DO"            -> goDigitDoRepo.findMonthSummary();
            case "Bajaj_EW"               -> bajajEwRepo.findMonthSummary();
            default -> List.of();
        };
    }

    private List<? extends FloatRecord> fetchByMonth(String code, String month) {
        if (month == null || month.isBlank()) return List.of();
        return switch (code) {
            case "Go_Digit_LI"            -> goDigitLiRepo.findByMonthLabelOrderByTransDateAsc(month);
            case "Kotak_LI"               -> kotakLiRepo.findByMonthLabelOrderByTransDateAsc(month);
            case "Tata_AIG_MI_GS"         -> tataAigRepo.findByMonthLabelOrderByTransDateAsc(month);
            case "ICICI_Lombard_MI_GS"    -> iciciGsRepo.findByMonthLabelOrderByTransDateAsc(month);
            case "Go_Digit_MI_GS"         -> goDigitGsRepo.findByMonthLabelOrderByTransDateAsc(month);
            case "Kotak_MI_GS"            -> kotakGsRepo.findByMonthLabelOrderByTransDateAsc(month);
            case "United_MI_GS"           -> unitedRepo.findByMonthLabelOrderByTransDateAsc(month);
            case "Go_Digit_INSURE24"      -> goDigitI24Repo.findByMonthLabelOrderByTransDateAsc(month);
            case "Kotak_INSURE24"         -> kotakI24Repo.findByMonthLabelOrderByTransDateAsc(month);
            case "ICICI_Lombard_INSURE24" -> iciciI24Repo.findByMonthLabelOrderByTransDateAsc(month);
            case "Tata_INSURE24"          -> tataI24Repo.findByMonthLabelOrderByTransDateAsc(month);
            case "Bajaj_INSURE24"         -> bajajI24Repo.findByMonthLabelOrderByTransDateAsc(month);
            case "Go_Digit_DO"            -> goDigitDoRepo.findByMonthLabelOrderByTransDateAsc(month);
            case "Bajaj_EW"               -> bajajEwRepo.findByMonthLabelOrderByTransDateAsc(month);
            default -> List.of();
        };
    }

    private String getPrevMonth(String month) {
        if (month == null || month.length() < 5) return "";
        String[] MO = {"Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"};
        String mo = month.substring(0, 3);
        int yr = Integer.parseInt(month.substring(4));
        for (int i = 0; i < MO.length; i++) {
            if (MO[i].equals(mo)) {
                int pm = i - 1; int py = yr;
                if (pm < 0) { pm = 11; py--; }
                return MO[pm] + "'" + String.format("%02d", py % 100);
            }
        }
        return month;
    }
}