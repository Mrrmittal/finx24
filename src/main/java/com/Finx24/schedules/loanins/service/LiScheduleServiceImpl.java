package com.Finx24.schedules.loanins.service;

import com.Finx24.common.exception.BusinessException;
import com.Finx24.disbursal.entity.DisbursalRecord;
import com.Finx24.disbursal.repository.DisbursalRepository;
import com.Finx24.float_register.entity.FloatGoDigitLI;
import com.Finx24.float_register.repository.FloatGoDigitLIRepository;
import com.Finx24.schedules.loanins.entity.LiAccrualActualized;
import com.Finx24.schedules.loanins.entity.LiCommissionFile;
import com.Finx24.schedules.loanins.repository.LiAccrualActualizedRepository;
import com.Finx24.schedules.loanins.repository.LiCommissionFileRepository;
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
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LiScheduleServiceImpl implements LiScheduleService {

    private final DisbursalRepository           repo;
    private final FloatGoDigitLIRepository      floatGoDigitLIRepo;
    private final LiAccrualActualizedRepository accrualRepo;
    private final LiCommissionFileRepository    commissionRepo;

    private static final double COMMISSION_RATE = 0.82;
    private static final double GST_RATE        = 1.18;
    private static final String GL_ACCRUED      = "13126048";
    private static final String GL_COMMISSION   = "31120427";
    private static final String FONT_NAME       = "Aptos";
    private static final short  FONT_SIZE       = 8;

    private final DataFormatter dataFormatter = new DataFormatter();

    private String col(int idx) {
        StringBuilder sb = new StringBuilder();
        idx++;
        while (idx > 0) { int rem = (idx - 1) % 26; sb.insert(0, (char)('A' + rem)); idx = (idx - 1) / 26; }
        return sb.toString();
    }

    // ================================================================
    //  MAIN GENERATE
    // ================================================================
    @Override
    public byte[] generateSchedule(LocalDate from, LocalDate to, String monthLabel) throws IOException {

        List<DisbursalRecord> activeRecs  = repo.findActiveByPeriod(from, to);
        List<DisbursalRecord> cancelRecs  = repo.findCancellationsByPeriod(from, to);

        log.info("[LI Schedule] {} | Active={} | Cancellations={}",
                monthLabel, activeRecs.size(), cancelRecs.size());

        List<FloatRow> floatRows = floatGoDigitLIRepo
                .findByMonthLabelOrderByTransDateAsc(monthLabel)
                .stream().map(this::toFloatRow).collect(Collectors.toList());
        log.info("[LI Schedule] Float rows from DB for {}: {}", monthLabel, floatRows.size());

        XSSFWorkbook wb = new XSSFWorkbook();
        setDefaultFont(wb);

        buildAccrualSheet(wb, monthLabel, activeRecs, cancelRecs);
        buildFloatSheet(wb, monthLabel, floatRows);
        buildActiveSheet(wb, monthLabel, activeRecs);
        buildCancellationSheet(wb, monthLabel, cancelRecs);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();

        saveAccrualEntries(monthLabel, from, to, activeRecs, cancelRecs);
        return out.toByteArray();
    }

    @Override public List<String>               getAccrualMonths()              { return accrualRepo.findDistinctMonths(); }
    @Override public List<LiAccrualActualized>  getAccrualRecords(String month) { return accrualRepo.findByMonthOrderByLoanStatusAscLoanApplicationIdAsc(month); }

    // ================================================================
    //  ACCRUAL TEMPLATE DOWNLOAD
    // ================================================================
    @Override
    public byte[] generateAccrualTemplate() throws IOException {
        XSSFWorkbook wb = new XSSFWorkbook();
        setDefaultFont(wb);
        XSSFSheet ws = wb.createSheet("Accrual Entries");

        String[] cols = {
            "ACCRUAL_MONTH","LOAN_APPLICATION_ID","CUSTOMER_NAME_01",
            "VEHICLE_REGISTRATION_NUMBER","CHANNEL","HPA_STATUS","LOAN_STATUS",
            "ACCRUAL_AMOUNT","INVOICE_AMOUNT","DIFF","STATUS"
        };
        int[] widths = {3000,4000,6000,5500,3500,3000,3000,4000,4000,4000,4500};
        CellStyle hdrSt = hdrStyle(wb);
        CellStyle txtSt = borderStyle(wb);
        CellStyle numSt = numStyle(wb);

        Row hRow = ws.createRow(0); hRow.setHeight((short)(22*20));
        for (int i = 0; i < cols.length; i++) {
            ws.setColumnWidth(i, widths[i]);
            ch(hRow, i, cols[i], hdrSt);
        }

        // One sample row so the user knows the expected format
        Row sRow = ws.createRow(1);
        ct(sRow, 0, "May'26",          txtSt);
        ct(sRow, 1, "LA000001",         txtSt);
        ct(sRow, 2, "Sample Customer",  txtSt);
        ct(sRow, 3, "DL01CAB0001",      txtSt);
        ct(sRow, 4, "Online",           txtSt);
        ct(sRow, 5, "HPA",              txtSt);
        ct(sRow, 6, "Active",           txtSt);
        sRow.createCell(7).setCellValue(1234.56); sRow.getCell(7).setCellStyle(numSt);
        sRow.createCell(8).setCellValue(0);        sRow.getCell(8).setCellStyle(numSt);
        sRow.createCell(9).setCellValue(1234.56);  sRow.getCell(9).setCellStyle(numSt);
        ct(sRow, 10, "Accrued",         txtSt);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out); wb.close();
        return out.toByteArray();
    }

    // ================================================================
    //  MANUAL UPLOAD — upsert into LI_ACCRUAL_ACTUALIZED
    // ================================================================
    @Override
    public Map<String, Integer> processManualUpload(MultipartFile file) throws IOException {
        int inserted = 0, updated = 0;

        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) return buildResult(0, 0);

            Map<String, Integer> colIdx = new HashMap<>();
            for (Cell c : headerRow) {
                String key = dataFormatter.formatCellValue(c).trim().toUpperCase().replace(" ", "_");
                if (!key.isEmpty()) colIdx.put(key, c.getColumnIndex());
            }

            if (!colIdx.containsKey("ACCRUAL_MONTH") || !colIdx.containsKey("LOAN_APPLICATION_ID"))
                throw new IllegalArgumentException(
                    "Template must contain ACCRUAL_MONTH and LOAN_APPLICATION_ID columns");

            List<LiAccrualActualized> toSave = new ArrayList<>();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String month  = cellStr(row.getCell(colIdx.get("ACCRUAL_MONTH")));
                String loanId = cellStr(row.getCell(colIdx.get("LOAN_APPLICATION_ID")));
                if (month == null || loanId == null) continue;

                LiAccrualActualized e = accrualRepo.findByMonthAndLoanApplicationId(month, loanId)
                        .orElse(new LiAccrualActualized());
                boolean isNew = e.getId() == null;

                e.setMonth(month);
                e.setLoanApplicationId(loanId);
                if (colIdx.containsKey("CUSTOMER_NAME_01"))            e.setCustomerName(cellStr(row.getCell(colIdx.get("CUSTOMER_NAME_01"))));
                if (colIdx.containsKey("VEHICLE_REGISTRATION_NUMBER")) e.setVehicleRegistrationNumber(cellStr(row.getCell(colIdx.get("VEHICLE_REGISTRATION_NUMBER"))));
                if (colIdx.containsKey("CHANNEL"))                     e.setChannel(cellStr(row.getCell(colIdx.get("CHANNEL"))));
                if (colIdx.containsKey("HPA_STATUS"))                  e.setHpaStatus(cellStr(row.getCell(colIdx.get("HPA_STATUS"))));
                if (colIdx.containsKey("LOAN_STATUS"))                 e.setLoanStatus(cellStr(row.getCell(colIdx.get("LOAN_STATUS"))));
                if (colIdx.containsKey("ACCRUAL_AMOUNT"))              e.setAccrualAmount(cellBd(row.getCell(colIdx.get("ACCRUAL_AMOUNT"))));
                if (colIdx.containsKey("INVOICE_AMOUNT"))              e.setInvoiceAmount(cellBd(row.getCell(colIdx.get("INVOICE_AMOUNT"))));
                if (colIdx.containsKey("DIFF"))                        e.setDiff(cellBd(row.getCell(colIdx.get("DIFF"))));
                if (colIdx.containsKey("STATUS"))                      e.setStatus(cellStr(row.getCell(colIdx.get("STATUS"))));
                if (e.getCreatedDate() == null)                        e.setCreatedDate(LocalDate.now());

                toSave.add(e);
                if (isNew) inserted++; else updated++;
            }

            accrualRepo.saveAll(toSave);
            log.info("[LI Accrual] Manual upload: inserted={} updated={}", inserted, updated);
        }
        return buildResult(inserted, updated);
    }

    // ================================================================
    //  UPDATE A SINGLE ACCRUAL RECORD (inline edit)
    // ================================================================
    @Override
    public LiAccrualActualized updateAccrualRecord(Long id, Map<String, Object> updates) {
        LiAccrualActualized e = accrualRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Accrual record not found: " + id));

        if (updates.containsKey("invoiceAmount")) {
            Object v = updates.get("invoiceAmount");
            BigDecimal inv = v != null
                    ? new BigDecimal(v.toString()).setScale(2, RoundingMode.HALF_UP) : null;
            e.setInvoiceAmount(inv);
            BigDecimal accrual = e.getAccrualAmount() != null ? e.getAccrualAmount() : BigDecimal.ZERO;
            BigDecimal invVal  = inv != null ? inv : BigDecimal.ZERO;
            e.setDiff(accrual.subtract(invVal).setScale(2, RoundingMode.HALF_UP));
        }
        if (updates.containsKey("status"))        e.setStatus((String) updates.get("status"));
        if (updates.containsKey("customerName"))  e.setCustomerName((String) updates.get("customerName"));
        if (updates.containsKey("channel"))       e.setChannel((String) updates.get("channel"));
        if (updates.containsKey("hpaStatus"))     e.setHpaStatus((String) updates.get("hpaStatus"));
        if (updates.containsKey("loanStatus"))    e.setLoanStatus((String) updates.get("loanStatus"));
        if (updates.containsKey("accrualAmount")) {
            Object v = updates.get("accrualAmount");
            e.setAccrualAmount(v != null
                    ? new BigDecimal(v.toString()).setScale(2, RoundingMode.HALF_UP) : null);
        }
        return accrualRepo.save(e);
    }

    // ================================================================
    //  UPSERT SINGLE ACCRUAL RECORD (JSON form — by month + loanId)
    // ================================================================
    @Override
    public LiAccrualActualized upsertAccrualRecord(Map<String, Object> data) {
        String month  = strVal(data, "month");
        String loanId = strVal(data, "loanApplicationId");
        if (month == null || month.isBlank() || loanId == null || loanId.isBlank())
            throw new IllegalArgumentException("month and loanApplicationId are required");

        LiAccrualActualized e = accrualRepo.findByMonthAndLoanApplicationId(month, loanId)
                .orElse(new LiAccrualActualized());

        e.setMonth(month);
        e.setLoanApplicationId(loanId);
        if (data.containsKey("customerName"))              e.setCustomerName(strVal(data, "customerName"));
        if (data.containsKey("vehicleRegistrationNumber")) e.setVehicleRegistrationNumber(strVal(data, "vehicleRegistrationNumber"));
        if (data.containsKey("channel"))                   e.setChannel(strVal(data, "channel"));
        if (data.containsKey("hpaStatus"))                 e.setHpaStatus(strVal(data, "hpaStatus"));
        if (data.containsKey("loanStatus"))                e.setLoanStatus(strVal(data, "loanStatus"));
        if (data.containsKey("status"))                    e.setStatus(strVal(data, "status"));
        if (data.containsKey("accrualAmount")) {
            Object v = data.get("accrualAmount");
            e.setAccrualAmount(v != null ? new BigDecimal(v.toString()).setScale(2, RoundingMode.HALF_UP) : null);
        }
        if (data.containsKey("invoiceAmount")) {
            Object v   = data.get("invoiceAmount");
            BigDecimal inv = v != null ? new BigDecimal(v.toString()).setScale(2, RoundingMode.HALF_UP) : null;
            e.setInvoiceAmount(inv);
            BigDecimal accrual = e.getAccrualAmount() != null ? e.getAccrualAmount() : BigDecimal.ZERO;
            e.setDiff(accrual.subtract(inv != null ? inv : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        }
        if (e.getCreatedDate() == null) e.setCreatedDate(LocalDate.now());

        return accrualRepo.save(e);
    }

    private String strVal(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v != null ? v.toString().trim() : null;
    }

    // ================================================================
    //  SAVE ACCRUAL ENTRIES TO DB (called after generateSchedule)
    // ================================================================
    private void saveAccrualEntries(String monthLabel, LocalDate from, LocalDate to,
                                    List<DisbursalRecord> activeRecs,
                                    List<DisbursalRecord> cancelRecs) {
        accrualRepo.deleteByMonth(monthLabel);
        List<LiAccrualActualized> entries = new ArrayList<>();

        for (DisbursalRecord r : activeRecs) {
            BigDecimal li = r.getLiCharges() != null ? r.getLiCharges() : BigDecimal.ZERO;
            if (li.compareTo(BigDecimal.ZERO) == 0) continue;
            BigDecimal comm = calcCommission(li);
            LiAccrualActualized e = new LiAccrualActualized();
            e.setMonth(monthLabel); e.setLoanApplicationId(r.getLoanApplicationId());
            e.setCustomerName(r.getCustomerName()); e.setVehicleRegistrationNumber(r.getVehicleRegNo());
            e.setChannel(r.getChannel()); e.setHpaStatus(r.getHpaStatus());
            e.setLoanStatus("Active"); e.setAccrualAmount(comm);
            e.setInvoiceAmount(null); e.setDiff(comm); e.setStatus("Accrued");
            e.setPeriodFrom(from); e.setPeriodTo(to); e.setCreatedDate(LocalDate.now());
            entries.add(e);
        }

        for (DisbursalRecord r : cancelRecs) {
            BigDecimal li = r.getLiCharges() != null ? r.getLiCharges() : BigDecimal.ZERO;
            if (li.compareTo(BigDecimal.ZERO) == 0) continue;
            BigDecimal comm = calcCommission(li).negate();
            LiAccrualActualized e = new LiAccrualActualized();
            e.setMonth(monthLabel); e.setLoanApplicationId(r.getLoanApplicationId());
            e.setCustomerName(r.getCustomerName()); e.setVehicleRegistrationNumber(r.getVehicleRegNo());
            e.setChannel(r.getChannel()); e.setHpaStatus(r.getHpaStatus());
            e.setLoanStatus("Cancelled"); e.setAccrualAmount(comm);
            e.setInvoiceAmount(null); e.setDiff(comm); e.setStatus("Accrued");
            e.setPeriodFrom(from); e.setPeriodTo(to); e.setCreatedDate(LocalDate.now());
            entries.add(e);
        }

        accrualRepo.saveAll(entries);
        log.info("[LI Schedule] Saved {} accrual entries for {}", entries.size(), monthLabel);
    }

    private BigDecimal calcCommission(BigDecimal liCharges) {
        double li   = liCharges.doubleValue();
        double excl = Math.round(li / GST_RATE);
        double comm = Math.round(excl * COMMISSION_RATE * 100.0) / 100.0;
        return BigDecimal.valueOf(comm).setScale(2, RoundingMode.HALF_UP);
    }

    // ================================================================
    //  COMMISSION FILE UPLOAD — parse, store, actualize
    // ================================================================
    @Override
    public Map<String, Integer> processCommissionUpload(
            String accrualMonth,
            MultipartFile commissionFile,
            MultipartFile prFile) throws IOException {

        validateSpreadsheet(prFile,         "PR (Policy Register) file");
        validateSpreadsheet(commissionFile, "Commission file");

        // 1 ── Parse PR file → Map<policyNo → {loanId, vehicleReg}>
        Map<String, String[]> prMap = parsePrFile(prFile);
        log.info("[LI Commission] PR map size: {}", prMap.size());

        // 2 ── Parse commission file and build entities
        int stored = 0, skipped = 0;
        List<LiCommissionFile> rows = new ArrayList<>();

        try (Workbook wb = WorkbookFactory.create(commissionFile.getInputStream())) {
            // Some exports ship a small pivot/summary sheet before the raw-data sheet,
            // so the data sheet isn't always index 0 — scan all sheets for the real header.
            Row headerRow = findHeaderRow(wb, 5);
            if (headerRow == null) return buildResult3(0, 0, 0);
            Sheet sheet = headerRow.getSheet();

            Map<String, Integer> hdr = buildHeaderMap(headerRow);
            log.info("[LI Commission] Header columns found: {}", hdr.size());

            // "Revised" statements sometimes rename the key commission columns
            // (e.g. TOTAL_CD_FINAL → TOTAL_CD_2) — alias them to the canonical name.
            aliasHeader(hdr, "TOTAL_CD_FINAL",   "TOTAL_CD_2");
            aliasHeader(hdr, "TOTAL_RATE_FINAL", "TOTAL_RATE_2");

            for (int i = headerRow.getRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;

                String policyNo = cellStr(row.getCell(hdr.getOrDefault("POLICY_NUMBER", hdr.getOrDefault("POLICY_NO", -1))));
                if (policyNo == null) { skipped++; continue; }

                String[] prEntry = prMap.get(policyNo.trim().toUpperCase());

                LiCommissionFile e = new LiCommissionFile();
                e.setAccrualMonth(accrualMonth);
                e.setPolicyNumber(policyNo);
                e.setUploadDate(LocalDate.now());

                if (prEntry != null) {
                    e.setLoanApplicationId(prEntry[0]);
                    e.setMappedVehicleRegNo(prEntry[1]);
                } else { skipped++; }

                // Map all commission file columns
                setIfPresent(e, row, hdr, "VERSION_NO",           c -> e.setVersionNo(cellStr(c)));
                setIfPresent(e, row, hdr, "ENDORSEMENT_IND",      c -> e.setEndorsementInd(cellStr(c)));
                setIfPresent(e, row, hdr, "POLICY_ISSUE_DATE",     c -> e.setPolicyIssueDate(cellStr(c)));
                setIfPresent(e, row, hdr, "RISK_INC_DATE",         c -> e.setRiskIncDate(cellStr(c)));
                setIfPresent(e, row, hdr, "RISK_EXP_DATE",         c -> e.setRiskExpDate(cellStr(c)));
                setIfPresent(e, row, hdr, "OFFICE_CODE",           c -> e.setOfficeCode(cellStr(c)));
                setIfPresent(e, row, hdr, "OFFICE_NAME",           c -> e.setOfficeName(cellStr(c)));
                setIfPresent(e, row, hdr, "STATE",                 c -> e.setState(cellStr(c)));
                setIfPresent(e, row, hdr, "USER_ID",               c -> e.setUserId(cellStr(c)));
                setIfPresent(e, row, hdr, "IMD_CODE",              c -> e.setImdCode(cellStr(c)));
                setIfPresent(e, row, hdr, "IMD_NAME",              c -> e.setImdName(cellStr(c)));
                setIfPresent(e, row, hdr, "IMD_CHANNEL",           c -> e.setImdChannel(cellStr(c)));
                setIfPresent(e, row, hdr, "IMD_CHANNEL_IRDA",      c -> e.setImdChannelIrda(cellStr(c)));
                setIfPresent(e, row, hdr, "PRODUCT_CODE",          c -> e.setProductCode(cellStr(c)));
                setIfPresent(e, row, hdr, "PRODUCT_NAME",          c -> e.setProductName(cellStr(c)));
                setIfPresent(e, row, hdr, "PRODUCT_LOB",           c -> e.setProductLob(cellStr(c)));
                setIfPresent(e, row, hdr, "VEHICLE_MAKE",          c -> e.setVehicleMake(cellStr(c)));
                setIfPresent(e, row, hdr, "VEHICLE_MODEL",         c -> e.setVehicleModel(cellStr(c)));
                setIfPresent(e, row, hdr, "FUEL_TYPE",             c -> e.setFuelType(cellStr(c)));
                setIfPresent(e, row, hdr, "VEH_REG_NO",            c -> e.setVehRegNo(cellStr(c)));
                setIfPresent(e, row, hdr, "RTO_LOCATION",          c -> e.setRtoLocation(cellStr(c)));
                setIfPresent(e, row, hdr, "VEH_AGE",               c -> e.setVehAge(cellStr(c)));
                setIfPresent(e, row, hdr, "VEH_TYPE",              c -> e.setVehType(cellStr(c)));
                setIfPresent(e, row, hdr, "VEHICLE_SUBTYPE",       c -> e.setVehicleSubtype(cellStr(c)));
                setIfPresent(e, row, hdr, "VEH_USAGE",             c -> e.setVehUsage(cellStr(c)));
                setIfPresent(e, row, hdr, "VEH_WHEELS",            c -> e.setVehWheels(cellStr(c)));
                setIfPresent(e, row, hdr, "VEH_SEATING",           c -> e.setVehSeating(cellStr(c)));
                setIfPresent(e, row, hdr, "VEH_GVW",               c -> e.setVehGvw(cellStr(c)));
                setIfPresent(e, row, hdr, "VEH_CC",                c -> e.setVehCc(cellStr(c)));
                setIfPresent(e, row, hdr, "POLICY_HOLDER",         c -> e.setPolicyHolder(cellStr(c)));
                setIfPresent(e, row, hdr, "PH_PINCODE",            c -> e.setPhPincode(cellStr(c)));
                setIfPresent(e, row, hdr, "OD_PREMIUM",            c -> e.setOdPremium(cellBd(c)));
                setIfPresent(e, row, hdr, "TP_PREMIUM",            c -> e.setTpPremium(cellBd(c)));
                setIfPresent(e, row, hdr, "ADD_ON_PREMIUM",        c -> e.setAddOnPremium(cellBd(c)));
                setIfPresent(e, row, hdr, "SUM_INSURED",           c -> e.setSumInsured(cellBd(c)));
                setIfPresent(e, row, hdr, "NET_PREMIUM",           c -> e.setNetPremium(cellBd(c)));
                setIfPresent(e, row, hdr, "ISSUE_SOURCE",          c -> e.setIssueSource(cellStr(c)));
                setIfPresent(e, row, hdr, "ACCOUNT_MANAGER",       c -> e.setAccountManager(cellStr(c)));
                setIfPresent(e, row, hdr, "PREV_POLICY_EXPIRY",    c -> e.setPrevPolicyExpiry(cellStr(c)));
                setIfPresent(e, row, hdr, "CURR_NCB",              c -> e.setCurrNcb(cellStr(c)));
                setIfPresent(e, row, hdr, "COMM_DISC_RATE",        c -> e.setCommDiscRate(cellBd(c)));
                setIfPresent(e, row, hdr, "COMM_DISC_AMT",         c -> e.setCommDiscAmt(cellBd(c)));
                setIfPresent(e, row, hdr, "ZERO_DEP_COVER",        c -> e.setZeroDepCover(cellBd(c)));
                setIfPresent(e, row, hdr, "TARRIF_PREMIUM",        c -> e.setTarrifPremium(cellBd(c)));
                setIfPresent(e, row, hdr, "VEH_REG_DATE",          c -> e.setVehRegDate(cellStr(c)));
                setIfPresent(e, row, hdr, "TECHNICAL_PREMIUM",     c -> e.setTechnicalPremium(cellBd(c)));
                setIfPresent(e, row, hdr, "CNG_FLAG",              c -> e.setCngFlag(cellStr(c)));
                setIfPresent(e, row, hdr, "SUR_PERS",              c -> e.setSurPers(cellBd(c)));
                setIfPresent(e, row, hdr, "PARTNER_PREFERRED_DISCOUNT", c -> e.setPartnerPreferredDiscount(cellBd(c)));
                setIfPresent(e, row, hdr, "INCREMENTAL_VARIATION", c -> e.setIncrementalVariation(cellBd(c)));
                setIfPresent(e, row, hdr, "OFFICE_GST_NUMBER",     c -> e.setOfficeGstNumber(cellStr(c)));
                setIfPresent(e, row, hdr, "PH_GST_NUMBER",         c -> e.setPhGstNumber(cellStr(c)));
                setIfPresent(e, row, hdr, "VEHICLE_CODE",          c -> e.setVehicleCode(cellStr(c)));
                setIfPresent(e, row, hdr, "OD_PREMIUM_BEFORE_COMMERCIAL_DISCOUNT", c -> e.setOdPremiumBeforeCommDiscount(cellBd(c)));
                setIfPresent(e, row, hdr, "OD_PREMIUM_AT_COMMERCIAL_DISCOUNT",     c -> e.setOdPremiumAtCommDiscount(cellBd(c)));
                setIfPresent(e, row, hdr, "CARRIER_TYPE",          c -> e.setCarrierType(cellStr(c)));
                setIfPresent(e, row, hdr, "NET_PREMIUM_COLL",      c -> e.setNetPremiumColl(cellBd(c)));
                setIfPresent(e, row, hdr, "PRODUCT_PACKAGE",       c -> e.setProductPackage(cellStr(c)));
                setIfPresent(e, row, hdr, "INSURED_PERSON",        c -> e.setInsuredPerson(cellStr(c)));
                setIfPresent(e, row, hdr, "POLICY_TYPE",           c -> e.setPolicyType(cellStr(c)));
                setIfPresent(e, row, hdr, "POLICY_STATUS",         c -> e.setPolicyStatus(cellStr(c)));
                setIfPresent(e, row, hdr, "PREV_INSURER",          c -> e.setPrevInsurer(cellStr(c)));
                setIfPresent(e, row, hdr, "PREV_POLICY_NO",        c -> e.setPrevPolicyNo(cellStr(c)));
                setIfPresent(e, row, hdr, "PREV_NCB",              c -> e.setPrevNcb(cellStr(c)));
                setIfPresent(e, row, hdr, "PA_COVER",              c -> e.setPaCover(cellBd(c)));
                setIfPresent(e, row, hdr, "ENDORSE_REASONS",       c -> e.setEndorseReasons(cellStr(c)));
                setIfPresent(e, row, hdr, "AM_LOCATION",           c -> e.setAmLocation(cellStr(c)));
                setIfPresent(e, row, hdr, "SEGMENT",               c -> e.setSegment(cellStr(c)));
                setIfPresent(e, row, hdr, "FUEL",                  c -> e.setFuelCol(cellStr(c)));
                setIfPresent(e, row, hdr, "RTO",                   c -> e.setRtoCol(cellStr(c)));
                setIfPresent(e, row, hdr, "TOL_VOL",               c -> e.setTolVol(cellBd(c)));
                setIfPresent(e, row, hdr, "TECHNICAL_CD",          c -> e.setTechnicalCd(cellBd(c)));
                setIfPresent(e, row, hdr, "PP_CD",                 c -> e.setPpCd(cellBd(c)));
                setIfPresent(e, row, hdr, "INCREMENTAL_PP_BAC",    c -> e.setIncrementalPpBac(cellBd(c)));
                setIfPresent(e, row, hdr, "ODADDON_PREM",          c -> e.setOdaddonPrem(cellBd(c)));
                setIfPresent(e, row, hdr, "NET_PREM",              c -> e.setNetPrem(cellBd(c)));
                setIfPresent(e, row, hdr, "CAL_ON",                c -> e.setCalOn(cellStr(c)));
                setIfPresent(e, row, hdr, "PREMIUM_FOR_CAL",       c -> e.setPremiumForCal(cellBd(c)));
                setIfPresent(e, row, hdr, "CODE_TYPE",             c -> e.setCodeType(cellStr(c)));
                setIfPresent(e, row, hdr, "PRODUCT_FLAG",          c -> e.setProductFlag(cellStr(c)));
                setIfPresent(e, row, hdr, "REDUCE_IRDA_FLAG",      c -> e.setReduceIrdaFlag(cellStr(c)));
                setIfPresent(e, row, hdr, "PRODUCT_NAME_2",        c -> e.setProductName2(cellStr(c)));
                setIfPresent(e, row, hdr, "TOTAL_CD_FINAL",        c -> e.setTotalCdFinal(cellBd(c)));   // KEY
                setIfPresent(e, row, hdr, "TOTAL_RATE_FINAL",      c -> e.setTotalRateFinal(cellBd(c)));
                setIfPresent(e, row, hdr, "IRDA_TOTAL",            c -> e.setIrdaTotal(cellBd(c)));
                setIfPresent(e, row, hdr, "REWARD_TOTAL",          c -> e.setRewardTotal(cellBd(c)));
                setIfPresent(e, row, hdr, "REMARKS",               c -> e.setRemarks(cellStr(c)));
                setIfPresent(e, row, hdr, "SR_NO",                 c -> e.setSrNo(cellStr(c)));
                setIfPresent(e, row, hdr, "MONTH",                 c -> e.setCommFileMonth(cellStr(c)));
                setIfPresent(e, row, hdr, "TPPD_FLAG",             c -> e.setTppdFlag(cellStr(c)));
                setIfPresent(e, row, hdr, "HYPOTHECATION_FLAG",    c -> e.setHypothecationFlag(cellStr(c)));
                setIfPresent(e, row, hdr, "EMAIL_ID",              c -> e.setEmailId(cellStr(c)));
                setIfPresent(e, row, hdr, "MASTER_POLICY",         c -> e.setMasterPolicy(cellStr(c)));
                setIfPresent(e, row, hdr, "HOLD_FLAG",             c -> e.setHoldFlag(cellStr(c)));
                setIfPresent(e, row, hdr, "SPECIAL_CD_2",          c -> e.setSpecialCd2(cellBd(c)));
                setIfPresent(e, row, hdr, "REASON",                c -> e.setReason(cellStr(c)));
                setIfPresent(e, row, hdr, "CHECK",                 c -> e.setCheckVal(cellStr(c)));
                setIfPresent(e, row, hdr, "LINE_ITEM",             c -> e.setLineItem(cellStr(c)));
                setIfPresent(e, row, hdr, "FLEETID",               c -> e.setFleetId(cellStr(c)));
                setIfPresent(e, row, hdr, "FILE_SPLIT_FLAG",       c -> e.setFileSplitFlag(cellStr(c)));
                setIfPresent(e, row, hdr, "TERRORISOM",            c -> e.setTerrorism(cellBd(c)));
                setIfPresent(e, row, hdr, "IRDA",                  c -> e.setIrdaAmt(cellBd(c)));
                setIfPresent(e, row, hdr, "OTH",                   c -> e.setOth(cellBd(c)));
                setIfPresent(e, row, hdr, "BASE_IRDA",             c -> e.setBaseIrda(cellBd(c)));
                setIfPresent(e, row, hdr, "GST_FLAG",              c -> e.setGstFlag(cellStr(c)));

                rows.add(e);
                stored++;
            }
        }

        // 3 ── Delete previous entries for this month + save new
        commissionRepo.deleteByAccrualMonth(accrualMonth);
        commissionRepo.saveAll(rows);
        log.info("[LI Commission] Stored {} rows for {}", stored, accrualMonth);

        // 4 ── Actualize: sum Total Cd Final per loanApplicationId, then match against
        //      that loan's OLDEST still-outstanding accrual record — regardless of month.
        //      Commission is usually received a month or more after the accrual was
        //      originally booked, so matching must not be scoped to accrualMonth alone.
        int actualized = 0;
        Set<String> loanIdsWithCommission = new HashSet<>();
        List<Object[]> sums = commissionRepo.sumTotalCdFinalByLoanId(accrualMonth);

        // Bulk-fetch every outstanding record for the loan IDs in this batch up front —
        // looping a per-loanId query here was an N+1 scan (no index made it worse) that
        // took minutes once a file had thousands of distinct loan IDs.
        List<String> loanIdsInBatch = sums.stream().map(r -> (String) r[0]).collect(Collectors.toList());
        Map<String, List<LiAccrualActualized>> outstandingByLoan = accrualRepo
                .findByLoanApplicationIdInAndStatusIn(loanIdsInBatch, Arrays.asList("Accrued", "Accrual Carry Forward"))
                .stream()
                .collect(Collectors.groupingBy(LiAccrualActualized::getLoanApplicationId));

        for (Object[] sumRow : sums) {
            String loanId   = (String) sumRow[0];
            loanIdsWithCommission.add(loanId);
            // SQL SUM() returns NULL (not zero) when every row in the group has a null
            // amount — e.g. the commission column wasn't recognized for that upload.
            if (sumRow[1] == null) continue;
            BigDecimal inv  = sumRow[1] instanceof BigDecimal
                    ? (BigDecimal) sumRow[1]
                    : BigDecimal.valueOf(((Number) sumRow[1]).doubleValue());

            List<LiAccrualActualized> outstanding = outstandingByLoan.get(loanId);
            if (outstanding == null || outstanding.isEmpty()) continue;
            outstanding.sort(Comparator.comparing(r -> monthKey(r.getMonth())));

            LiAccrualActualized rec = outstanding.get(0);
            rec.setInvoiceAmount(inv.setScale(2, RoundingMode.HALF_UP));
            BigDecimal accrual = rec.getAccrualAmount() != null ? rec.getAccrualAmount() : BigDecimal.ZERO;
            rec.setDiff(accrual.subtract(inv).setScale(2, RoundingMode.HALF_UP));
            if (inv.compareTo(BigDecimal.ZERO) != 0) {
                rec.setStatus("Actualized");
                actualized++;
            }
            accrualRepo.save(rec);
        }
        log.info("[LI Commission] Actualized {} accrual records for {}", actualized, accrualMonth);

        // 5 ── Any "Accrued" record for this month with no commission match this round → Carry Forward
        int carriedForward = 0;
        for (LiAccrualActualized rec : accrualRepo.findByMonthOrderByLoanStatusAscLoanApplicationIdAsc(accrualMonth)) {
            if ("Accrued".equals(rec.getStatus()) && !loanIdsWithCommission.contains(rec.getLoanApplicationId())) {
                rec.setStatus("Accrual Carry Forward");
                accrualRepo.save(rec);
                carriedForward++;
            }
        }
        log.info("[LI Commission] Carried forward {} accrual records for {}", carriedForward, accrualMonth);

        return buildResult3(stored, actualized, skipped);
    }

    /**
     * Scan every sheet for the first plausible header row (more than minCols non-blank
     * cells, within the first 10 rows). Some exports ship a small pivot/summary sheet
     * ahead of the raw-data sheet, so the real data isn't always at sheet index 0.
     * Counts actual non-blank cells rather than the last cell index, since a single
     * stray value far to the right otherwise trips a false positive.
     */
    private Row findHeaderRow(Workbook wb, int minCols) {
        for (int s = 0; s < wb.getNumberOfSheets(); s++) {
            Sheet sheet = wb.getSheetAt(s);
            for (int i = 0; i <= Math.min(10, sheet.getLastRowNum()); i++) {
                Row row = sheet.getRow(i);
                if (row != null && countNonBlankCells(row) > minCols) return row;
            }
        }
        return null;
    }

    private int countNonBlankCells(Row row) {
        int count = 0;
        for (Cell c : row) {
            if (c != null && c.getCellType() != CellType.BLANK
                    && !dataFormatter.formatCellValue(c).trim().isEmpty()) count++;
        }
        return count;
    }

    private static final List<String> MONTH_ABBR = Arrays.asList(
            "JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC");

    /** Chronological sort key for "May'26" style labels — higher = more recent. */
    private int monthKey(String monthLabel) {
        if (monthLabel == null || !monthLabel.contains("'")) return -1;
        String[] parts = monthLabel.split("'");
        int idx = MONTH_ABBR.indexOf(parts[0].trim().toUpperCase());
        try {
            int yr = Integer.parseInt(parts[1].trim());
            return idx == -1 ? -1 : yr * 12 + idx;
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /** If canonical isn't present but one of the alternates is, alias it to canonical. */
    private void aliasHeader(Map<String, Integer> hdr, String canonical, String... alternates) {
        if (hdr.containsKey(canonical)) return;
        for (String alt : alternates) {
            if (hdr.containsKey(alt)) { hdr.put(canonical, hdr.get(alt)); return; }
        }
    }

    /** Apache POI cannot read .xlsb (binary) workbooks — reject early with a clear message. */
    private void validateSpreadsheet(MultipartFile file, String label) {
        String name = file.getOriginalFilename();
        if (name == null) return;
        String lower = name.toLowerCase();
        if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
            throw BusinessException.badRequest(
                    label + " (\"" + name + "\") must be a .xlsx or .xls file — .xlsb binary " +
                    "workbooks are not supported. Please re-save it as Excel Workbook (.xlsx) and re-upload.",
                    "UNSUPPORTED_FILE_FORMAT");
        }
    }

    /** Parse PR (Policy Register) file → Map<POLICY_NUMBER_UPPER → {loanApplicationId, vehicleRegNo}> */
    private Map<String, String[]> parsePrFile(MultipartFile prFile) throws IOException {
        Map<String, String[]> map = new HashMap<>();
        try (Workbook wb = WorkbookFactory.create(prFile.getInputStream())) {
            Row headerRow = findHeaderRow(wb, 2);
            if (headerRow == null) return map;
            Sheet sheet = headerRow.getSheet();

            Map<String, Integer> hdr = buildHeaderMap(headerRow);

            // Flexible column matching for policy / loan / vehicle
            Integer policyCol = findCol(hdr, "POLICY_NUMBER","POLICY_NO","POLICY_NUM","POLICY");
            Integer loanCol   = findCol(hdr, "LOAN_APPLICATION_ID","LOAN_APP_ID","LOAN_ID",
                                             "APPLICATION_ID","BOOKINGID_PLANID","BOOKING_PLAN_ID",
                                             "BOOKING_ID","LOANAPPLICATIONID");
            Integer vehCol    = findCol(hdr, "VEHICLE_REGISTRATION_NUMBER","VEH_REG_NO",
                                             "VEH_REG","VEHICLE_REG_NO","REGISTRATION_NUMBER");

            if (policyCol == null || loanCol == null) {
                log.warn("[LI Commission] PR file missing policy/loan columns. Headers: {}", hdr.keySet());
                return map;
            }

            for (int i = headerRow.getRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String policyNo = cellStr(row.getCell(policyCol));
                String loanId   = cellStr(row.getCell(loanCol));
                if (policyNo == null || loanId == null) continue;
                String vehReg   = vehCol != null ? cellStr(row.getCell(vehCol)) : null;
                map.put(policyNo.trim().toUpperCase(), new String[]{loanId.trim(), vehReg != null ? vehReg.trim() : ""});
            }
        }
        log.info("[LI Commission] PR file parsed: {} policy-loan mappings", map.size());
        return map;
    }

    /** Normalize a column header → SCREAMING_SNAKE_CASE key */
    private Map<String, Integer> buildHeaderMap(Row headerRow) {
        Map<String, Integer> hdr = new LinkedHashMap<>();
        for (Cell c : headerRow) {
            String raw = dataFormatter.formatCellValue(c).trim();
            if (raw.isEmpty()) continue;
            String key = raw.toUpperCase()
                    .replaceAll("[^A-Z0-9]", "_")
                    .replaceAll("_+", "_")
                    .replaceAll("^_|_$", "");
            hdr.put(key, c.getColumnIndex());
        }
        return hdr;
    }

    /** Find the first matching column key from candidates. */
    private Integer findCol(Map<String, Integer> hdr, String... candidates) {
        for (String c : candidates) if (hdr.containsKey(c)) return hdr.get(c);
        // Partial match fallback
        for (String candidate : candidates) {
            for (Map.Entry<String, Integer> entry : hdr.entrySet()) {
                if (entry.getKey().contains(candidate) || candidate.contains(entry.getKey()))
                    return entry.getValue();
            }
        }
        return null;
    }

    private boolean isRowEmpty(Row row) {
        for (Cell c : row) {
            if (c != null && c.getCellType() != CellType.BLANK
                    && !dataFormatter.formatCellValue(c).trim().isEmpty()) return false;
        }
        return true;
    }

    @FunctionalInterface private interface CellConsumer { void accept(Cell c); }

    private void setIfPresent(LiCommissionFile e, Row row, Map<String, Integer> hdr,
                               String key, CellConsumer setter) {
        Integer idx = hdr.get(key);
        if (idx != null) { try { setter.accept(row.getCell(idx)); } catch (Exception ex) { /* skip bad cell */ } }
    }

    private Map<String, Integer> buildResult3(int stored, int actualized, int skipped) {
        Map<String, Integer> m = new HashMap<>();
        m.put("stored", stored); m.put("actualized", actualized); m.put("skipped", skipped);
        return m;
    }

    // ================================================================
    //  FLOAT — map DB entity → FloatRow
    // ================================================================
    private FloatRow toFloatRow(FloatGoDigitLI e) {
        FloatRow fr = new FloatRow();
        fr.floatType          = e.getFloatType();
        fr.accountManager     = e.getAccountManager();
        fr.imdCode            = e.getImdCode();
        fr.transDate          = e.getTransDate() != null ? e.getTransDate().toString() : "";
        fr.bookingType        = e.getBookingType();
        fr.transactionDetails = e.getTransactionDetails();
        fr.creditAmt          = e.getCreditAmt()  != null ? e.getCreditAmt().doubleValue()  : 0;
        fr.debitAmt           = e.getDebitAmt()   != null ? e.getDebitAmt().doubleValue()   : 0;
        fr.balance            = e.getBalance()    != null ? e.getBalance().doubleValue()    : 0;
        fr.policyNumber       = e.getPolicyNumber();
        fr.receiptNo          = "";
        return fr;
    }

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

        ws.addMergedRegion(new CellRangeAddress(0,0,0,4));
        Cell title = ws.createRow(0).createCell(0);
        title.setCellValue("Accrual Entry — Loan Insurance | " + monthLabel);
        title.setCellStyle(titleSt);
        ws.getRow(0).setHeight((short)(28*20));

        int r = 2;
        Row h = ws.createRow(r++); h.setHeight((short)(22*20));
        ch(h,0,"Particulars",hdrSt); ch(h,1,"Count",hdrSt);
        ch(h,2,"LI (Excluding GST)",hdrSt); ch(h,3,"Commission",hdrSt); ch(h,4,"Check %",hdrSt);

        String activeSheet = "'Disbursal Report - Active'";
        String cancelSheet = "'Subsequent Cancellation'";

        Row actR = ws.createRow(r++); actR.setHeight((short)(20*20));
        ct(actR,0,"Accrued - LI with Protek",boldSt);
        actR.createCell(1).setCellFormula("COUNTA(" + activeSheet + "!B8:B10000)");  actR.getCell(1).setCellStyle(numSt);
        actR.createCell(2).setCellFormula(activeSheet + "!B3");                       actR.getCell(2).setCellStyle(numSt);
        actR.createCell(3).setCellFormula(activeSheet + "!B5");                       actR.getCell(3).setCellStyle(numSt);
        actR.createCell(4).setCellValue(COMMISSION_RATE);                             actR.getCell(4).setCellStyle(pctSt);
        r++;

        Row canR = ws.createRow(r++); canR.setHeight((short)(20*20));
        ct(canR,0,"Subsequent Cancellation",boldSt);
        canR.createCell(1).setCellFormula("COUNTA(" + cancelSheet + "!B8:B10000)"); canR.getCell(1).setCellStyle(numSt);
        canR.createCell(2).setCellFormula(cancelSheet + "!B3");                      canR.getCell(2).setCellStyle(numSt);
        canR.createCell(3).setCellFormula(cancelSheet + "!B5");                      canR.getCell(3).setCellStyle(numSt);

        int actExcelRow = actR.getRowNum() + 1;
        int canExcelRow = canR.getRowNum() + 1;
        Row netR = ws.createRow(r++); netR.setHeight((short)(20*20));
        ct(netR,0,"Net (Active − Cancellation)",boldSt);
        netR.createCell(2).setCellFormula("C" + actExcelRow + "-C" + canExcelRow); netR.getCell(2).setCellStyle(numSt);
        netR.createCell(3).setCellFormula("D" + actExcelRow + "-D" + canExcelRow); netR.getCell(3).setCellStyle(numSt);
        r++;

        Row glHdr = ws.createRow(r++); glHdr.setHeight((short)(20*20));
        ch(glHdr,0,"GL Code",hdrSt); ch(glHdr,2,"Particulars",hdrSt);
        ch(glHdr,3,"DR",hdrSt);      ch(glHdr,4,"CR",hdrSt);

        int netExcelRow = netR.getRowNum() + 1;
        Row gl1 = ws.createRow(r++); gl1.setHeight((short)(20*20));
        ct(gl1,0,GL_ACCRUED,txtSt); ct(gl1,2,"Accrued A/c",txtSt);
        gl1.createCell(3).setCellFormula("D" + netExcelRow); gl1.getCell(3).setCellStyle(numSt);
        gl1.createCell(4).setCellStyle(numSt);

        Row gl2 = ws.createRow(r++); gl2.setHeight((short)(20*20));
        ct(gl2,0,GL_COMMISSION,txtSt); ct(gl2,2,"To Commission",txtSt);
        gl2.createCell(3).setCellStyle(numSt);
        gl2.createCell(4).setCellFormula("D" + netExcelRow); gl2.getCell(4).setCellStyle(numSt);
        r++;

        Row brkHdr = ws.createRow(r++); brkHdr.setHeight((short)(20*20));
        ch(brkHdr,0,"Sum of Commission by Channel",hdrSt); ch(brkHdr,1,"Total Active",hdrSt);
        ch(brkHdr,2,"Cancellation",hdrSt);                 ch(brkHdr,3,"Net Accrued",hdrSt);

        Map<String,double[]> aByCh = groupByChannel(activeRecs);
        Map<String,double[]> cByCh = groupByChannel(cancelRecs);
        Set<String> channels = new LinkedHashSet<>(aByCh.keySet());
        channels.addAll(cByCh.keySet());

        List<Integer> chanRows = new ArrayList<>();
        for (String channel : channels) {
            double act = round2(aByCh.getOrDefault(channel, new double[]{0})[0]);
            double can = round2(cByCh.getOrDefault(channel, new double[]{0})[0]);
            Row cr = ws.createRow(r++);
            ct(cr,0,channel,txtSt);
            int exRow = cr.getRowNum() + 1;
            cr.createCell(1).setCellValue(act); cr.getCell(1).setCellStyle(numSt);
            cr.createCell(2).setCellValue(can); cr.getCell(2).setCellStyle(numSt);
            cr.createCell(3).setCellFormula("B" + exRow + "-C" + exRow); cr.getCell(3).setCellStyle(numSt);
            chanRows.add(exRow);
        }

        Row grand = ws.createRow(r++); grand.setHeight((short)(20*20));
        ct(grand,0,"Grand Total",boldSt);
        if (!chanRows.isEmpty()) {
            int firstRow = chanRows.get(0), lastRow = chanRows.get(chanRows.size()-1);
            grand.createCell(1).setCellFormula("SUM(B" + firstRow + ":B" + lastRow + ")"); grand.getCell(1).setCellStyle(numSt);
            grand.createCell(2).setCellFormula("SUM(C" + firstRow + ":C" + lastRow + ")"); grand.getCell(2).setCellStyle(numSt);
            grand.createCell(3).setCellFormula("SUM(D" + firstRow + ":D" + lastRow + ")"); grand.getCell(3).setCellStyle(numSt);
        }
        ws.createFreezePane(0, 3);
    }

    // ================================================================
    //  SHEET 2 — Go_Digit Float
    // ================================================================
    private void buildFloatSheet(XSSFWorkbook wb, String monthLabel, List<FloatRow> rows) {
        XSSFSheet ws = wb.createSheet("Go_Digit Float");
        CellStyle hdrSt  = hdrStyle(wb);
        CellStyle numSt  = numStyle(wb);
        CellStyle txtSt  = borderStyle(wb);
        CellStyle boldSt = boldBorderStyle(wb);

        int[] widths = {3500,3500,3500,3500,3500,5000,13000,4000,4000,4000,5000,4500};
        for (int i=0;i<widths.length;i++) ws.setColumnWidth(i, widths[i]);

        int dataStartExcel = 8;
        int dataEndExcel   = rows.isEmpty() ? dataStartExcel : dataStartExcel + rows.size() - 1;
        boolean hasData    = !rows.isEmpty();
        String bookingCol  = "E", creditCol = "G", debitCol = "H";
        String bRng = bookingCol + dataStartExcel + ":" + bookingCol + dataEndExcel;
        String cRng = creditCol  + dataStartExcel + ":" + creditCol  + dataEndExcel;
        String dRng = debitCol   + dataStartExcel + ":" + debitCol   + dataEndExcel;

        Row s0 = ws.createRow(0); ct(s0,0,"Top Up",boldSt);
        if (hasData) s0.createCell(1).setCellFormula("SUMIF(" + bRng + ",\"Manual payment slip\"," + cRng + ")+SUMIF(" + bRng + ",\"Online\"," + cRng + ")");
        else s0.createCell(1).setCellValue(0);
        s0.getCell(1).setCellStyle(numSt);

        Row s1 = ws.createRow(1); ct(s1,0,"Cr other than deposit",boldSt);
        if (hasData) s1.createCell(1).setCellFormula("SUM(" + cRng + ")-B1");
        else s1.createCell(1).setCellValue(0);
        s1.getCell(1).setCellStyle(numSt);

        Row s2 = ws.createRow(2); ct(s2,0,"Dr in " + monthLabel,boldSt);
        if (hasData) s2.createCell(1).setCellFormula("SUM(" + dRng + ")");
        else s2.createCell(1).setCellValue(0);
        s2.getCell(1).setCellStyle(numSt);

        Row s3 = ws.createRow(3); ct(s3,0,"Expense during month",boldSt);
        s3.createCell(1).setCellFormula("B2-B3"); s3.getCell(1).setCellStyle(numSt);
        ws.createRow(4); ws.createRow(5);

        String[] headers = {"FLOAT_TYPE","ACCOUNT_MANAGER","IMD_CODE","TRANS_DATE","BOOKING_TYPE",
                "TRANSACTION_DETAILS","CREDIT_AMT","DEBIT_AMT","Expense","BALANCE","POLICY_NUMBER","RECEIPT_NO"};
        Row hRow = ws.createRow(6); hRow.setHeight((short)(22*20));
        for (int i=0;i<headers.length;i++) ch(hRow,i,headers[i],hdrSt);

        int r = 7;
        for (FloatRow fr : rows) {
            Row row = ws.createRow(r); int excelRow = r + 1;
            ct(row,0,fr.floatType,txtSt); ct(row,1,fr.accountManager,txtSt);
            ct(row,2,fr.imdCode,txtSt);   ct(row,3,fr.transDate,txtSt);
            ct(row,4,fr.bookingType,txtSt); ct(row,5,fr.transactionDetails,txtSt);
            row.createCell(6).setCellValue(fr.creditAmt); row.getCell(6).setCellStyle(numSt);
            row.createCell(7).setCellValue(fr.debitAmt);  row.getCell(7).setCellStyle(numSt);
            row.createCell(8).setCellFormula("IF(E" + excelRow + "=\"Rebooking\",G" + excelRow + "-H" + excelRow + ",0)");
            row.getCell(8).setCellStyle(numSt);
            row.createCell(9).setCellValue(fr.balance); row.getCell(9).setCellStyle(numSt);
            ct(row,10,fr.policyNumber,txtSt); ct(row,11,fr.receiptNo,txtSt);
            r++;
        }
        ws.setAutoFilter(new CellRangeAddress(6,6,0,headers.length-1));
        ws.createFreezePane(0,7);
    }

    // ================================================================
    //  SHEET 3 & 4 — Disbursal sheets
    // ================================================================
    private void buildActiveSheet(XSSFWorkbook wb, String monthLabel, List<DisbursalRecord> records) {
        buildDisbursalSheet(wb.createSheet("Disbursal Report - Active"), wb, monthLabel, records, true);
    }
    private void buildCancellationSheet(XSSFWorkbook wb, String monthLabel, List<DisbursalRecord> records) {
        buildDisbursalSheet(wb.createSheet("Subsequent Cancellation"), wb, monthLabel, records, false);
    }

    private void buildDisbursalSheet(XSSFSheet ws, XSSFWorkbook wb, String monthLabel,
                                     List<DisbursalRecord> records, boolean isActive) {

        CellStyle hdrSt  = hdrStyle(wb);
        CellStyle numSt  = numStyle(wb);
        CellStyle txtSt  = borderStyle(wb);
        CellStyle boldSt = boldBorderStyle(wb);
        CellStyle pctSt  = pctStyle(wb);

        int dataStartExcel = 8;
        int dataEndExcel   = dataStartExcel + records.size() - 1;

        String[] disbCols = {
            "Month","LOAN_APPLICATION_ID","CUSTOMER_NAME_01","VEHICLE_REGISTRATION_NUMBER",
            "SEGMENT","CHANNEL","HPA_STATUS","DEALER_CODE","DISBURSEMENT_DATE","LOAN_STATUS",
            "CANCELLATION_DATE","CITY","PINCODE_01","STATE","TOTAL_LOAN_AMOUNT","CAR_FINANCE_AMOUNT",
            "TENNURE_IN_MONTHS","INTEREST_RATE","MOTOR_INSURANCE_TYPE","CIBIL_CHARGES",
            "DOCUMENTATION_CHARGES","CHM_CHARGES","STAMP_CHARGES","VALUATION_CHARGES","FWR_CHARGES",
            "RTO_CHARGES","PF_CHARGES","LI_CHARGES","MI_CHARGES","ABC_CHARGES","EW_CHARGES",
            "AMC_CHARGES","CAREPLUS_CHARGES","RSA_CHARGES","LFF_CHARGES","BT_LFC_CHARGES",
            "PROTEKT_CHARGES","BKAWACH_CHARGES","PROTEKT_PRO_CHARGES","PROTEKT_PLUS_CHARGES",
            "FLEXI_PAYMENT_FACILITY_CHARGE","BUYER_PROTECTION_PLAN_CHARGE","POCKET_INSURANCE_CHARGE",
            "LIFETIME_WARRANTY_CHARGE","PARTY_PESHI_HOLDBACK","ONLINE_CHALLAN_HOLDBACK","NOC_HOLDBACK",
            "MOTOR_INSURANCE_HOLDBACK","RTO_HOLDBACK","OTHER_HOLDBACK","OFFLINE_CHALLAN_HOLDBACK",
            "INSURANCE_PLAN","COLENDING_LOAN_ID","COLENDING_FLAG","NET_DISBURSAL_AMOUNT","STATUS","COUNT"
        };
        int liColIdx  = 27;
        int finalLiCol = disbCols.length, liExclCol = finalLiCol + 1;
        int ratesCol  = liExclCol + 1, commCol = ratesCol + 1;
        String liExclColLetter = col(liExclCol), commColLetter = col(commCol), liColLetter = col(liColIdx);
        String safeEnd = records.isEmpty() ? String.valueOf(dataStartExcel) : String.valueOf(dataEndExcel);

        String[][] summaryDefs = {
            { isActive ? "Total LI amount - Accrual" : "Total LI amount",
              records.isEmpty() ? "0" : "SUM(" + liColLetter + dataStartExcel + ":" + liColLetter + safeEnd + ")" },
            { "GST amount (18%)",  records.isEmpty() ? "0" : "B1-B3" },
            { "LI before Tax",     records.isEmpty() ? "0" : "SUM(" + liExclColLetter + dataStartExcel + ":" + liExclColLetter + safeEnd + ")" },
            { "Commission Rate",   String.valueOf(COMMISSION_RATE) },
            { "Total Commission",  records.isEmpty() ? "0" : "SUM(" + commColLetter + dataStartExcel + ":" + commColLetter + safeEnd + ")" },
        };
        for (int i = 0; i < summaryDefs.length; i++) {
            Row row = ws.createRow(i); row.setHeight((short)(20*20));
            ws.setColumnWidth(0,7000); ws.setColumnWidth(1,5000);
            Cell lbl = row.createCell(0); lbl.setCellValue(summaryDefs[i][0]); lbl.setCellStyle(boldSt);
            Cell val = row.createCell(1);
            if (i == 3) { val.setCellValue(COMMISSION_RATE); val.setCellStyle(pctSt); }
            else if (summaryDefs[i][1].equals("0")) { val.setCellValue(0); val.setCellStyle(numSt); }
            else { val.setCellFormula(summaryDefs[i][1]); val.setCellStyle(numSt); }
        }
        ws.createRow(5);

        String[] extraCols = isActive
                ? new String[]{"Final LI Charges","LI (Excluding GST)","Rates","Commission","Already Actualized","Remarks"}
                : new String[]{"LI Amount","LI (Excluding GST)","Rates","Commission"};

        Row hRow = ws.createRow(6); hRow.setHeight((short)(22*20));
        int c = 0;
        for (String hd : disbCols) ch(hRow, c++, hd, hdrSt);
        for (String hd : extraCols) ch(hRow, c++, hd, hdrSt);

        int rn = 7;
        for (DisbursalRecord rec : records) {
            Row row = ws.createRow(rn++); int excelRow = rn; int ci = 0;
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
            ci = setN(row,ci,rec.getLiCharges(),numSt);
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

            String liRef = col(liColIdx) + excelRow;
            int flCol = ci++;  row.createCell(flCol).setCellFormula(liRef); row.getCell(flCol).setCellStyle(numSt);
            String finalLiRef = col(flCol) + excelRow;
            int exclCol = ci++; row.createCell(exclCol).setCellFormula("ROUND(" + finalLiRef + "/1.18,0)"); row.getCell(exclCol).setCellStyle(numSt);
            String exclRef = col(exclCol) + excelRow;
            int rtCol = ci++;  row.createCell(rtCol).setCellValue(COMMISSION_RATE); row.getCell(rtCol).setCellStyle(pctSt);
            String ratesRef = col(rtCol) + excelRow;
            int cmCol = ci++;  row.createCell(cmCol).setCellFormula("ROUND(" + exclRef + "*" + ratesRef + ",2)"); row.getCell(cmCol).setCellStyle(numSt);

            if (isActive) {
                row.createCell(ci++).setCellValue(0); row.getCell(ci-1).setCellStyle(numSt);
                ct(row,ci++,"Accrued",txtSt);
            }
        }

        if (!records.isEmpty()) ws.setAutoFilter(new CellRangeAddress(6,6,0,disbCols.length+extraCols.length-1));
        ws.createFreezePane(0,7);
    }

    // ================================================================
    //  HELPERS
    // ================================================================
    private void setDefaultFont(XSSFWorkbook wb) {
        XSSFFont def = wb.getFontAt(0);
        def.setFontName(FONT_NAME);
        def.setFontHeightInPoints(FONT_SIZE);
    }

    private XSSFFont aptosFont(XSSFWorkbook wb, boolean bold, boolean white) {
        XSSFFont f = wb.createFont();
        f.setFontName(FONT_NAME);
        f.setFontHeightInPoints(FONT_SIZE);
        if (bold)  f.setBold(true);
        if (white) f.setColor(new XSSFColor(new byte[]{(byte)255,(byte)255,(byte)255}, null));
        return f;
    }

    private Map<String,double[]> groupByChannel(List<DisbursalRecord> records) {
        Map<String,double[]> map = new LinkedHashMap<>();
        for (DisbursalRecord r : records) {
            double li   = r.getLiCharges() != null ? r.getLiCharges().doubleValue() : 0;
            double excl = Math.round(li / GST_RATE);
            double comm = round2(excl * COMMISSION_RATE);
            String ch   = r.getChannel() != null ? r.getChannel() : "Unknown";
            map.merge(ch, new double[]{comm}, (a,b) -> new double[]{a[0]+b[0]});
        }
        return map;
    }

    private String s(Object v)         { return v != null ? v.toString() : ""; }
    private double round2(double v)    { return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue(); }

    private void ch(Row r, int c, String v, CellStyle s) { Cell cell=r.createCell(c); cell.setCellValue(v); cell.setCellStyle(s); }
    private void ct(Row r, int c, String v, CellStyle s) { Cell cell=r.createCell(c); cell.setCellValue(v!=null?v:""); cell.setCellStyle(s); }
    private int  setN(Row r, int c, BigDecimal v, CellStyle s) { Cell cell=r.createCell(c); cell.setCellValue(v!=null?v.doubleValue():0); cell.setCellStyle(s); return c+1; }

    private String     cellStr(Cell c) {
        if (c == null) return null;
        String v;
        if (c.getCellType() == CellType.FORMULA) {
            // DataFormatter cannot evaluate unsupported formulas (e.g. XLOOKUP) and falls back
            // to returning the formula text. Read the cached result Excel already computed instead.
            switch (c.getCachedFormulaResultType()) {
                case STRING:  v = c.getRichStringCellValue().getString(); break;
                case NUMERIC: v = String.valueOf(c.getNumericCellValue()); break;
                case BOOLEAN: v = String.valueOf(c.getBooleanCellValue()); break;
                default:      v = ""; break;
            }
        } else {
            v = dataFormatter.formatCellValue(c);
        }
        v = v == null ? "" : v.trim();
        return v.isEmpty() ? null : v;
    }
    private BigDecimal cellBd(Cell c) {
        if (c == null) return null;
        if (c.getCellType() == CellType.FORMULA) {
            switch (c.getCachedFormulaResultType()) {
                case NUMERIC:
                    return BigDecimal.valueOf(c.getNumericCellValue()).setScale(2, RoundingMode.HALF_UP);
                case STRING: {
                    String sv = c.getRichStringCellValue().getString().trim().replaceAll("[,₹ ]", "");
                    if (sv.isEmpty()) return null;
                    try { return new BigDecimal(sv).setScale(2, RoundingMode.HALF_UP); }
                    catch (NumberFormatException ex) { return null; }
                }
                default: return null;
            }
        }
        if (c.getCellType() == CellType.NUMERIC)
            return BigDecimal.valueOf(c.getNumericCellValue()).setScale(2, RoundingMode.HALF_UP);
        String v = dataFormatter.formatCellValue(c).trim().replaceAll("[,₹ ]","");
        if (v.isEmpty()) return null;
        try { return new BigDecimal(v).setScale(2, RoundingMode.HALF_UP); }
        catch (NumberFormatException ex) { return null; }
    }

    private Map<String,Integer> buildResult(int inserted, int updated) {
        Map<String,Integer> m = new HashMap<>(); m.put("inserted", inserted); m.put("updated", updated); return m;
    }

    // ── Styles ───────────────────────────────────────────────────────
    private CellStyle titleStyle(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setFont(aptosFont(wb, true, true));
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)11,(byte)31,(byte)58}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.CENTER); s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }
    private CellStyle hdrStyle(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setFont(aptosFont(wb, true, true));
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)11,(byte)31,(byte)58}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.CENTER); setBorders(s); return s;
    }
    private CellStyle numStyle(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));
        s.setAlignment(HorizontalAlignment.RIGHT); setBorders(s); return s;
    }
    private CellStyle pctStyle(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setDataFormat(wb.createDataFormat().getFormat("0%"));
        s.setAlignment(HorizontalAlignment.RIGHT); setBorders(s); return s;
    }
    private CellStyle borderStyle(XSSFWorkbook wb)     { CellStyle s=wb.createCellStyle(); s.setVerticalAlignment(VerticalAlignment.CENTER); setBorders(s); return s; }
    private CellStyle boldBorderStyle(XSSFWorkbook wb) { CellStyle s=wb.createCellStyle(); s.setFont(aptosFont(wb,true,false)); setBorders(s); s.setVerticalAlignment(VerticalAlignment.CENTER); return s; }
    private void setBorders(CellStyle s) {
        s.setBorderTop(BorderStyle.THIN); s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN); s.setBorderRight(BorderStyle.THIN);
    }

    private static class FloatRow {
        String floatType, accountManager, imdCode, transDate, bookingType,
               transactionDetails, policyNumber, receiptNo;
        double creditAmt, debitAmt, balance;
    }
}