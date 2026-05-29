package com.Finx24.schedules.loanins.service;

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
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class LiScheduleServiceImpl implements LiScheduleService {

    private final DisbursalRepository repo;

    // Stores totalExpense from last generated float sheet
    private volatile double lastTotalExpense = 0;

    private static final double COMMISSION_RATE = 0.82;
    private static final double GST_RATE        = 1.18;
    private static final String GL_ACCRUED      = "13126048";
    private static final String GL_COMMISSION   = "31120427";

    // Excel column letters helper
    private String col(int idx) {
        StringBuilder sb = new StringBuilder();
        idx++;
        while (idx > 0) {
            int rem = (idx - 1) % 26;
            sb.insert(0, (char)('A' + rem));
            idx = (idx - 1) / 26;
        }
        return sb.toString();
    }

    // ================================================================
    //  MAIN
    // ================================================================
    @Override
    public byte[] generateSchedule(LocalDate from, LocalDate to,
                                   String monthLabel,
                                   MultipartFile floatFile) throws IOException {

        List<DisbursalRecord> activeRecs  = repo.findActiveByPeriod(from, to);
        List<DisbursalRecord> cancelRecs  = repo.findCancellationsByPeriod(from, to);

        log.info("[LI Schedule] {} | Active={} | Cancellations={}",
                monthLabel, activeRecs.size(), cancelRecs.size());

        List<FloatRow> floatRows = parseFloat(floatFile, from, to);
        log.info("[LI Schedule] Float rows for period: {}", floatRows.size());
        // Calculate and store total expense from float
        lastTotalExpense = floatRows.stream()
                .filter(fr -> fr.bookingType != null
                        && fr.bookingType.toLowerCase().contains("rebooking"))
                .mapToDouble(fr -> fr.creditAmt - fr.debitAmt)
                .sum();
        log.info("[LI Schedule] Total expense from float: {}", lastTotalExpense);

        XSSFWorkbook wb = new XSSFWorkbook();

        buildAccrualSheet(wb, monthLabel, activeRecs, cancelRecs);
        buildFloatSheet(wb, monthLabel, floatRows);
        buildActiveSheet(wb, monthLabel, activeRecs);
        buildCancellationSheet(wb, monthLabel, cancelRecs);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return out.toByteArray();
    }

    @Override
    public double getLastTotalExpense() { return lastTotalExpense; }

    // ================================================================
    //  SHEET 1 — Accrual Entry (formula-based)
    // ================================================================
    private void buildAccrualSheet(XSSFWorkbook wb, String monthLabel,
                                   List<DisbursalRecord> activeRecs,
                                   List<DisbursalRecord> cancelRecs) {

        XSSFSheet ws = wb.createSheet("Accrual Entry");
        ws.setColumnWidth(0, 8500); ws.setColumnWidth(1, 3500);
        ws.setColumnWidth(2, 8000); ws.setColumnWidth(3, 5000); ws.setColumnWidth(4, 5000);

        CellStyle titleSt = titleStyle(wb);
        CellStyle hdrSt   = hdrStyle(wb);
        CellStyle numSt   = numStyle(wb);
        CellStyle pctSt   = pctStyle(wb);
        CellStyle boldSt  = boldBorderStyle(wb);
        CellStyle txtSt   = borderStyle(wb);

        // ── Title ─────────────────────────────────────────────────
        ws.addMergedRegion(new CellRangeAddress(0,0,0,4));
        Cell title = ws.createRow(0).createCell(0);
        title.setCellValue("Accrual Entry — Loan Insurance | " + monthLabel);
        title.setCellStyle(titleSt);
        ws.getRow(0).setHeight((short)(28*20));

        // ── Column headers (row 2) ────────────────────────────────
        int r = 2;
        Row h = ws.createRow(r++); h.setHeight((short)(22*20));
        ch(h,0,"Particulars",hdrSt);
        ch(h,1,"Count",hdrSt);
        ch(h,2,"LI (Excluding GST)",hdrSt);
        ch(h,3,"Commission",hdrSt);
        ch(h,4,"Check %",hdrSt);

        // ── LI Schedule source: Active sheet = sheet index 2 ─────
        // Active sheet row 0 has summaries: B1=TotalLI, B3=LIbeforeTax, B5=Commission
        // Cancellation sheet index 3 has same structure
        // We'll reference those sheets with formulas

        // Row: Accrued - LI with Protek
        // References: 'Disbursal Report - Active'!B2 (count), B3 (LI excl), B5 (commission)
        String activeSheet = "'Disbursal Report - Active'";
        String cancelSheet = "'Subsequent Cancellation'";

        Row actR = ws.createRow(r++); actR.setHeight((short)(20*20));
        ct(actR,0,"Accrued - LI with Protek",boldSt);
        // Count = COUNTA of Loan ID column in Active sheet (rows 8 onward)
        actR.createCell(1).setCellFormula("COUNTA(" + activeSheet + "!B8:B10000)");
        actR.getCell(1).setCellStyle(numSt);
        // LI excl GST = Active sheet cell B3
        actR.createCell(2).setCellFormula(activeSheet + "!B3");
        actR.getCell(2).setCellStyle(numSt);
        // Commission = Active sheet cell B5
        actR.createCell(3).setCellFormula(activeSheet + "!B5");
        actR.getCell(3).setCellStyle(numSt);
        actR.createCell(4).setCellValue(COMMISSION_RATE);
        actR.getCell(4).setCellStyle(pctSt);

        // Row blank
        r++;

        // Row: Subsequent Cancellation
        Row canR = ws.createRow(r++); canR.setHeight((short)(20*20));
        ct(canR,0,"Subsequent Cancellation",boldSt);
        canR.createCell(1).setCellFormula("COUNTA(" + cancelSheet + "!B8:B10000)");
        canR.getCell(1).setCellStyle(numSt);
        canR.createCell(2).setCellFormula(cancelSheet + "!B3");
        canR.getCell(2).setCellStyle(numSt);
        canR.createCell(3).setCellFormula(cancelSheet + "!B5");
        canR.getCell(3).setCellStyle(numSt);

        // Row: Net (Active - Cancellation)
        // Row numbers in this sheet: actR = row 4 (1-indexed), canR = row 6
        int actExcelRow = actR.getRowNum() + 1;
        int canExcelRow = canR.getRowNum() + 1;
        Row netR = ws.createRow(r++); netR.setHeight((short)(20*20));
        ct(netR,0,"Net (Active − Cancellation)",boldSt);
        netR.createCell(2).setCellFormula("C" + actExcelRow + "-C" + canExcelRow);
        netR.getCell(2).setCellStyle(numSt);
        netR.createCell(3).setCellFormula("D" + actExcelRow + "-D" + canExcelRow);
        netR.getCell(3).setCellStyle(numSt);
        r++;

        // ── GL Entries ────────────────────────────────────────────
        Row glHdr = ws.createRow(r++); glHdr.setHeight((short)(20*20));
        ch(glHdr,0,"GL Code",hdrSt); ch(glHdr,2,"Particulars",hdrSt);
        ch(glHdr,3,"DR",hdrSt);      ch(glHdr,4,"CR",hdrSt);

        int netExcelRow = netR.getRowNum() + 1;

        Row gl1 = ws.createRow(r++); gl1.setHeight((short)(20*20));
        ct(gl1,0,GL_ACCRUED,txtSt); ct(gl1,2,"Accrued A/c",txtSt);
        gl1.createCell(3).setCellFormula("D" + netExcelRow);
        gl1.getCell(3).setCellStyle(numSt);
        gl1.createCell(4).setCellStyle(numSt);

        Row gl2 = ws.createRow(r++); gl2.setHeight((short)(20*20));
        ct(gl2,0,GL_COMMISSION,txtSt); ct(gl2,2,"To Commission",txtSt);
        gl2.createCell(3).setCellStyle(numSt);
        gl2.createCell(4).setCellFormula("D" + netExcelRow);
        gl2.getCell(4).setCellStyle(numSt);
        r++;

        // ── Channel Breakdown ─────────────────────────────────────
        // Group by channel from in-memory data
        Row brkHdr = ws.createRow(r++); brkHdr.setHeight((short)(20*20));
        ch(brkHdr,0,"Sum of Commission by Channel",hdrSt);
        ch(brkHdr,1,"Total Active",hdrSt);
        ch(brkHdr,2,"Cancellation",hdrSt);
        ch(brkHdr,3,"Net Accrued",hdrSt);

        Map<String,double[]> aByCh = groupByChannel(activeRecs);
        Map<String,double[]> cByCh = groupByChannel(cancelRecs);
        Set<String> channels = new LinkedHashSet<>(aByCh.keySet());
        channels.addAll(cByCh.keySet());

        List<Integer> chanRows = new ArrayList<>();
        for (String ch : channels) {
            double act = round2(aByCh.getOrDefault(ch, new double[]{0})[0]);
            double can = round2(cByCh.getOrDefault(ch, new double[]{0})[0]);
            Row cr = ws.createRow(r++);
            ct(cr,0,ch,txtSt);
            int exRow = cr.getRowNum() + 1;
            cr.createCell(1).setCellValue(act); cr.getCell(1).setCellStyle(numSt);
            cr.createCell(2).setCellValue(can); cr.getCell(2).setCellStyle(numSt);
            cr.createCell(3).setCellFormula("B" + exRow + "-C" + exRow);
            cr.getCell(3).setCellStyle(numSt);
            chanRows.add(exRow);
        }

        // Grand Total row — formula sum
        Row grand = ws.createRow(r++); grand.setHeight((short)(20*20));
        ct(grand,0,"Grand Total",boldSt);
        if (!chanRows.isEmpty()) {
            int firstRow = chanRows.get(0);
            int lastRow  = chanRows.get(chanRows.size()-1);
            grand.createCell(1).setCellFormula("SUM(B" + firstRow + ":B" + lastRow + ")");
            grand.getCell(1).setCellStyle(numSt);
            grand.createCell(2).setCellFormula("SUM(C" + firstRow + ":C" + lastRow + ")");
            grand.getCell(2).setCellStyle(numSt);
            grand.createCell(3).setCellFormula("SUM(D" + firstRow + ":D" + lastRow + ")");
            grand.getCell(3).setCellStyle(numSt);
        }

        ws.createFreezePane(0, 3);
    }

    // ================================================================
    //  SHEET 2 — Go_Digit Float (formula-based summary)
    // ================================================================
    private void buildFloatSheet(XSSFWorkbook wb, String monthLabel,
                                 List<FloatRow> rows) {
        XSSFSheet ws = wb.createSheet("Go_Digit Float");

        CellStyle hdrSt  = hdrStyle(wb);
        CellStyle numSt  = numStyle(wb);
        CellStyle txtSt  = borderStyle(wb);
        CellStyle boldSt = boldBorderStyle(wb);

        int[] widths = {3500,3500,3500,3500,3500,5000,13000,4000,4000,4000,5000,4500};
        for (int i=0;i<widths.length;i++) ws.setColumnWidth(i, widths[i]);

        // Data starts at row 8 in Excel (1-indexed)
        int dataStartExcel = 8;
        int dataEndExcel   = rows.isEmpty() ? dataStartExcel : dataStartExcel + rows.size() - 1;
        boolean hasData    = !rows.isEmpty();

        String creditCol  = "G";
        String debitCol   = "H";
        String bookingCol = "E";
        // Proper Excel range: "E8:E7252" not "E8:7252"
        String bRng = bookingCol + dataStartExcel + ":" + bookingCol + dataEndExcel;
        String cRng = creditCol  + dataStartExcel + ":" + creditCol  + dataEndExcel;
        String dRng = debitCol   + dataStartExcel + ":" + debitCol   + dataEndExcel;


        // ── Summary block (rows 0–3) — formula if data, else 0 ───
        Row s0 = ws.createRow(0); ct(s0,0,"Top Up",boldSt);
        if (hasData) {
            s0.createCell(1).setCellFormula(
                    "SUMIF(" + bRng + ",\"Manual payment slip\"," + cRng + ")"
                            + "+SUMIF(" + bRng + ",\"Online\"," + cRng + ")"
            );
        } else { s0.createCell(1).setCellValue(0); }
        s0.getCell(1).setCellStyle(numSt);

        Row s1 = ws.createRow(1); ct(s1,0,"Cr other than deposit",boldSt);
        if (hasData) {
            s1.createCell(1).setCellFormula("SUM(" + cRng + ")-B1");
        } else { s1.createCell(1).setCellValue(0); }
        s1.getCell(1).setCellStyle(numSt);

        Row s2 = ws.createRow(2); ct(s2,0,"Dr in " + monthLabel,boldSt);
        if (hasData) {
            s2.createCell(1).setCellFormula("SUM(" + dRng + ")");
        } else { s2.createCell(1).setCellValue(0); }
        s2.getCell(1).setCellStyle(numSt);

        Row s3 = ws.createRow(3); ct(s3,0,"Expense during month",boldSt);
        s3.createCell(1).setCellFormula("B2-B3");
        s3.getCell(1).setCellStyle(numSt);

        ws.createRow(4); // blank


        // ── Data header (row 6) ───────────────────────────────────
        ws.createRow(5); // blank separator
        String[] headers = {
                "FLOAT_TYPE","ACCOUNT_MANAGER","IMD_CODE","TRANS_DATE",
                "BOOKING_TYPE","TRANSACTION_DETAILS",
                "CREDIT_AMT","DEBIT_AMT","Expense","BALANCE","POLICY_NUMBER","RECEIPT_NO"
        };
        Row hRow = ws.createRow(6); hRow.setHeight((short)(22*20));
        for (int i=0;i<headers.length;i++) ch(hRow,i,headers[i],hdrSt);

        // ── Data rows ────────────────────────────────────────────
        int r = 7; // 0-indexed = row 8 in Excel
        for (FloatRow fr : rows) {
            Row row = ws.createRow(r);
            int excelRow = r + 1; // 1-indexed

            ct(row,0,fr.floatType,txtSt);
            ct(row,1,fr.accountManager,txtSt);
            ct(row,2,fr.imdCode,txtSt);
            ct(row,3,fr.transDate,txtSt);
            ct(row,4,fr.bookingType,txtSt);
            ct(row,5,fr.transactionDetails,txtSt);

            row.createCell(6).setCellValue(fr.creditAmt); row.getCell(6).setCellStyle(numSt); // CREDIT_AMT
            row.createCell(7).setCellValue(fr.debitAmt);  row.getCell(7).setCellStyle(numSt); // DEBIT_AMT

            // ✅ Expense formula: =IF(E{r}="Rebooking", G{r}-H{r}, 0)
            row.createCell(8).setCellFormula(
                    "IF(E" + excelRow + "=\"Rebooking\",G" + excelRow + "-H" + excelRow + ",0)"
            );
            row.getCell(8).setCellStyle(numSt);

            row.createCell(9).setCellValue(fr.balance);   row.getCell(9).setCellStyle(numSt);
            ct(row,10,fr.policyNumber,txtSt);
            ct(row,11,fr.receiptNo,txtSt);
            r++;
        }

        ws.setAutoFilter(new CellRangeAddress(6,6,0,headers.length-1));
        ws.createFreezePane(0,7);
    }

    // ================================================================
    //  SHEET 3 — Disbursal Report - Active
    // ================================================================
    private void buildActiveSheet(XSSFWorkbook wb, String monthLabel,
                                  List<DisbursalRecord> records) {
        XSSFSheet ws = wb.createSheet("Disbursal Report - Active");
        buildDisbursalSheet(ws, wb, monthLabel, records, true);
    }

    // ================================================================
    //  SHEET 4 — Subsequent Cancellation
    // ================================================================
    private void buildCancellationSheet(XSSFWorkbook wb, String monthLabel,
                                        List<DisbursalRecord> records) {
        XSSFSheet ws = wb.createSheet("Subsequent Cancellation");
        buildDisbursalSheet(ws, wb, monthLabel, records, false);
    }

    // ── Shared builder for Active + Cancellation ──────────────────
    private void buildDisbursalSheet(XSSFSheet ws, XSSFWorkbook wb,
                                     String monthLabel,
                                     List<DisbursalRecord> records,
                                     boolean isActive) {

        CellStyle hdrSt  = hdrStyle(wb);
        CellStyle numSt  = numStyle(wb);
        CellStyle txtSt  = borderStyle(wb);
        CellStyle boldSt = boldBorderStyle(wb);
        CellStyle pctSt  = pctStyle(wb);

        // Data starts at row 7 (0-indexed) = row 8 in Excel
        int dataStartExcel = 8;
        int dataEndExcel   = dataStartExcel + records.size() - 1;

        // Column indices for calculated cols
        // LI_CHARGES is col index 27 (AB in Excel, 0-indexed)
        // After all disbursal cols: Final LI, LI excl GST, Rates, Commission
        String[] disbCols = {
                "Month","LOAN_APPLICATION_ID","CUSTOMER_NAME_01",
                "VEHICLE_REGISTRATION_NUMBER","SEGMENT","CHANNEL","HPA_STATUS","DEALER_CODE",
                "DISBURSEMENT_DATE","LOAN_STATUS","CANCELLATION_DATE","CITY","PINCODE_01","STATE",
                "TOTAL_LOAN_AMOUNT","CAR_FINANCE_AMOUNT","TENNURE_IN_MONTHS","INTEREST_RATE",
                "MOTOR_INSURANCE_TYPE","CIBIL_CHARGES","DOCUMENTATION_CHARGES","CHM_CHARGES",
                "STAMP_CHARGES","VALUATION_CHARGES","FWR_CHARGES","RTO_CHARGES","PF_CHARGES",
                "LI_CHARGES","MI_CHARGES","ABC_CHARGES","EW_CHARGES","AMC_CHARGES",
                "CAREPLUS_CHARGES","RSA_CHARGES","LFF_CHARGES","BT_LFC_CHARGES","PROTEKT_CHARGES",
                "BKAWACH_CHARGES","PROTEKT_PRO_CHARGES","PROTEKT_PLUS_CHARGES",
                "FLEXI_PAYMENT_FACILITY_CHARGE","BUYER_PROTECTION_PLAN_CHARGE",
                "POCKET_INSURANCE_CHARGE","LIFETIME_WARRANTY_CHARGE",
                "PARTY_PESHI_HOLDBACK","ONLINE_CHALLAN_HOLDBACK","NOC_HOLDBACK",
                "MOTOR_INSURANCE_HOLDBACK","RTO_HOLDBACK","OTHER_HOLDBACK",
                "OFFLINE_CHALLAN_HOLDBACK","INSURANCE_PLAN","COLENDING_LOAN_ID",
                "COLENDING_FLAG","NET_DISBURSAL_AMOUNT","STATUS","COUNT"
        };
        int liColIdx     = 27; // LI_CHARGES column (0-indexed)
        int finalLiCol   = disbCols.length;
        int liExclCol    = finalLiCol + 1;
        int ratesCol     = liExclCol + 1;
        int commCol      = ratesCol  + 1;

        // ── Summary rows (0–4) ─────────────────────────────────────
        // These reference the calculated column (Formula-based)
        String liExclColLetter = col(liExclCol);
        String commColLetter   = col(commCol);
        String liColLetter     = col(liColIdx);

        // Summary block — formula-based or hardcoded 0 when no records
        String safeEnd = records.isEmpty() ? String.valueOf(dataStartExcel) : String.valueOf(dataEndExcel);

        String[][] summaryDefs = {
                { isActive ? "Total LI amount - Accrual" : "Total LI amount",
                        records.isEmpty() ? "0" : "SUM(" + liColLetter + dataStartExcel + ":" + liColLetter + safeEnd + ")" },
                { "GST amount (18%)",   records.isEmpty() ? "0" : "B1-B3" },
                { "LI before Tax",      records.isEmpty() ? "0" : "SUM(" + liExclColLetter + dataStartExcel + ":" + liExclColLetter + safeEnd + ")" },
                { "Commission Rate",    String.valueOf(COMMISSION_RATE) },
                { "Total Commission",   records.isEmpty() ? "0" : "SUM(" + commColLetter + dataStartExcel + ":" + commColLetter + safeEnd + ")" },
        };

        for (int i = 0; i < summaryDefs.length; i++) {
            Row row = ws.createRow(i); row.setHeight((short)(20*20));
            ws.setColumnWidth(0,7000); ws.setColumnWidth(1,5000);
            Cell lbl = row.createCell(0); lbl.setCellValue(summaryDefs[i][0]); lbl.setCellStyle(boldSt);
            Cell val = row.createCell(1);
            if (i == 3) {
                val.setCellValue(COMMISSION_RATE);
                val.setCellStyle(pctSt);
            } else if (summaryDefs[i][1].equals("0")) {
                val.setCellValue(0);
                val.setCellStyle(numSt);
            } else {
                val.setCellFormula(summaryDefs[i][1]);
                val.setCellStyle(numSt);
            }
        }

        // Blank row 5
        ws.createRow(5);

        // ── Column headers (row 6) ─────────────────────────────────
        String[] extraCols = isActive
                ? new String[]{"Final LI Charges","LI (Excluding GST)","Rates","Commission","Already Actualized","Remarks"}
                : new String[]{"LI Amount","LI (Excluding GST)","Rates","Commission"};

        Row hRow = ws.createRow(6); hRow.setHeight((short)(22*20));
        int c = 0;
        for (String h : disbCols) ch(hRow, c++, h, hdrSt);
        for (String h : extraCols) ch(hRow, c++, h, hdrSt);

        // ── Data rows (row 7+) ─────────────────────────────────────
        int rn = 7;
        for (DisbursalRecord rec : records) {
            Row row = ws.createRow(rn++);
            int excelRow = rn; // already incremented

            int ci = 0;
            ct(row,ci++,monthLabel,txtSt);
            ct(row,ci++,rec.getLoanApplicationId(),txtSt);
            ct(row,ci++,rec.getCustomerName(),txtSt);
            ct(row,ci++,rec.getVehicleRegNo(),txtSt);
            ct(row,ci++,rec.getSegment(),txtSt);
            ct(row,ci++,rec.getChannel(),txtSt);
            ct(row,ci++,rec.getHpaStatus(),txtSt);
            ct(row,ci++,s(rec.getDealerCode()),txtSt);
            ct(row,ci++,s(rec.getDisbursementDate()),txtSt);
            ct(row,ci++,rec.getLoanStatus(),txtSt);
            ct(row,ci++,s(rec.getCancellationDate()),txtSt);
            ct(row,ci++,rec.getCity(),txtSt);
            ct(row,ci++,rec.getPincode(),txtSt);
            ct(row,ci++,rec.getState(),txtSt);
            ci = setN(row,ci,rec.getTotalLoanAmount(),numSt);
            ci = setN(row,ci,rec.getCarFinanceAmount(),numSt);
            ct(row,ci++,s(rec.getTenureMonths()),txtSt);
            ci = setN(row,ci,rec.getInterestRate(),numSt);
            ct(row,ci++,rec.getMotorInsuranceType(),txtSt);
            ci = setN(row,ci,rec.getCibilCharges(),numSt);
            ci = setN(row,ci,rec.getDocumentationCharges(),numSt);
            ci = setN(row,ci,rec.getChmCharges(),numSt);
            ci = setN(row,ci,rec.getStampCharges(),numSt);
            ci = setN(row,ci,rec.getValuationCharges(),numSt);
            ci = setN(row,ci,rec.getFwrCharges(),numSt);
            ci = setN(row,ci,rec.getRtoCharges(),numSt);
            ci = setN(row,ci,rec.getPfCharges(),numSt);
            ci = setN(row,ci,rec.getLiCharges(),numSt);      // col 27 = LI_CHARGES
            ci = setN(row,ci,rec.getMiCharges(),numSt);
            ci = setN(row,ci,rec.getAbcCharges(),numSt);
            ci = setN(row,ci,rec.getEwCharges(),numSt);
            ci = setN(row,ci,rec.getAmcCharges(),numSt);
            ci = setN(row,ci,rec.getCareplusCharges(),numSt);
            ci = setN(row,ci,rec.getRsaCharges(),numSt);
            ci = setN(row,ci,rec.getLffCharges(),numSt);
            ci = setN(row,ci,rec.getBtLfcCharges(),numSt);
            ci = setN(row,ci,rec.getProtektCharges(),numSt);
            ci = setN(row,ci,rec.getBkawachCharges(),numSt);
            ci = setN(row,ci,rec.getProtektProCharges(),numSt);
            ci = setN(row,ci,rec.getProtektPlusCharges(),numSt);
            ci = setN(row,ci,rec.getFlexiPaymentFacilityCharge(),numSt);
            ci = setN(row,ci,rec.getBuyerProtectionPlanCharge(),numSt);
            ci = setN(row,ci,rec.getPocketInsuranceCharge(),numSt);
            ci = setN(row,ci,rec.getLifetimeWarrantyCharge(),numSt);
            ci = setN(row,ci,rec.getPartyPeshiHoldback(),numSt);
            ci = setN(row,ci,rec.getOnlineChallanHoldback(),numSt);
            ci = setN(row,ci,rec.getNocHoldback(),numSt);
            ci = setN(row,ci,rec.getMotorInsuranceHoldback(),numSt);
            ci = setN(row,ci,rec.getRtoHoldback(),numSt);
            ci = setN(row,ci,rec.getOtherHoldback(),numSt);
            ci = setN(row,ci,rec.getOfflineChallanHoldback(),numSt);
            ct(row,ci++,rec.getInsurancePlan(),txtSt);
            ct(row,ci++,rec.getColendingLoanId(),txtSt);
            ct(row,ci++,rec.getColendingFlag(),txtSt);
            ci = setN(row,ci,rec.getNetDisbursalAmount(),numSt);
            ct(row,ci++,rec.getStatus(),txtSt);
            ct(row,ci++,"1",txtSt);

            // ✅ Calculated columns — ALL formulas
            String liRef = col(liColIdx) + excelRow;  // e.g. AB9

            // Final LI Charges = LI_CHARGES (reference)
            int flCol = ci++;
            row.createCell(flCol).setCellFormula(liRef);
            row.getCell(flCol).setCellStyle(numSt);
            String finalLiRef = col(flCol) + excelRow;

            // LI (Excluding GST) = ROUND(FinalLI / 1.18, 0)
            int exclCol = ci++;
            row.createCell(exclCol).setCellFormula("ROUND(" + finalLiRef + "/1.18,0)");
            row.getCell(exclCol).setCellStyle(numSt);
            String exclRef = col(exclCol) + excelRow;

            // Rates = 0.82
            int rtCol = ci++;
            row.createCell(rtCol).setCellValue(COMMISSION_RATE);
            row.getCell(rtCol).setCellStyle(pctSt);
            String ratesRef = col(rtCol) + excelRow;

            // Commission = ROUND(LI_excl * Rates, 2)
            int cmCol = ci++;
            row.createCell(cmCol).setCellFormula("ROUND(" + exclRef + "*" + ratesRef + ",2)");
            row.getCell(cmCol).setCellStyle(numSt);

            if (isActive) {
                // Already Actualized = 0
                row.createCell(ci++).setCellValue(0);
                row.getCell(ci-1).setCellStyle(numSt);
                // Remarks
                ct(row,ci++,"Accrued",txtSt);
            }
        }

        if (!records.isEmpty()) {
            ws.setAutoFilter(new CellRangeAddress(6,6,0,disbCols.length + extraCols.length - 1));
        }
        ws.createFreezePane(0,7);
    }

    // ================================================================
    //  FLOAT PARSER — filter by TRANS_DATE in period
    // ================================================================
    private List<FloatRow> parseFloat(MultipartFile file,
                                      LocalDate from, LocalDate to) throws IOException {
        List<FloatRow> result = new ArrayList<>();
        Workbook wb = WorkbookFactory.create(file.getInputStream());
        Sheet sheet = wb.getSheetAt(0);

        // Find header row (look for FLOAT_TYPE)
        int hdrIdx = -1;
        for (int i = 0; i <= Math.min(10, sheet.getLastRowNum()); i++) {
            Row r = sheet.getRow(i);
            if (r == null) continue;
            if ("FLOAT_TYPE".equalsIgnoreCase(cellStr(r.getCell(0)))) {
                hdrIdx = i; break;
            }
        }
        if (hdrIdx < 0) { wb.close(); return result; }

        Row hdr = sheet.getRow(hdrIdx);
        Map<String,Integer> ci = new HashMap<>();
        for (int i = 0; i <= hdr.getLastCellNum(); i++) {
            String n = cellStr(hdr.getCell(i)).trim().toUpperCase();
            if (!n.isEmpty()) ci.put(n, i);
        }

        for (int i = hdrIdx+1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String ft = sC(row,ci,"FLOAT_TYPE");
            if (ft == null || ft.isBlank()) continue;

            // Filter by TRANS_DATE
            LocalDate td = parseDate(sC(row,ci,"TRANS_DATE"));
            if (td == null || td.isBefore(from) || td.isAfter(to)) continue;

            FloatRow fr = new FloatRow();
            fr.floatType          = ft;
            fr.accountManager     = sC(row,ci,"ACCOUNT_MANAGER");
            fr.imdCode            = sC(row,ci,"IMD_CODE");
            fr.transDate          = sC(row,ci,"TRANS_DATE");
            fr.bookingType        = sC(row,ci,"BOOKING_TYPE");
            fr.transactionDetails = sC(row,ci,"TRANSACTION_DETAILS");
            fr.creditAmt          = nC(row,ci,"CREDIT_AMT");
            fr.debitAmt           = nC(row,ci,"DEBIT_AMT");
            fr.balance            = nC(row,ci,"BALANCE");
            fr.policyNumber       = sC(row,ci,"POLICY_NUMBER");
            fr.receiptNo          = sC(row,ci,"RECEIPT_NO");
            result.add(fr);
        }
        wb.close();
        return result;
    }

    // ================================================================
    //  HELPERS
    // ================================================================
    private Map<String,double[]> groupByChannel(List<DisbursalRecord> records) {
        Map<String,double[]> map = new LinkedHashMap<>();
        for (DisbursalRecord r : records) {
            double li    = r.getLiCharges() != null ? r.getLiCharges().doubleValue() : 0;
            double excl  = Math.round(li / GST_RATE);
            double comm  = round2(excl * COMMISSION_RATE);
            String ch    = r.getChannel() != null ? r.getChannel() : "Unknown";
            map.merge(ch, new double[]{comm}, (a,b) -> new double[]{a[0]+b[0]});
        }
        return map;
    }

    private String cellStr(Cell c) {
        if (c == null) return "";
        return switch (c.getCellType()) {
            case STRING  -> c.getStringCellValue().trim();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(c))
                    yield c.getLocalDateTimeCellValue().toLocalDate().toString();
                double d = c.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long)d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(c.getBooleanCellValue());
            default -> "";
        };
    }

    private String sC(Row row, Map<String,Integer> ci, String colName) {
        Integer i = ci.get(colName.toUpperCase()); if (i==null) return null;
        return cellStr(row.getCell(i));
    }
    private double nC(Row row, Map<String,Integer> ci, String colName) {
        Integer i = ci.get(colName.toUpperCase()); if (i==null) return 0;
        Cell c = row.getCell(i); if (c==null) return 0;
        try { return c.getCellType()==CellType.NUMERIC ? c.getNumericCellValue()
                : Double.parseDouble(cellStr(c).replaceAll("[^0-9.\\-]","")); }
        catch (Exception e) { return 0; }
    }
    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        String trimmed = s.trim();
        // Handle "Apr 7, 2026" or "Apr 07, 2026" — TRANS_DATE format in Go Digit float
        for (String fmt : new String[]{
                "MMM d, yyyy", "MMM dd, yyyy",
                "MMMM d, yyyy", "MMMM dd, yyyy",
                "dd-MM-yyyy", "yyyy-MM-dd",
                "dd/MM/yyyy", "M/d/yyyy",
                "d-MMM-yyyy", "dd-MMM-yyyy"
        }) {
            try {
                return LocalDate.parse(trimmed,
                        DateTimeFormatter.ofPattern(fmt, java.util.Locale.ENGLISH));
            } catch (DateTimeParseException ignored) {}
        }
        // Last resort: try trimming to 10 chars for datetime strings
        if (trimmed.length() > 10) {
            try {
                return LocalDate.parse(trimmed.substring(0, 10),
                        DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            } catch (DateTimeParseException ignored) {}
        }
        return null;
    }

    private String s(Object v) { return v != null ? v.toString() : ""; }
    private double round2(double v) { return BigDecimal.valueOf(v).setScale(2,RoundingMode.HALF_UP).doubleValue(); }

    // Cell setters
    private void ch(Row r, int c, String v, CellStyle s) { Cell cell=r.createCell(c); cell.setCellValue(v); cell.setCellStyle(s); }
    private void ct(Row r, int c, String v, CellStyle s) { Cell cell=r.createCell(c); cell.setCellValue(v!=null?v:""); cell.setCellStyle(s); }
    private int setN(Row r, int c, BigDecimal v, CellStyle s) { Cell cell=r.createCell(c); cell.setCellValue(v!=null?v.doubleValue():0); cell.setCellStyle(s); return c+1; }

    // Styles
    private CellStyle titleStyle(XSSFWorkbook wb) {
        CellStyle s=wb.createCellStyle(); XSSFFont f=wb.createFont(); f.setBold(true); f.setFontHeightInPoints((short)13);
        f.setColor(new XSSFColor(new byte[]{(byte)255,(byte)255,(byte)255},null)); s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)11,(byte)31,(byte)58},null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.CENTER); s.setVerticalAlignment(VerticalAlignment.CENTER); return s;
    }
    private CellStyle hdrStyle(XSSFWorkbook wb) {
        CellStyle s=wb.createCellStyle(); XSSFFont f=wb.createFont(); f.setBold(true); f.setFontHeightInPoints((short)10);
        f.setColor(new XSSFColor(new byte[]{(byte)255,(byte)255,(byte)255},null)); s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)11,(byte)31,(byte)58},null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.CENTER); setBorders(s); return s;
    }
    private CellStyle numStyle(XSSFWorkbook wb) {
        CellStyle s=wb.createCellStyle(); s.setDataFormat(wb.createDataFormat().getFormat("#,##0.00")); s.setAlignment(HorizontalAlignment.RIGHT); setBorders(s); return s;
    }
    private CellStyle pctStyle(XSSFWorkbook wb) {
        CellStyle s=wb.createCellStyle(); s.setDataFormat(wb.createDataFormat().getFormat("0%")); s.setAlignment(HorizontalAlignment.RIGHT); setBorders(s); return s;
    }
    private CellStyle borderStyle(XSSFWorkbook wb) { CellStyle s=wb.createCellStyle(); s.setVerticalAlignment(VerticalAlignment.CENTER); setBorders(s); return s; }
    private CellStyle boldBorderStyle(XSSFWorkbook wb) {
        CellStyle s=wb.createCellStyle(); XSSFFont f=wb.createFont(); f.setBold(true); s.setFont(f); setBorders(s); s.setVerticalAlignment(VerticalAlignment.CENTER); return s;
    }
    private void setBorders(CellStyle s) {
        s.setBorderTop(BorderStyle.THIN); s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN); s.setBorderRight(BorderStyle.THIN);
    }

    // Inner classes
    private static class FloatRow {
        String floatType,accountManager,imdCode,transDate,bookingType,transactionDetails,policyNumber,receiptNo;
        double creditAmt,debitAmt,balance;
    }
}