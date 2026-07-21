package com.Finx24.disbursal.service;

import com.Finx24.disbursal.dto.DisbursalDashboardResponse;
import com.Finx24.disbursal.dto.DisbursalUploadResponse;
import com.Finx24.disbursal.entity.DisbursalRecord;
import com.Finx24.disbursal.repository.DisbursalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DisbursalServiceImpl implements DisbursalService {

    private final DisbursalRepository repo;

    private static final String STATUS_SAME_MONTH = "Same Month Cancellation";
    private static final String STATUS_OLD_MONTH  = "Old Month Cancellation";
    private static final String LOAN_ACTIVE       = "Active";    // Excel stores "Active"
    private static final String LOAN_CANCELLED    = "Cancelled"; // Excel stores "Cancelled"

    // ─────────────────────────────────────────────────────────────
    //  UPLOAD
    // ─────────────────────────────────────────────────────────────
    @Override
    @Transactional
    public DisbursalUploadResponse upload(MultipartFile file, String uploadedBy) throws IOException {

        Workbook wb    = WorkbookFactory.create(file.getInputStream());
        Sheet    sheet = wb.getSheetAt(0);

        // ── Find header row (scan first 10 rows for LOAN_APPLICATION_ID) ──
        Row hdr = null;
        for (int i = 0; i <= Math.min(10, sheet.getLastRowNum()); i++) {
            Row r = sheet.getRow(i);
            if (r == null) continue;
            if ("LOAN_APPLICATION_ID".equalsIgnoreCase(cellToString(r.getCell(0)).trim())) {
                hdr = r; break;
            }
        }
        if (hdr == null) throw new IllegalArgumentException("Header row not found (LOAN_APPLICATION_ID expected in col A)");

        // Build column index map
        Map<String, Integer> colIdx = new HashMap<>();
        for (int i = 0; i <= hdr.getLastCellNum(); i++) {
            Cell c = hdr.getCell(i); if (c == null) continue;
            String name = cellToString(c).trim().toUpperCase();
            if (!name.isEmpty() && !name.startsWith("UNNAMED")) colIdx.put(name, i);
        }
        log.info("[Disbursal] Upload by={} file={} headers={}", uploadedBy, file.getOriginalFilename(), colIdx.size());

        int inserted = 0, updated = 0, cancelled = 0;
        LocalDate minDate = null, maxDate = null;
        int headerRow = hdr.getRowNum();

        for (int r = headerRow + 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r); if (row == null) continue;

            String loanId = str(row, colIdx, "LOAN_APPLICATION_ID");
            if (loanId == null || loanId.isBlank()) continue;

            // Read cancel date — try both column name variants
            LocalDate cancelDate = date(row, colIdx, "CANCELLATION_DATE");
            if (cancelDate == null) cancelDate = date(row, colIdx, "LOAN_CANCELLATION_DATE");

            LocalDate disbDate = date(row, colIdx, "DISBURSEMENT_DATE");

            // ── Determine if this is an Old Month Cancellation update ──
            // Old Month Cancel = cancelDate present AND disbDate is from a previous month
            boolean isOldMonthCancel = cancelDate != null && disbDate != null
                    && disbDate.getMonthValue() != cancelDate.getMonthValue()
                    && disbDate.getYear()       != cancelDate.getYear()
                    || (cancelDate != null && disbDate != null && (
                        disbDate.getYear()  < cancelDate.getYear() ||
                        (disbDate.getYear() == cancelDate.getYear() && disbDate.getMonthValue() < cancelDate.getMonthValue())
                    ));

            if (isOldMonthCancel && repo.existsById(loanId)) {
                // Update existing record — add cancel date only
                int rows = repo.markAsCancelled(loanId, cancelDate);
                if (rows > 0) { cancelled++; continue; }
            }

            // ── Upsert record as-is (store raw data) ──────────────────
            boolean exists  = repo.existsById(loanId);
            DisbursalRecord record = buildRecord(row, colIdx, uploadedBy);
            record.setCancellationDate(cancelDate); // ensure both column name variants are handled

            repo.save(record);
            if (exists) updated++; else inserted++;

            if (disbDate != null) {
                if (minDate == null || disbDate.isBefore(minDate)) minDate = disbDate;
                if (maxDate == null || disbDate.isAfter(maxDate))  maxDate = disbDate;
            }
        }
        wb.close();
        log.info("[Disbursal] Done: inserted={} updated={} cancelled={}", inserted, updated, cancelled);

        return DisbursalUploadResponse.builder()
                .fileName(file.getOriginalFilename())
                .totalRows(inserted + updated + cancelled)
                .insertedRows(inserted).updatedRows(updated).cancelledRows(cancelled)
                .periodFrom(minDate).periodTo(maxDate)
                .uploadedAt(LocalDateTime.now())
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    //  DASHBOARD — 3-bucket logic
    // ─────────────────────────────────────────────────────────────
    @Override
    public DisbursalDashboardResponse getDashboard(LocalDate from, LocalDate to) {

        // Fetch ALL records relevant to period:
        //   disbDate IN period  OR  cancelDate IN period
        List<DisbursalRecord> records = repo.findForPeriod(from, to);

        long   activeCnt = 0, sameMonthCnt = 0, oldMonthCnt = 0, liChargesCnt = 0;
        double liNetDisbursal = 0;  // sum of NET_DISBURSAL_AMOUNT where LI_CHARGES > 0
        double netAmount = 0, cancelAmount  = 0;
        double liCharges = 0, miCharges     = 0;
        double totalNet  = 0; // for average calculation

        Map<String, long[]> bySegment = new LinkedHashMap<>();
        Map<String, long[]> byChannel = new LinkedHashMap<>();
        Map<String, long[]> byCity    = new LinkedHashMap<>();
        Map<String, long[]> byHpa     = new LinkedHashMap<>();
        Map<String, double[]> byDate  = new TreeMap<>();
        List<DisbursalRecord> activeRecords = new ArrayList<>(); // for Top 20 by gross loan amount

        for (DisbursalRecord r : records) {

            // ── Pure date-based bucket logic ──────────────────────
            // Active     : disbDate IN period, cancelDate NULL or AFTER period
            // Same Period: disbDate IN period, cancelDate IN period
            // Old Month  : cancelDate IN period, disbDate BEFORE period

            boolean disbInPeriod = r.getDisbursementDate() != null
                    && !r.getDisbursementDate().isBefore(from)
                    && !r.getDisbursementDate().isAfter(to);

            boolean cancelInPeriod = r.getCancellationDate() != null
                    && !r.getCancellationDate().isBefore(from)
                    && !r.getCancellationDate().isAfter(to);

            double net = val(r.getNetDisbursalAmount());
            double li  = val(r.getLiCharges());
            double mi  = val(r.getMiCharges());

            if (disbInPeriod && !cancelInPeriod) {
                // BUCKET 1: Active
                activeCnt++;
                activeRecords.add(r);
                if (li > 0) {
                    liChargesCnt++;
                    liNetDisbursal += net;
                }
                netAmount += net;
                liCharges += li;
                miCharges += mi;
                addBd(bySegment, r.getSegment(),   net);
                addBd(byChannel, r.getChannel(),   net);
                addBd(byCity,    r.getCity(),      net);
                addBd(byHpa,     r.getHpaStatus(), net);
                addDate(byDate,  r.getDisbursementDate(), net);

            } else if (disbInPeriod && cancelInPeriod) {
                // BUCKET 2: Same Period Cancel → 0 impact
                sameMonthCnt++;
                addDate(byDate, r.getDisbursementDate(), 0); // show in trend but 0 amount

            } else if (!disbInPeriod && cancelInPeriod) {
                // BUCKET 3: Old Month Cancel → -ve
                oldMonthCnt++;
                cancelAmount += net;
                netAmount    -= net;
                liCharges    -= li;
                miCharges    -= mi;
            }
        }

        // Average loan per lead
        double avgLoanPerLead = activeCnt > 0
                ? round(netAmount / activeCnt)
                : 0;

        // Loan Book grouping (CARS24 / BAJAJ / PMax)
        Map<String, long[]> byLoanBook = new LinkedHashMap<>();
        byLoanBook.put("CARS24 Book",     new long[]{0,0});
        byLoanBook.put("Bajaj Colending", new long[]{0,0});
        byLoanBook.put("PMax Book",       new long[]{0,0});
        for (Map.Entry<String, long[]> e : byHpa.entrySet()) {
            String hpa  = e.getKey() != null ? e.getKey().toUpperCase().trim() : "";
            String book = hpa.equals("CARS24") ? "CARS24 Book"
                        : hpa.equals("BAJAJ")  ? "Bajaj Colending"
                        : "PMax Book";
            byLoanBook.get(book)[0] += e.getValue()[0];
            byLoanBook.get(book)[1] += e.getValue()[1];
        }

        // Top 20 active loans by GROSS loan amount (TOTAL_LOAN_AMOUNT)
        List<Map<String, Object>> topLoans = activeRecords.stream()
                .sorted((a, b) -> Double.compare(val(b.getTotalLoanAmount()), val(a.getTotalLoanAmount())))
                .limit(20)
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("loanId",        nvl(r.getLoanApplicationId()));
                    m.put("customer",      nvl(r.getCustomerName()));
                    m.put("segment",       nvl(r.getSegment()));
                    m.put("channel",       nvl(r.getChannel()));
                    m.put("city",          nvl(r.getCity()));
                    m.put("disbDate",      r.getDisbursementDate() != null ? r.getDisbursementDate().toString() : "");
                    m.put("grossAmount",   val(r.getTotalLoanAmount()));
                    m.put("netDisbursal",  val(r.getNetDisbursalAmount()));
                    m.put("liCharges",     val(r.getLiCharges()));
                    m.put("miCharges",     val(r.getMiCharges()));
                    return m;
                })
                .collect(java.util.stream.Collectors.toList());

        return DisbursalDashboardResponse.builder()
                .periodFrom(from).periodTo(to)
                .netLoanCount(activeCnt - oldMonthCnt)
                .activeLoans(activeCnt)
                .sameMonthCancellations(sameMonthCnt)
                .oldMonthCancellations(oldMonthCnt)
                .netDisbursalAmount(round(netAmount))
                .cancelledAmount(round(cancelAmount))
                .liCharges(round(liCharges))
                .miCharges(round(miCharges))
                .avgLoanPerLead(round(avgLoanPerLead))
                .liChargesLoanCount(liChargesCnt)
                .liNetDisbursalAmount(round(liNetDisbursal))
                .bySegment(toList(bySegment))
                .byChannel(toList(byChannel))
                .byLoanBook(toList(byLoanBook))
                .topCities(toList(byCity))
                .dailyTrend(toDailyList(byDate))
                .topLoans(topLoans)
                .availableMonths(repo.findAvailableMonths())
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    //  AVAILABLE MONTHS
    // ─────────────────────────────────────────────────────────────
    @Override
    public List<Map<String, Object>> getAvailableMonths() {
        return repo.findAvailableMonths();
    }

    // ─────────────────────────────────────────────────────────────
    //  EXPORT EXCEL
    // ─────────────────────────────────────────────────────────────
    @Override
    public byte[] exportExcel(LocalDate from, LocalDate to) throws IOException {
        List<DisbursalRecord> all = repo.findForExport(from, to);

        // Split into 3 buckets by date logic
        List<DisbursalRecord> activeList    = new ArrayList<>();
        List<DisbursalRecord> sameMonthList = new ArrayList<>();
        List<DisbursalRecord> oldMonthList  = new ArrayList<>();

        for (DisbursalRecord r : all) {
            boolean disbInPeriod   = r.getDisbursementDate() != null
                    && !r.getDisbursementDate().isBefore(from)
                    && !r.getDisbursementDate().isAfter(to);
            boolean cancelInPeriod = r.getCancellationDate() != null
                    && !r.getCancellationDate().isBefore(from)
                    && !r.getCancellationDate().isAfter(to);

            if (disbInPeriod && !cancelInPeriod)       activeList.add(r);
            else if (disbInPeriod && cancelInPeriod)   sameMonthList.add(r);
            else if (!disbInPeriod && cancelInPeriod)  oldMonthList.add(r);
        }

        XSSFWorkbook wb = new XSSFWorkbook();
        buildExportSheet(wb, "Loan Active",               activeList,    from, to);
        buildExportSheet(wb, "Same Month Cancellation",   sameMonthList, from, to);
        buildExportSheet(wb, "Old Month Cancellation",    oldMonthList,  from, to);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return out.toByteArray();
    }

    private void buildExportSheet(XSSFWorkbook wb, String sheetName,
                                   List<DisbursalRecord> records,
                                   LocalDate from, LocalDate to) {
        XSSFSheet ws = wb.createSheet(sheetName);
        CellStyle hdrSt = hdrStyle(wb);
        CellStyle numSt = numStyle(wb);
        CellStyle txtSt = textStyle(wb);

        // ALL columns — derived from the full field map so every entity field is exported.
        List<String> headers = new ArrayList<>(fullMap(new DisbursalRecord()).keySet());
        Row hRow = ws.createRow(0);
        for (int i = 0; i < headers.size(); i++) {
            Cell c = hRow.createCell(i);
            c.setCellValue(headers.get(i));
            c.setCellStyle(hdrSt);
        }

        int r = 1;
        for (DisbursalRecord rec : records) {
            Row row = ws.createRow(r++);
            Map<String,Object> vals = fullMap(rec);
            int col = 0;
            for (String h : headers) {
                Object v = vals.get(h);
                Cell c = row.createCell(col++);
                if (v instanceof Number) {
                    c.setCellValue(((Number) v).doubleValue());
                    c.setCellStyle(numSt);
                } else {
                    c.setCellValue(v != null ? v.toString() : "");
                    c.setCellStyle(txtSt);
                }
            }
        }
        // Fixed width (autoSize over ~130 cols × many rows is too slow)
        for (int i = 0; i < headers.size(); i++) ws.setColumnWidth(i, 4600);
        ws.setAutoFilter(new CellRangeAddress(0, 0, 0, headers.size() - 1));
        ws.createFreezePane(1, 1); // freeze Loan ID column + header row
    }

    // =============================================================
    //  PRIVATE — Record Builder
    // =============================================================
    private DisbursalRecord buildRecord(Row row, Map<String, Integer> idx, String uploadedBy) {
        return DisbursalRecord.builder()
            .loanApplicationId(str(row,idx,"LOAN_APPLICATION_ID"))
            .customerName(str(row,idx,"CUSTOMER_NAME_01"))
            .vehicleRegNo(str(row,idx,"VEHICLE_REGISTRATION_NUMBER"))
            .segment(str(row,idx,"SEGMENT")).channel(str(row,idx,"CHANNEL"))
            .hpaStatus(str(row,idx,"HPA_STATUS")).dealerCode(str(row,idx,"DEALER_CODE"))
            .disbursementDate(date(row,idx,"DISBURSEMENT_DATE"))
            .cancellationDate(
                    date(row,idx,"CANCELLATION_DATE") != null
                    ? date(row,idx,"CANCELLATION_DATE")
                    : date(row,idx,"LOAN_CANCELLATION_DATE")
                    // null stays null — no disbDate fallback
                )
            .loanStatus(str(row,idx,"LOAN_STATUS")).status(str(row,idx,"STATUS"))
            .city(str(row,idx,"CITY")).pincode(str(row,idx,"PINCODE_01"))
            .state(str(row,idx,"STATE")).cityCode(str(row,idx,"CITY_CODE")).stateCode(str(row,idx,"STATE_CODE"))
            .totalLoanAmount(num(row,idx,"TOTAL_LOAN_AMOUNT"))
            .carFinanceAmount(num(row,idx,"CAR_FINANCE_AMOUNT"))
            .tenureMonths(intVal(row,idx,"TENNURE_IN_MONTHS"))
            .interestRate(num(row,idx,"INTEREST_RATE"))
            .netDisbursalAmount(num(row,idx,"NET_DISBURSAL_AMOUNT"))
            .actualDisbursementAmount(num(row,idx,"ACTUAL_DISBURSEMENT_AMOUNT"))
            .lfcActualDisbursementAmount(num(row,idx,"LFC_ACTUAL_DISBURSEMENT_AMOUNT"))
            .directCreditAmount(num(row,idx,"DIRECTCREDITAMOUNT"))
            .dfAmount(num(row,idx,"DF_AMOUNT")).drlNumber(str(row,idx,"DRL_NUMBER"))
            .disbursementAmount(num(row,idx,"DISBURSEMENT AMOUNT"))
            .loanCount(intVal(row,idx,"COUNT"))
            .motorInsuranceType(str(row,idx,"MOTOR_INSURANCE_TYPE"))
            .insurancePlan(str(row,idx,"INSURANCE_PLAN"))
            .liCharges(num(row,idx,"LI_CHARGES")).miCharges(num(row,idx,"MI_CHARGES"))
            .pocketInsuranceCharge(num(row,idx,"POCKET_INSURANCE_CHARGE"))
            .bkawachCharges(num(row,idx,"BKAWACH_CHARGES"))
            .cibilCharges(num(row,idx,"CIBIL_CHARGES"))
            .documentationCharges(num(row,idx,"DOCUMENTATION_CHARGES"))
            .stampCharges(num(row,idx,"STAMP_CHARGES"))
            .rtoCharges(num(row,idx,"RTO_CHARGES"))
            .valuationCharges(num(row,idx,"VALUATION_CHARGES"))
            .chmCharges(num(row,idx,"CHM_CHARGES")).fwrCharges(num(row,idx,"FWR_CHARGES"))
            .pfCharges(num(row,idx,"PF_CHARGES")).abcCharges(num(row,idx,"ABC_CHARGES"))
            .ewCharges(num(row,idx,"EW_CHARGES")).amcCharges(num(row,idx,"AMC_CHARGES"))
            .careplusCharges(num(row,idx,"CAREPLUS_CHARGES")).rsaCharges(num(row,idx,"RSA_CHARGES"))
            .lffCharges(num(row,idx,"LFF_CHARGES")).btLfcCharges(num(row,idx,"BT_LFC_CHARGES"))
            .protektCharges(num(row,idx,"PROTEKT_CHARGES"))
            .protektProCharges(num(row,idx,"PROTEKT_PRO_CHARGES"))
            .protektPlusCharges(num(row,idx,"PROTEKT_PLUS_CHARGES"))
            .flexiPaymentFacilityCharge(num(row,idx,"FLEXI_PAYMENT_FACILITY_CHARGE"))
            .buyerProtectionPlanCharge(num(row,idx,"BUYER_PROTECTION_PLAN_CHARGE"))
            .lifetimeWarrantyCharge(num(row,idx,"LIFETIME_WARRANTY_CHARGE"))
            .partyPeshiHoldback(num(row,idx,"PARTY_PESHI_HOLDBACK"))
            .onlineChallanHoldback(num(row,idx,"ONLINE_CHALLAN_HOLDBACK"))
            .nocHoldback(num(row,idx,"NOC_HOLDBACK"))
            .motorInsuranceHoldback(num(row,idx,"MOTOR_INSURANCE_HOLDBACK"))
            .rtoHoldback(num(row,idx,"RTO_HOLDBACK")).otherHoldback(num(row,idx,"OTHER_HOLDBACK"))
            .offlineChallanHoldback(num(row,idx,"OFFLINE_CHALLAN_HOLDBACK"))
            .partnerHoldback(num(row,idx,"PARTNER_HOLDBACK"))
            .colendingLoanId(str(row,idx,"COLENDING_LOAN_ID")).colendingFlag(str(row,idx,"COLENDING_FLAG"))
            .actualDisbAmount1(num(row,idx,"ACTUAL_DISBURSEMENT_AMOUNT_1"))
            .actualDisbUtr1(str(row,idx,"ACTUAL_DISBURSEMENT_UTR_1"))
            .actualDisbDate1(date(row,idx,"ACTUAL_DISBURSEMENT_DATE_1"))
            .actualPayMode1(str(row,idx,"ACTUAL_PAYMENT_MODE_1"))
            .actualPayStatus1(str(row,idx,"ACTUAL_PAYMENT_STATUS_1"))
            .actualDisbAmount2(num(row,idx,"ACTUAL_DISBURSEMENT_AMOUNT_2"))
            .actualDisbUtr2(str(row,idx,"ACTUAL_DISBURSEMENT_UTR_2"))
            .actualDisbDate2(date(row,idx,"ACTUAL_DISBURSEMENT_DATE_2"))
            .actualPayMode2(str(row,idx,"ACTUAL_PAYMENT_MODE_2"))
            .actualPayStatus2(str(row,idx,"ACTUAL_PAYMENT_STATUS_2"))
            .actualDisbAmount3(num(row,idx,"ACTUAL_DISBURSEMENT_AMOUNT_3"))
            .actualDisbUtr3(str(row,idx,"ACTUAL_DISBURSEMENT_UTR_3"))
            .actualDisbDate3(date(row,idx,"ACTUAL_DISBURSEMENT_DATE_3"))
            .actualPayMode3(str(row,idx,"ACTUAL_PAYMENT_MODE_3"))
            .actualDisbAmount4(num(row,idx,"ACTUAL_DISBURSEMENT_AMOUNT_4"))
            .actualDisbUtr4(str(row,idx,"ACTUAL_DISBURSEMENT_UTR_4"))
            .actualDisbDate4(date(row,idx,"ACTUAL_DISBURSEMENT_DATE_4"))
            .actualPayMode4(str(row,idx,"ACTUAL_PAYMENT_MODE_4"))
            .actualDisbAmount5(num(row,idx,"ACTUAL_DISBURSEMENT_AMOUNT_5"))
            .actualDisbUtr5(str(row,idx,"ACTUAL_DISBURSEMENT_UTR_5"))
            .actualDisbDate5(date(row,idx,"ACTUAL_DISBURSEMENT_DATE_5"))
            .actualPayMode5(str(row,idx,"ACTUAL_PAYMENT_MODE_5"))
            .lfcDisbAmount1(num(row,idx,"LFC_ACTUAL_DISBURSEMENT_AMOUNT_1"))
            .lfcDisbUtr1(str(row,idx,"LFC_ACTUAL_DISBURSEMENT_UTR_1"))
            .lfcDisbDate1(date(row,idx,"LFC_ACTUAL_DISBURSEMENT_DATE_1"))
            .lfcPayMode1(str(row,idx,"LFC_ACTUAL_PAYMENT_MODE_1"))
            .lfcPayStatus1(str(row,idx,"LFC_ACTUAL_PAYMENT_STATUS_1"))
            .lfcDisbAmount2(num(row,idx,"LFC_ACTUAL_DISBURSEMENT_AMOUNT_2"))
            .lfcDisbUtr2(str(row,idx,"LFC_ACTUAL_DISBURSEMENT_UTR_2"))
            .lfcDisbDate2(date(row,idx,"LFC_ACTUAL_DISBURSEMENT_DATE_2"))
            .lfcPayMode2(str(row,idx,"LFC_ACTUAL_PAYMENT_MODE_2"))
            .lfcPayStatus2(str(row,idx,"LFC_ACTUAL_PAYMENT_STATUS_2"))
            .lfcDisbAmount3(num(row,idx,"LFC_ACTUAL_DISBURSEMENT_AMOUNT_3"))
            .lfcDisbUtr3(str(row,idx,"LFC_ACTUAL_DISBURSEMENT_UTR_3"))
            .lfcDisbDate3(date(row,idx,"LFC_ACTUAL_DISBURSEMENT_DATE_3"))
            .lfcPayMode3(str(row,idx,"LFC_ACTUAL_PAYMENT_MODE_3"))
            .lfcDisbAmount4(num(row,idx,"LFC_ACTUAL_DISBURSEMENT_AMOUNT_4"))
            .lfcDisbUtr4(str(row,idx,"LFC_ACTUAL_DISBURSEMENT_UTR_4"))
            .lfcDisbDate4(date(row,idx,"LFC_ACTUAL_DISBURSEMENT_DATE_4"))
            .lfcPayMode4(str(row,idx,"LFC_ACTUAL_PAYMENT_MODE_4"))
            .pMaxSheetTimestamp(str(row,idx,"P_MAX_SHEET_TIMESTAMP"))
            .pMaxEmailAddress(str(row,idx,"P_MAX_EMAIL_ADDRESS"))
            .pMaxVehicleNumber(str(row,idx,"P_MAX_VEHICLE_NUMBER"))
            .pMaxCarFinanceAmount(num(row,idx,"P_MAX_CAR_FINANCE_AMOUNT"))
            .pmaxxTotalCharges(num(row,idx,"PMAXX_TOTAL_CHARGES"))
            .pmaxxSuraksha(num(row,idx,"PMAXX_SURAKSHA"))
            .pmaxxMi(num(row,idx,"PMAXX_MI"))
            .pmaxxOtherCharges(num(row,idx,"PMAXX_OTHER_CHARGES"))
            .pmaxxPfDocumentsCharges(num(row,idx,"PMAXX_PF_DOCUMENTS_CHARGES"))
            .pMaxSubfinancer(str(row,idx,"P_MAX_SUBFINANCER"))
            .pennantDisbursalDate(date(row,idx,"PENNANT_DISBURSAL_DATE"))
            .pennantFirstEmiAmount(num(row,idx,"PENNANT_FIRST_EMI_AMOUNT"))
            .pennantFirstEmiDate(date(row,idx,"PENNANT_FIRST_EMI_DATE"))
            .pennantEmiAmount(num(row,idx,"PENNANT_EMI_AMOUNT"))
            .amountCheckFlag(str(row,idx,"AMOUNT_CHECK_FLAG"))
            .accountingFlag(str(row,idx,"ACCOUNTING_FLAG"))
            .uploadedBy(uploadedBy)
            .uploadedAt(LocalDateTime.now())
            .build();
    }

    // =============================================================
    //  PRIVATE — Excel builders
    // =============================================================
    private void buildRawSheet(XSSFWorkbook wb, List<DisbursalRecord> records,
                                LocalDate from, LocalDate to) {
        XSSFSheet ws = wb.createSheet("Raw Data");
        CellStyle hs = hdrStyle(wb), ns = numStyle(wb), ts = textStyle(wb);
        CellStyle red = colorRow(wb,"FFE0E0"), grn = colorRow(wb,"D9F0D9"), amb = colorRow(wb,"FFF2CC");

        ws.addMergedRegion(new CellRangeAddress(0,0,0,19));
        Cell t = ws.createRow(0).createCell(0);
        t.setCellValue("Disbursal Report — " + from + " to " + to);
        t.setCellStyle(titleStyle(wb));
        ws.getRow(0).setHeight((short)(35*20));

        String[] headers = {"Loan ID","Customer","Vehicle No","Segment","Channel",
            "HPA Status","Disb Date","Cancel Date","Loan Status","Status",
            "City","State","Net Disbursal","Car Finance","Total Loan",
            "Tenure","LI Charges","MI Charges","Pocket Ins","Colending"};
        Row hr = ws.createRow(1); hr.setHeight((short)(25*20));
        for (int i=0;i<headers.length;i++) { Cell c=hr.createCell(i); c.setCellValue(headers[i]); c.setCellStyle(hs); }

        int rn = 2;
        for (DisbursalRecord r : records) {
            Row row = ws.createRow(rn++);
            CellStyle s = grn;
            if (STATUS_SAME_MONTH.equalsIgnoreCase(r.getStatus())) s = amb;
            if (STATUS_OLD_MONTH.equalsIgnoreCase(r.getStatus()))  s = red;
            setT(row,0,r.getLoanApplicationId(),ts); setT(row,1,r.getCustomerName(),ts);
            setT(row,2,r.getVehicleRegNo(),ts);       setT(row,3,r.getSegment(),ts);
            setT(row,4,r.getChannel(),ts);             setT(row,5,r.getHpaStatus(),ts);
            setT(row,6,d2s(r.getDisbursementDate()),ts); setT(row,7,d2s(r.getCancellationDate()),ts);
            setT(row,8,r.getLoanStatus(),ts);          setT(row,9,r.getStatus(),s);
            setT(row,10,r.getCity(),ts);               setT(row,11,r.getState(),ts);
            setN(row,12,r.getNetDisbursalAmount(),ns); setN(row,13,r.getCarFinanceAmount(),ns);
            setN(row,14,r.getTotalLoanAmount(),ns);
            setT(row,15,r.getTenureMonths()!=null?r.getTenureMonths().toString():"",ts);
            setN(row,16,r.getLiCharges(),ns);          setN(row,17,r.getMiCharges(),ns);
            setN(row,18,r.getPocketInsuranceCharge(),ns); setT(row,19,r.getColendingFlag(),ts);
        }
        for(int i=0;i<headers.length;i++) ws.autoSizeColumn(i);
        ws.setAutoFilter(new CellRangeAddress(1,1,0,headers.length-1));
        ws.createFreezePane(0,2);
    }

    private void buildSummarySheet(XSSFWorkbook wb, DisbursalDashboardResponse d,
                                    LocalDate from, LocalDate to) {
        XSSFSheet ws = wb.createSheet("Summary Dashboard");
        ws.setColumnWidth(0,8000); ws.setColumnWidth(1,5000);
        CellStyle ts=titleStyle(wb), hs=hdrStyle(wb), ns=numStyle(wb);
        int r=0;
        ws.addMergedRegion(new CellRangeAddress(r,r,0,2));
        Cell t = ws.createRow(r++).createCell(0);
        t.setCellValue("Disbursal Dashboard — " + from + " to " + to); t.setCellStyle(ts); r++;
        String[][] kpis = {
            {"Net Loan Count",          String.valueOf(d.getNetLoanCount())},
            {"Active Loans",            String.valueOf(d.getActiveLoans())},
            {"Same Month Cancellations",String.valueOf(d.getSameMonthCancellations())},
            {"Old Month Cancellations", String.valueOf(d.getOldMonthCancellations())},
            {"Net Disbursal Amount",    "₹"+fmt(d.getNetDisbursalAmount())},
            {"LI Charges (Net)",        "₹"+fmt(d.getLiCharges())+" [Active − OldCancel]"},
            {"MI Charges (Net)",        "₹"+fmt(d.getMiCharges())+" [Active − OldCancel]"},
            {"Cancelled Amount (−)",    "₹"+fmt(d.getCancelledAmount())},
        };
        Row kh=ws.createRow(r++);
        kh.createCell(0).setCellValue("KPI"); kh.getCell(0).setCellStyle(hs);
        kh.createCell(1).setCellValue("Value"); kh.getCell(1).setCellStyle(hs);
        for (String[] k : kpis) {
            Row row=ws.createRow(r++); row.setHeight((short)(20*20));
            row.createCell(0).setCellValue(k[0]); row.createCell(1).setCellValue(k[1]);
        }
        r++;
        ws.addMergedRegion(new CellRangeAddress(r,r,0,2));
        Row sh=ws.createRow(r++); sh.createCell(0).setCellValue("Segment Breakdown"); sh.getCell(0).setCellStyle(hs);
        Row shh=ws.createRow(r++);
        shh.createCell(0).setCellValue("Segment"); shh.createCell(1).setCellValue("Count"); shh.createCell(2).setCellValue("Amount (₹)");
        for(int i=0;i<3;i++) shh.getCell(i).setCellStyle(hs);
        for (Map<String,Object> seg : d.getBySegment()) {
            Row row=ws.createRow(r++);
            row.createCell(0).setCellValue(String.valueOf(seg.getOrDefault("key","")));
            row.createCell(1).setCellValue(toLong(seg.get("count")));
            Cell ac=row.createCell(2); ac.setCellValue(toDouble(seg.get("amount"))); ac.setCellStyle(ns);
        }
        ws.createFreezePane(0,1);
    }

    // =============================================================
    //  PRIVATE — Cell readers (handle ALL cell types safely)
    // =============================================================
    private String cellToString(Cell c) {
        if (c == null) return "";
        return switch (c.getCellType()) {
            case STRING  -> c.getStringCellValue().trim();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(c))
                    yield c.getLocalDateTimeCellValue().toLocalDate().toString();
                double d = c.getNumericCellValue();
                yield d == Math.floor(d) && !Double.isInfinite(d)
                        ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(c.getBooleanCellValue());
            case FORMULA -> { try { yield c.getStringCellValue().trim(); }
                catch (Exception e) { try { yield String.valueOf((long)c.getNumericCellValue()); }
                catch (Exception e2) { yield ""; } } }
            default -> "";
        };
    }

    private String str(Row row, Map<String,Integer> idx, String col) {
        Integer i = idx.get(col.toUpperCase());
        if (i == null) return null;
        return cellToString(row.getCell(i));
    }

    private BigDecimal num(Row row, Map<String,Integer> idx, String col) {
        Integer i = idx.get(col.toUpperCase());
        if (i == null) return null;
        Cell c = row.getCell(i);
        if (c == null || c.getCellType() == CellType.BLANK) return null;
        try {
            if (c.getCellType() == CellType.NUMERIC) return BigDecimal.valueOf(c.getNumericCellValue());
            String s = cellToString(c); if (s == null || s.isBlank()) return null;
            return new BigDecimal(s.replaceAll("[^0-9.\\-]",""));
        } catch (Exception e) { return null; }
    }

    private LocalDate date(Row row, Map<String,Integer> idx, String col) {
        Integer i = idx.get(col.toUpperCase());
        if (i == null) return null;
        Cell c = row.getCell(i);
        if (c == null || c.getCellType() == CellType.BLANK) return null;
        try {
            if (c.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(c))
                return c.getLocalDateTimeCellValue().toLocalDate();
            String s = cellToString(c); if (s == null || s.isBlank()) return null;
            for (String fmt : new String[]{"dd-MM-yyyy","yyyy-MM-dd","dd/MM/yyyy","M/d/yyyy","yyyy-MM-dd HH:mm:ss"}) {
                try { return LocalDate.parse(s.length()>10?s.substring(0,10):s, DateTimeFormatter.ofPattern(fmt)); }
                catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Integer intVal(Row row, Map<String,Integer> idx, String col) {
        BigDecimal n = num(row, idx, col); return n != null ? n.intValue() : null;
    }

    // =============================================================
    //  PRIVATE — Aggregation & formatting helpers
    // =============================================================
    private void addBd(Map<String,long[]> m, String k, double a) {
        if(k==null||k.isBlank())k="Unknown";
        m.computeIfAbsent(k,x->new long[]{0,0}); m.get(k)[0]++; m.get(k)[1]+=(long)a;
    }
    private void addDate(Map<String,double[]> m, LocalDate d, double a) {
        if(d==null)return; String k=d.toString();
        m.computeIfAbsent(k,x->new double[]{0,0}); m.get(k)[0]++; m.get(k)[1]+=a;
    }
    private List<Map<String,Object>> toList(Map<String,long[]> m) {
        List<Map<String,Object>> l=new ArrayList<>();
        m.entrySet().stream().sorted((a,b)->Long.compare(b.getValue()[1],a.getValue()[1]))
                .forEach(e->l.add(Map.of("key",e.getKey(),"count",e.getValue()[0],"amount",e.getValue()[1])));
        return l;
    }
    private List<Map<String,Object>> toDailyList(Map<String,double[]> m) {
        List<Map<String,Object>> l=new ArrayList<>();
        m.forEach((dt,v)->l.add(Map.of("date",dt,"count",(long)v[0],"amount",v[1]))); return l;
    }
    private double val(BigDecimal b) { return b != null ? b.doubleValue() : 0; }
    private double round(double v)   { return BigDecimal.valueOf(v).setScale(2,RoundingMode.HALF_UP).doubleValue(); }
    private String fmt(double v)     { return String.format("%,.2f",v); }
    private String d2s(LocalDate d)  { return d != null ? d.toString() : ""; }
    private long toLong(Object o)    { return o==null?0:((Number)o).longValue(); }
    private double toDouble(Object o){ return o==null?0:((Number)o).doubleValue(); }

    // Excel style helpers
    private String s(Object v) { return v != null ? v.toString() : ""; }
    private void setT(Row r,int col,String v,CellStyle s){Cell c=r.createCell(col);c.setCellValue(v!=null?v:"");c.setCellStyle(s);}
    private void setN(Row r,int col,BigDecimal v,CellStyle s){Cell c=r.createCell(col);c.setCellValue(v!=null?v.doubleValue():0);c.setCellStyle(s);}
    private CellStyle titleStyle(XSSFWorkbook wb){CellStyle s=wb.createCellStyle();XSSFFont f=wb.createFont();f.setBold(true);f.setFontHeightInPoints((short)13);s.setFont(f);s.setAlignment(HorizontalAlignment.CENTER);return s;}
    private CellStyle hdrStyle(XSSFWorkbook wb){CellStyle s=wb.createCellStyle();XSSFFont f=wb.createFont();f.setBold(true);f.setColor(new XSSFColor(new byte[]{(byte)255,(byte)255,(byte)255},null));s.setFont(f);s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)31,(byte)63,(byte)100},null));s.setFillPattern(FillPatternType.SOLID_FOREGROUND);s.setAlignment(HorizontalAlignment.CENTER);return s;}
    private CellStyle numStyle(XSSFWorkbook wb){CellStyle s=wb.createCellStyle();s.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));s.setAlignment(HorizontalAlignment.RIGHT);return s;}
    private CellStyle textStyle(XSSFWorkbook wb){CellStyle s=wb.createCellStyle();s.setVerticalAlignment(VerticalAlignment.CENTER);return s;}
    private CellStyle colorRow(XSSFWorkbook wb,String hex){CellStyle s=wb.createCellStyle();byte[] rgb=new byte[]{(byte)Integer.parseInt(hex.substring(0,2),16),(byte)Integer.parseInt(hex.substring(2,4),16),(byte)Integer.parseInt(hex.substring(4,6),16)};s.setFillForegroundColor(new XSSFColor(rgb,null));s.setFillPattern(FillPatternType.SOLID_FOREGROUND);return s;}

    @Override
    public List<Map<String,Object>> getAllForRecon() {
        // Fetch ALL records from DB — no date filter
        // Used by LI recon to replace SAP HANA file + Monthly DR file
        List<DisbursalRecord> all = repo.findAll();
        List<Map<String,Object>> result = new ArrayList<>();

        for (DisbursalRecord r : all) {
            Map<String,Object> m = new LinkedHashMap<>();
            // SAP HANA equivalent fields
            m.put("loanApplicationId",  r.getLoanApplicationId());
            m.put("liCharges",          r.getLiCharges());
            m.put("disbursementDate",   r.getDisbursementDate() != null
                                            ? r.getDisbursementDate().toString() : "");
            // Loan Status equivalent (from monthly DR)
            m.put("loanStatus",         r.getLoanStatus() != null
                                            ? r.getLoanStatus() : "");
            m.put("cancellationDate",   r.getCancellationDate() != null
                                            ? r.getCancellationDate().toString() : "");
            // Extra fields useful for recon
            m.put("vehicleRegNo",       nvl(r.getVehicleRegNo()));
            m.put("channel",            nvl(r.getChannel()));
            m.put("segment",            nvl(r.getSegment()));
            m.put("customerName",       nvl(r.getCustomerName()));
            result.add(m);
        }
        log.info("[Disbursal] getAllForRecon: {} records", result.size());
        return result;
    }

    private String nvl(String s) { return s != null ? s : ""; }

    // ─────────────────────────────────────────────────────────────
    //  SEARCH — by Loan ID (partial) and/or status → full details
    // ─────────────────────────────────────────────────────────────
    @Override
    public List<Map<String,Object>> searchLoans(String loanId, String status) {
        String lid = (loanId != null && !loanId.isBlank()) ? loanId.trim() : null;
        String st  = (status != null && !status.isBlank()) ? status.trim() : null;
        if (lid == null && st == null) return new ArrayList<>();

        List<DisbursalRecord> found = repo.search(lid, st);
        List<Map<String,Object>> result = new ArrayList<>();
        for (DisbursalRecord r : found) result.add(fullMap(r));
        log.info("[Disbursal] search loanId={} status={} → {} records", lid, st, result.size());
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    //  FULL FIELD MAP — every column of a record (search + export)
    //  Ordered LinkedHashMap; keys are human-readable headers.
    // ─────────────────────────────────────────────────────────────
    private Map<String,Object> fullMap(DisbursalRecord r) {
        Map<String,Object> m = new LinkedHashMap<>();
        m.put("Loan Application ID",           r.getLoanApplicationId());
        m.put("Customer Name",                 r.getCustomerName());
        m.put("Vehicle Registration Number",   r.getVehicleRegNo());
        m.put("Segment",                       r.getSegment());
        m.put("Channel",                       r.getChannel());
        m.put("HPA Status",                    r.getHpaStatus());
        m.put("Dealer Code",                   r.getDealerCode());
        m.put("Disbursement Date",             d2s(r.getDisbursementDate()));
        m.put("Cancellation Date",             d2s(r.getCancellationDate()));
        m.put("Loan Status",                   r.getLoanStatus());
        m.put("Status",                        r.getStatus());
        m.put("City",                          r.getCity());
        m.put("Pincode",                       r.getPincode());
        m.put("State",                         r.getState());
        m.put("City Code",                     r.getCityCode());
        m.put("State Code",                    r.getStateCode());
        m.put("Total Loan Amount",             r.getTotalLoanAmount());
        m.put("Car Finance Amount",            r.getCarFinanceAmount());
        m.put("Tenure (Months)",               r.getTenureMonths());
        m.put("Interest Rate",                 r.getInterestRate());
        m.put("Net Disbursal Amount",          r.getNetDisbursalAmount());
        m.put("Actual Disbursement Amount",    r.getActualDisbursementAmount());
        m.put("LFC Actual Disbursement Amount",r.getLfcActualDisbursementAmount());
        m.put("Direct Credit Amount",          r.getDirectCreditAmount());
        m.put("DF Amount",                     r.getDfAmount());
        m.put("DRL Number",                    r.getDrlNumber());
        m.put("Disbursement Amount",           r.getDisbursementAmount());
        m.put("Loan Count",                    r.getLoanCount());
        m.put("Motor Insurance Type",          r.getMotorInsuranceType());
        m.put("Insurance Plan",                r.getInsurancePlan());
        m.put("LI Charges",                    r.getLiCharges());
        m.put("MI Charges",                    r.getMiCharges());
        m.put("Pocket Insurance Charge",       r.getPocketInsuranceCharge());
        m.put("BKawach Charges",               r.getBkawachCharges());
        m.put("CIBIL Charges",                 r.getCibilCharges());
        m.put("Documentation Charges",         r.getDocumentationCharges());
        m.put("Stamp Charges",                 r.getStampCharges());
        m.put("RTO Charges",                   r.getRtoCharges());
        m.put("Valuation Charges",             r.getValuationCharges());
        m.put("CHM Charges",                   r.getChmCharges());
        m.put("FWR Charges",                   r.getFwrCharges());
        m.put("PF Charges",                    r.getPfCharges());
        m.put("ABC Charges",                   r.getAbcCharges());
        m.put("EW Charges",                    r.getEwCharges());
        m.put("AMC Charges",                   r.getAmcCharges());
        m.put("Careplus Charges",              r.getCareplusCharges());
        m.put("RSA Charges",                   r.getRsaCharges());
        m.put("LFF Charges",                   r.getLffCharges());
        m.put("BT LFC Charges",                r.getBtLfcCharges());
        m.put("Protekt Charges",               r.getProtektCharges());
        m.put("Protekt Pro Charges",           r.getProtektProCharges());
        m.put("Protekt Plus Charges",          r.getProtektPlusCharges());
        m.put("Flexi Payment Facility Charge", r.getFlexiPaymentFacilityCharge());
        m.put("Buyer Protection Plan Charge",  r.getBuyerProtectionPlanCharge());
        m.put("Lifetime Warranty Charge",      r.getLifetimeWarrantyCharge());
        m.put("Party Peshi Holdback",          r.getPartyPeshiHoldback());
        m.put("Online Challan Holdback",       r.getOnlineChallanHoldback());
        m.put("NOC Holdback",                  r.getNocHoldback());
        m.put("Motor Insurance Holdback",      r.getMotorInsuranceHoldback());
        m.put("RTO Holdback",                  r.getRtoHoldback());
        m.put("Other Holdback",                r.getOtherHoldback());
        m.put("Offline Challan Holdback",      r.getOfflineChallanHoldback());
        m.put("Partner Holdback",              r.getPartnerHoldback());
        m.put("Colending Loan ID",             r.getColendingLoanId());
        m.put("Colending Flag",                r.getColendingFlag());
        m.put("Actual Disb Amount 1",          r.getActualDisbAmount1());
        m.put("Actual Disb UTR 1",             r.getActualDisbUtr1());
        m.put("Actual Disb Date 1",            d2s(r.getActualDisbDate1()));
        m.put("Actual Payment Mode 1",         r.getActualPayMode1());
        m.put("Actual Payment Status 1",       r.getActualPayStatus1());
        m.put("Actual Disb Amount 2",          r.getActualDisbAmount2());
        m.put("Actual Disb UTR 2",             r.getActualDisbUtr2());
        m.put("Actual Disb Date 2",            d2s(r.getActualDisbDate2()));
        m.put("Actual Payment Mode 2",         r.getActualPayMode2());
        m.put("Actual Payment Status 2",       r.getActualPayStatus2());
        m.put("Actual Disb Amount 3",          r.getActualDisbAmount3());
        m.put("Actual Disb UTR 3",             r.getActualDisbUtr3());
        m.put("Actual Disb Date 3",            d2s(r.getActualDisbDate3()));
        m.put("Actual Payment Mode 3",         r.getActualPayMode3());
        m.put("Actual Payment Status 3",       r.getActualPayStatus3());
        m.put("Actual Disb Amount 4",          r.getActualDisbAmount4());
        m.put("Actual Disb UTR 4",             r.getActualDisbUtr4());
        m.put("Actual Disb Date 4",            d2s(r.getActualDisbDate4()));
        m.put("Actual Payment Mode 4",         r.getActualPayMode4());
        m.put("Actual Payment Status 4",       r.getActualPayStatus4());
        m.put("Actual Disb Amount 5",          r.getActualDisbAmount5());
        m.put("Actual Disb UTR 5",             r.getActualDisbUtr5());
        m.put("Actual Disb Date 5",            d2s(r.getActualDisbDate5()));
        m.put("Actual Payment Mode 5",         r.getActualPayMode5());
        m.put("LFC Disb Amount 1",             r.getLfcDisbAmount1());
        m.put("LFC Disb UTR 1",                r.getLfcDisbUtr1());
        m.put("LFC Disb Date 1",               d2s(r.getLfcDisbDate1()));
        m.put("LFC Payment Mode 1",            r.getLfcPayMode1());
        m.put("LFC Payment Status 1",          r.getLfcPayStatus1());
        m.put("LFC Disb Amount 2",             r.getLfcDisbAmount2());
        m.put("LFC Disb UTR 2",                r.getLfcDisbUtr2());
        m.put("LFC Disb Date 2",               d2s(r.getLfcDisbDate2()));
        m.put("LFC Payment Mode 2",            r.getLfcPayMode2());
        m.put("LFC Payment Status 2",          r.getLfcPayStatus2());
        m.put("LFC Disb Amount 3",             r.getLfcDisbAmount3());
        m.put("LFC Disb UTR 3",                r.getLfcDisbUtr3());
        m.put("LFC Disb Date 3",               d2s(r.getLfcDisbDate3()));
        m.put("LFC Payment Mode 3",            r.getLfcPayMode3());
        m.put("LFC Payment Status 3",          r.getLfcPayStatus3());
        m.put("LFC Disb Amount 4",             r.getLfcDisbAmount4());
        m.put("LFC Disb UTR 4",                r.getLfcDisbUtr4());
        m.put("LFC Disb Date 4",               d2s(r.getLfcDisbDate4()));
        m.put("LFC Payment Mode 4",            r.getLfcPayMode4());
        m.put("LFC Payment Status 4",          r.getLfcPayStatus4());
        m.put("PMax Sheet Timestamp",          r.getPMaxSheetTimestamp());
        m.put("PMax Email Address",            r.getPMaxEmailAddress());
        m.put("PMax Vehicle Number",           r.getPMaxVehicleNumber());
        m.put("PMax Car Finance Amount",       r.getPMaxCarFinanceAmount());
        m.put("PMaxx Total Charges",           r.getPmaxxTotalCharges());
        m.put("PMaxx Suraksha",                r.getPmaxxSuraksha());
        m.put("PMaxx MI",                      r.getPmaxxMi());
        m.put("PMaxx Other Charges",           r.getPmaxxOtherCharges());
        m.put("PMaxx PF Documents Charges",    r.getPmaxxPfDocumentsCharges());
        m.put("PMax Subfinancer",              r.getPMaxSubfinancer());
        m.put("Pennant Disbursal Date",        d2s(r.getPennantDisbursalDate()));
        m.put("Pennant First EMI Amount",      r.getPennantFirstEmiAmount());
        m.put("Pennant First EMI Date",        d2s(r.getPennantFirstEmiDate()));
        m.put("Pennant EMI Amount",            r.getPennantEmiAmount());
        m.put("Amount Check Flag",             r.getAmountCheckFlag());
        m.put("Accounting Flag",               r.getAccountingFlag());
        m.put("Uploaded By",                   r.getUploadedBy());
        m.put("Uploaded At",                   r.getUploadedAt() != null ? r.getUploadedAt().toString() : "");
        m.put("Last Updated At",               r.getLastUpdatedAt() != null ? r.getLastUpdatedAt().toString() : "");
        return m;
    }
}