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

        String[] headers = {"Loan ID","Customer","Vehicle No","Segment","Channel",
                "HPA Status","Disb Date","Cancel Date","Loan Status","Status",
                "City","State","Net Disbursal","Car Finance","Total Loan",
                "Tenure","LI Charges","MI Charges","Insurance Plan"};
        Row hRow = ws.createRow(0);
        for (int i=0;i<headers.length;i++) { Cell c=hRow.createCell(i); c.setCellValue(headers[i]); c.setCellStyle(hdrSt); }

        int r = 1;
        for (DisbursalRecord rec : records) {
            Row row = ws.createRow(r++);
            setT(row,0,rec.getLoanApplicationId(),txtSt);
            setT(row,1,rec.getCustomerName(),txtSt);
            setT(row,2,rec.getVehicleRegNo(),txtSt);
            setT(row,3,rec.getSegment(),txtSt);
            setT(row,4,rec.getChannel(),txtSt);
            setT(row,5,rec.getHpaStatus(),txtSt);
            setT(row,6,d2s(rec.getDisbursementDate()),txtSt);
            setT(row,7,d2s(rec.getCancellationDate()),txtSt);
            setT(row,8,rec.getLoanStatus(),txtSt);
            setT(row,9,rec.getStatus(),txtSt);
            setT(row,10,rec.getCity(),txtSt);
            setT(row,11,rec.getState(),txtSt);
            setN(row,12,rec.getNetDisbursalAmount(),numSt);
            setN(row,13,rec.getCarFinanceAmount(),numSt);
            setN(row,14,rec.getTotalLoanAmount(),numSt);
            setT(row,15,rec.getTenureMonths()!=null?rec.getTenureMonths().toString():"",txtSt);
            setN(row,16,rec.getLiCharges(),numSt);
            setN(row,17,rec.getMiCharges(),numSt);
            setT(row,18,rec.getInsurancePlan(),txtSt);
        }
        for (int i=0;i<headers.length;i++) ws.autoSizeColumn(i);
        ws.setAutoFilter(new CellRangeAddress(0,0,0,headers.length-1));
        ws.createFreezePane(0,1);
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
}