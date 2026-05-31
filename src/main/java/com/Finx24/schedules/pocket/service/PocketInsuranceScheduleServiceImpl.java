package com.Finx24.schedules.pocket.service;

import com.Finx24.disbursal.entity.DisbursalRecord;
import com.Finx24.disbursal.repository.DisbursalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PocketInsuranceScheduleServiceImpl implements PocketInsuranceScheduleService {

    private final DisbursalRepository repo;

    // ── Fixed pricing constants ────────────────────────────────────
    private static final double POCKET_WITH_GST  = 2360.0;
    private static final double GST_RATE         = 0.18;
    private static final double POCKET_EX_GST    = POCKET_WITH_GST / (1 + GST_RATE); // 2000
    private static final double PARTNER_SHARE    = 550.0;   // Assurekit
    private static final double NET_COMMISSION   = 1550.0;  // Our share (2000 - 450... wait, 2000-550=1450? No: 2360-18%=2000, 2000-550=1450? Let me recheck: user said 1550 = our share, partner=550, but 550+1550=2100≠2000. Actually from sample: Partner=450, Net=1550, total=2000. So partner=450)
    // From sample data: Partner Share = 450, Net Commission = 1550 → 450+1550=2000 ✓
    private static final double PARTNER_SHARE_ACTUAL = 450.0;
    private static final double NET_COMM_ACTUAL  = 1550.0;

    // ── Colors ────────────────────────────────────────────────────
    private static final String NAVY="0B1F3A", GOLD="E8B84B", WHITE="FFFFFF",
        GREEN="1D6F42", RED="8B2121", LTGRAY="F2F4F7", MUTED="9AA5B4",
        PURPLE="5A2D82";

    // ── Main ──────────────────────────────────────────────────────
    @Override
    public byte[] generateSchedule(LocalDate from, LocalDate to,
                                    String monthLabel,
                                    MultipartFile disbursalFile) throws Exception {

        // 1. Fetch filtered records directly from DB
        List<DisbursalRecord> activePI  = repo.findActivePocketInsurance(from, to);
        List<DisbursalRecord> subCancel = repo.findSubCancelPocketInsurance(from, to);

        log.info("[PI Schedule] {} | Active PI cases: {} | Sub-Cancel: {}",
                 monthLabel, activePI.size(), subCancel.size());

        // 2. Build Excel
        XSSFWorkbook wb = new XSSFWorkbook();
        buildSummarySheet(wb, activePI, subCancel, monthLabel, from, to);
        buildAccrualSheet(wb, activePI, subCancel, monthLabel);
        buildActiveSheet(wb, activePI, monthLabel);
        buildSubCancelSheet(wb, subCancel, monthLabel);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return out.toByteArray();
    }

    // ── Sheet 1: Summary ──────────────────────────────────────────
    private void buildSummarySheet(XSSFWorkbook wb,
                                    List<DisbursalRecord> active,
                                    List<DisbursalRecord> cancel,
                                    String monthLabel,
                                    LocalDate from, LocalDate to) {
        Sheet ws = wb.createSheet("Summary");
        ws.setColumnWidth(0, 500);
        ws.setColumnWidth(1, 500);
        ws.setColumnWidth(2, 9000);
        ws.setColumnWidth(3, 6000);
        ws.setColumnWidth(4, 6000);
        ws.setColumnWidth(5, 6000);
        ws.setDisplayGridlines(false);

        CellStyle titleSt = hdr(wb, NAVY, WHITE, true, 13, HorizontalAlignment.CENTER);
        CellStyle subSt   = hdr(wb, NAVY, GOLD,  false, 9, HorizontalAlignment.CENTER);
        CellStyle hdrSt   = hdr(wb, NAVY, GOLD,  true,  9, HorizontalAlignment.CENTER);
        CellStyle lblSt   = hdr(wb, LTGRAY, NAVY, false, 9, HorizontalAlignment.LEFT);
        CellStyle lblBold = hdr(wb, NAVY,  WHITE, true,  9, HorizontalAlignment.LEFT);
        CellStyle numSt   = num(wb, LTGRAY, NAVY, false);
        CellStyle numBold = num(wb, NAVY,  WHITE, true);
        CellStyle numGreen= num(wb, LTGRAY, GREEN, false);
        CellStyle numRed  = num(wb, LTGRAY, RED,  false);

        // Row 0 — Title
        Row r0 = ws.createRow(0); r0.setHeightInPoints(28);
        sc(r0, 0, "FINX24  ·  Pocket Insurance Schedule  ·  " + monthLabel, titleSt);
        ws.addMergedRegion(new CellRangeAddress(0, 0, 0, 5));

        // Row 1 — Period
        Row r1 = ws.createRow(1); r1.setHeightInPoints(16);
        sc(r1, 0, "Period: " + from + " to " + to + "   ·   Product: Pocket Insurance (Assurekit)", subSt);
        ws.addMergedRegion(new CellRangeAddress(1, 1, 0, 5));

        // Spacer
        ws.createRow(2).setHeightInPoints(8);

        // Row 3 — Headers
        Row r3 = ws.createRow(3); r3.setHeightInPoints(20);
        sc(r3, 2, "Particulars",           hdrSt);
        sc(r3, 3, "Amt excl. GST (₹)",     hdrSt);
        sc(r3, 4, "Commission (₹)",         hdrSt);
        sc(r3, 5, "Cases",                  hdrSt);

        // Compute summary
        double activeTotal    = active.size() * POCKET_EX_GST;
        double activeComm     = active.size() * NET_COMM_ACTUAL;
        double cancelTotal    = cancel.size() * POCKET_EX_GST;
        double cancelComm     = cancel.size() * NET_COMM_ACTUAL;
        double netAccrual     = activeComm - cancelComm;

        int row = 4;
        // Active
        Row ra = ws.createRow(row++); ra.setHeightInPoints(18);
        sc(ra, 2, "Pocket Insurance (Active)",     lblSt);
        sn(ra, 3, activeTotal,  numSt);
        sn(ra, 4, activeComm,   numGreen);
        sn(ra, 5, (double)active.size(), numSt);

        // Sub-Cancel
        Row rc = ws.createRow(row++); rc.setHeightInPoints(18);
        sc(rc, 2, "Subsequent Cancellation",       lblSt);
        sn(rc, 3, cancelTotal,  numSt);
        sn(rc, 4, cancelComm,   numRed);
        sn(rc, 5, (double)cancel.size(), numSt);

        // Separator
        ws.createRow(row++).setHeightInPoints(6);

        // Total Net Accrual
        Row rt = ws.createRow(row++); rt.setHeightInPoints(22);
        sc(rt, 2, "Total Net Accrual Commission",  lblBold);
        sn(rt, 3, activeTotal - cancelTotal,       numBold);
        sn(rt, 4, netAccrual,                      numBold);
        sn(rt, 5, (double)(active.size() - cancel.size()), numBold);

        // Carry forward placeholder
        Row rf = ws.createRow(row++); rf.setHeightInPoints(18);
        sc(rf, 2, "Commission — Carry Forward",   lblSt);
        sn(rf, 3, 0.0, numSt);
        sn(rf, 4, 0.0, numSt);
        sn(rf, 5, 0.0, numSt);

        // Spacer
        ws.createRow(row++).setHeightInPoints(10);

        // Channel breakdown
        Row rch = ws.createRow(row++); rch.setHeightInPoints(20);
        sc(rch, 2, "Channel",       hdrSt);
        sc(rch, 3, "Net Commission",hdrSt);
        sc(rch, 4, "Sub-Cancel",    hdrSt);
        sc(rch, 5, "Net Amount",    hdrSt);

        Map<String, long[]> byChannel = new LinkedHashMap<>();
        byChannel.put("C2C", new long[]{0, 0});
        byChannel.put("UCB", new long[]{0, 0});
        byChannel.put("Other", new long[]{0, 0});

        for (DisbursalRecord r : active) {
            String ch = r.getChannel() != null ? r.getChannel().toUpperCase() : "Other";
            if (!byChannel.containsKey(ch)) ch = "Other";
            byChannel.get(ch)[0]++;
        }
        for (DisbursalRecord r : cancel) {
            String ch = r.getChannel() != null ? r.getChannel().toUpperCase() : "Other";
            if (!byChannel.containsKey(ch)) ch = "Other";
            byChannel.get(ch)[1]++;
        }

        long grandActive = 0, grandCancel = 0;
        for (Map.Entry<String, long[]> e : byChannel.entrySet()) {
            if (e.getValue()[0] == 0 && e.getValue()[1] == 0) continue;
            double chComm   = e.getValue()[0] * NET_COMM_ACTUAL;
            double chCancel = e.getValue()[1] * NET_COMM_ACTUAL;
            Row rr = ws.createRow(row++); rr.setHeightInPoints(18);
            sc(rr, 2, e.getKey(),          lblSt);
            sn(rr, 3, chComm,              numSt);
            sn(rr, 4, chCancel,            numRed);
            sn(rr, 5, chComm - chCancel,   numGreen);
            grandActive += e.getValue()[0];
            grandCancel += e.getValue()[1];
        }

        // Grand Total channel
        Row rgt = ws.createRow(row++); rgt.setHeightInPoints(20);
        sc(rgt, 2, "Grand Total",                        lblBold);
        sn(rgt, 3, grandActive * NET_COMM_ACTUAL,        numBold);
        sn(rgt, 4, grandCancel * NET_COMM_ACTUAL,        numBold);
        sn(rgt, 5, (grandActive - grandCancel) * NET_COMM_ACTUAL, numBold);

        // Pricing box at bottom
        ws.createRow(row++).setHeightInPoints(12);
        CellStyle boxHdr = hdr(wb, PURPLE, WHITE, true, 8, HorizontalAlignment.LEFT);
        CellStyle boxVal = hdr(wb, LTGRAY, PURPLE, false, 8, HorizontalAlignment.RIGHT);

        String[][] pricingInfo = {
            {"Product Price (incl. GST 18%)", "₹2,360"},
            {"Base Price (excl. GST)",         "₹2,000"},
            {"Partner Share (Assurekit)",       "₹450"},
            {"Net Commission (Our Share)",      "₹1,550"},
        };
        for (String[] info : pricingInfo) {
            Row pr = ws.createRow(row++); pr.setHeightInPoints(16);
            sc(pr, 2, info[0], boxHdr);
            sc(pr, 3, info[1], boxVal);
        }
    }

    // ── Sheet 2: Accrual Entry ────────────────────────────────────
    private void buildAccrualSheet(XSSFWorkbook wb,
                                    List<DisbursalRecord> active,
                                    List<DisbursalRecord> cancel,
                                    String monthLabel) {
        Sheet ws = wb.createSheet("Accrual Entry");
        ws.setDisplayGridlines(false);
        ws.setColumnWidth(0, 500);
        ws.setColumnWidth(1, 12000);
        ws.setColumnWidth(2, 5500);
        ws.setColumnWidth(3, 5500);
        ws.setColumnWidth(4, 6500);

        CellStyle titleSt = hdr(wb, NAVY, WHITE,  true, 11, HorizontalAlignment.LEFT);
        CellStyle hdrSt   = hdr(wb, NAVY, GOLD,   true,  9, HorizontalAlignment.CENTER);
        CellStyle lblSt   = hdr(wb, LTGRAY, NAVY, false, 9, HorizontalAlignment.LEFT);
        CellStyle numSt   = num(wb, LTGRAY, NAVY, false);
        CellStyle numNeg  = num(wb, LTGRAY, RED,  false);

        Row r0 = ws.createRow(0); r0.setHeightInPoints(24);
        sc(r0, 0, "FINX24  ·  Pocket Insurance — Accrual Entry  ·  " + monthLabel, titleSt);
        ws.addMergedRegion(new CellRangeAddress(0, 0, 0, 4));

        Row r2 = ws.createRow(2); r2.setHeightInPoints(18);
        sc(r2, 1, "Particulars",           hdrSt);
        sc(r2, 2, "Dr / Cr",               hdrSt);
        sc(r2, 3, "GL Code",               hdrSt);
        sc(r2, 4, "Amount (₹)",            hdrSt);

        double activeComm = active.size() * NET_COMM_ACTUAL;
        double cancelComm = cancel.size() * NET_COMM_ACTUAL;
        double net        = activeComm - cancelComm;

        // Accrual entries
        Object[][] entries = {
            {"Pocket Insurance Commission Receivable — " + monthLabel, "Dr", "TBD", activeComm},
            {"  Pocket Insurance Income (Active — " + active.size() + " cases)", "Cr", "TBD", -activeComm},
            {"Pocket Insurance Income (Sub-Cancel Reversal — " + cancel.size() + " cases)", "Dr", "TBD", cancelComm},
            {"  Pocket Insurance Commission Receivable (Reversal)", "Cr", "TBD", -cancelComm},
        };

        int row = 3;
        for (Object[] e : entries) {
            Row r = ws.createRow(row++); r.setHeightInPoints(18);
            sc(r, 1, (String) e[0],    lblSt);
            sc(r, 2, (String) e[1],    lblSt);
            sc(r, 3, (String) e[2],    lblSt);
            double amt = (double) e[3];
            sn(r, 4, Math.abs(amt),   amt >= 0 ? numSt : numNeg);
        }

        ws.createRow(row++).setHeightInPoints(8);
        CellStyle netSt  = hdr(wb, NAVY, WHITE, true, 9, HorizontalAlignment.LEFT);
        CellStyle netNum = num(wb, NAVY, WHITE, true);
        Row rn = ws.createRow(row); rn.setHeightInPoints(20);
        sc(rn, 1, "Net Accrual Commission — " + monthLabel, netSt);
        sc(rn, 2, "Net", netSt);
        sc(rn, 3, "TBD", netSt);
        sn(rn, 4, net, netNum);
    }

    // ── Sheet 3: Disbursal Active ─────────────────────────────────
    private void buildActiveSheet(XSSFWorkbook wb,
                                   List<DisbursalRecord> active,
                                   String monthLabel) {
        Sheet ws = wb.createSheet("Disbursal Active Cases");
        ws.createFreezePane(0, 2);
        ws.setDisplayGridlines(false);

        buildDataSheet(wb, ws, active, "Active Cases",
                       "Pocket Insurance — Active  ·  " + monthLabel,
                       false);
    }

    // ── Sheet 4: Sub Cancellation ─────────────────────────────────
    private void buildSubCancelSheet(XSSFWorkbook wb,
                                      List<DisbursalRecord> cancel,
                                      String monthLabel) {
        Sheet ws = wb.createSheet("Sub Cancellation");
        ws.createFreezePane(0, 2);
        ws.setDisplayGridlines(false);

        buildDataSheet(wb, ws, cancel, "Sub-Cancel",
                       "Pocket Insurance — Sub Cancellation  ·  " + monthLabel,
                       true);
    }

    private void buildDataSheet(XSSFWorkbook wb, Sheet ws, List<DisbursalRecord> rows,
                                  String label, String title, boolean isCancel) {
        // Column widths
        int[] colW = {1200, 5200, 5200, 4200, 3500, 3500, 4000, 3800, 3800, 4000, 3500, 3500, 3500, 3500};
        for (int i = 0; i < colW.length; i++) ws.setColumnWidth(i, colW[i]);

        CellStyle titleSt = hdr(wb, NAVY, WHITE,  true,  11, HorizontalAlignment.LEFT);
        CellStyle hdrSt   = hdr(wb, NAVY, GOLD,   true,   9, HorizontalAlignment.CENTER);
        CellStyle dataSt  = hdr(wb, WHITE, "000000", false, 9, HorizontalAlignment.LEFT);
        CellStyle altSt   = hdr(wb, LTGRAY,"000000",false,  9, HorizontalAlignment.LEFT);
        CellStyle numSt   = num(wb, WHITE, "000000", false);
        CellStyle numAlt  = num(wb, LTGRAY,"000000", false);
        CellStyle numGrn  = num(wb, WHITE, GREEN, false);
        CellStyle numGrA  = num(wb, LTGRAY,GREEN, false);
        CellStyle numRed  = num(wb, WHITE, RED, false);

        // Summary rows at top
        int totalCases  = rows.size();
        double totalPocket  = totalCases * POCKET_WITH_GST;
        double totalGST     = totalCases * (POCKET_WITH_GST - POCKET_EX_GST);
        double totalExGST   = totalCases * POCKET_EX_GST;
        double totalComm    = totalCases * NET_COMM_ACTUAL;

        CellStyle sumLbl = hdr(wb, LTGRAY, MUTED, false, 8, HorizontalAlignment.LEFT);
        CellStyle sumVal = num(wb, LTGRAY, NAVY, true);
        String[][] sumRows = {
            {"Total Pocket (incl. GST)", String.valueOf(totalPocket)},
            {"GST Amount (18%)",          String.valueOf(totalGST)},
            {"MI after Tax (excl. GST)", String.valueOf(totalExGST)},
            {"Total Commission (Net)",   String.valueOf(totalComm)},
        };
        for (int i = 0; i < sumRows.length; i++) {
            Row r = ws.createRow(i); r.setHeightInPoints(14);
            sc(r, 0, sumRows[i][0], sumLbl);
            sn(r, 1, Double.parseDouble(sumRows[i][1]), sumVal);
        }

        // Title row
        Row rt = ws.createRow(4); rt.setHeightInPoints(22);
        sc(rt, 0, title, titleSt);
        ws.addMergedRegion(new CellRangeAddress(4, 4, 0, 13));

        // Headers
        String[] hdrs = {
            "Loan ID", "Customer Name", "Reg Number", "Channel", "Segment",
            "HPA Status", "Disb Date", "Loan Status", "City", "State",
            "Pocket Charge", "Excl GST", "Partner Share", "Net Commission"
        };
        Row rh = ws.createRow(5); rh.setHeightInPoints(18);
        for (int i = 0; i < hdrs.length; i++) sc(rh, i, hdrs[i], hdrSt);

        // Data rows
        int rn = 6;
        for (DisbursalRecord rec : rows) {
            Row r = ws.createRow(rn); r.setHeightInPoints(14);
            boolean alt = (rn % 2 == 0);
            CellStyle ts = alt ? altSt : dataSt;
            CellStyle ns = alt ? numAlt : numSt;
            CellStyle ng = alt ? numGrA : numGrn;

            sc(r, 0,  nvl(rec.getLoanApplicationId()), ts);
            sc(r, 1,  nvl(rec.getCustomerName()),       ts);
            sc(r, 2,  nvl(rec.getVehicleRegNo()), ts);
            sc(r, 3,  nvl(rec.getChannel()),             ts);
            sc(r, 4,  nvl(rec.getSegment()),             ts);
            sc(r, 5,  nvl(rec.getHpaStatus()),           ts);
            sc(r, 6,  rec.getDisbursementDate() != null ? rec.getDisbursementDate().toString() : "", ts);
            sc(r, 7,  nvl(rec.getLoanStatus()),          ts);
            sc(r, 8,  nvl(rec.getCity()),                ts);
            sc(r, 9,  nvl(rec.getState()),               ts);
            sn(r, 10, POCKET_WITH_GST, ns);
            sn(r, 11, POCKET_EX_GST,   ns);
            sn(r, 12, PARTNER_SHARE_ACTUAL, isCancel ? numRed : ns);
            sn(r, 13, NET_COMM_ACTUAL,      ng);
            rn++;
        }
    }

    // ── Style helpers ─────────────────────────────────────────────
    private XSSFColor rgb(String hex) {
        return new XSSFColor(new byte[]{
            (byte) Integer.parseInt(hex.substring(0,2),16),
            (byte) Integer.parseInt(hex.substring(2,4),16),
            (byte) Integer.parseInt(hex.substring(4,6),16)
        }, null);
    }

    private CellStyle hdr(XSSFWorkbook wb, String bg, String fg,
                           boolean bold, int sz, HorizontalAlignment ha) {
        XSSFCellStyle st = wb.createCellStyle();
        st.setFillForegroundColor(rgb(bg));
        st.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        st.setAlignment(ha);
        st.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorder(st);
        XSSFFont f = wb.createFont();
        f.setBold(bold); f.setColor(rgb(fg));
        f.setFontHeightInPoints((short) sz); f.setFontName("Arial");
        st.setFont(f);
        return st;
    }

    private CellStyle num(XSSFWorkbook wb, String bg, String fg, boolean bold) {
        XSSFCellStyle st = wb.createCellStyle();
        st.setFillForegroundColor(rgb(bg));
        st.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        st.setAlignment(HorizontalAlignment.RIGHT);
        st.setVerticalAlignment(VerticalAlignment.CENTER);
        st.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));
        setBorder(st);
        XSSFFont f = wb.createFont();
        f.setBold(bold); f.setColor(rgb(fg));
        f.setFontHeightInPoints((short) 9); f.setFontName("Arial");
        st.setFont(f);
        return st;
    }

    private void setBorder(XSSFCellStyle st) {
        st.setBorderBottom(BorderStyle.THIN); st.setBorderTop(BorderStyle.THIN);
        st.setBorderLeft(BorderStyle.THIN);   st.setBorderRight(BorderStyle.THIN);
    }

    private void sc(Row row, int col, String val, CellStyle st) {
        Cell c = row.createCell(col);
        c.setCellValue(val != null ? val : "");
        if (st != null) c.setCellStyle(st);
    }

    private void sn(Row row, int col, double val, CellStyle st) {
        Cell c = row.createCell(col);
        c.setCellValue(val);
        if (st != null) c.setCellStyle(st);
    }

    private String nvl(String s) { return s != null ? s : ""; }
}
