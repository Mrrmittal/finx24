package com.Finx24.disbursal.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Disbursal Record Entity — all precision verified from actual April 2026 file
 * 4372 rows | 124 cols | INTEREST_RATE max=496000 | UTR max=12 digit integer
 */
@Entity
@Table(name = "disbursal_records")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class DisbursalRecord {

    @Id
    @Column(name = "LOAN_APPLICATION_ID", nullable = false, length = 20)
    private String loanApplicationId;

    // Identity
    @Column(name = "CUSTOMER_NAME_01",            length = 100) private String customerName;
    @Column(name = "VEHICLE_REGISTRATION_NUMBER", length = 25)  private String vehicleRegNo;
    @Column(name = "SEGMENT",                     length = 20)  private String segment;
    @Column(name = "CHANNEL",                     length = 20)  private String channel;
    @Column(name = "HPA_STATUS",                  length = 30)  private String hpaStatus;
    @Column(name = "DEALER_CODE",                 length = 20)  private String dealerCode;

    // Dates
    @Column(name = "DISBURSEMENT_DATE")  private LocalDate disbursementDate;
    @Column(name = "CANCELLATION_DATE")  private LocalDate cancellationDate;

    // Status
    @Column(name = "LOAN_STATUS", length = 20) private String loanStatus;
    @Column(name = "STATUS",      length = 30) private String status;

    // Location
    @Column(name = "CITY",       length = 50)  private String city;
    @Column(name = "PINCODE_01", length = 25)  private String pincode;
    @Column(name = "STATE",      length = 30)  private String state;
    @Column(name = "CITY_CODE",  length = 15)  private String cityCode;
    @Column(name = "STATE_CODE", length = 15)  private String stateCode;

    // Loan Amounts - precision from actual max values
    @Column(name = "TOTAL_LOAN_AMOUNT",              precision = 14, scale = 2) private BigDecimal totalLoanAmount;
    @Column(name = "CAR_FINANCE_AMOUNT",             precision = 14, scale = 2) private BigDecimal carFinanceAmount;
    @Column(name = "TENNURE_IN_MONTHS")              private Integer tenureMonths;

    // *** KEY FIX: was (8,4) but file has 496000 which needs 6 integer digits ***
    @Column(name = "INTEREST_RATE",                  precision = 18, scale = 4) private BigDecimal interestRate;

    @Column(name = "NET_DISBURSAL_AMOUNT",           precision = 14, scale = 2) private BigDecimal netDisbursalAmount;
    @Column(name = "ACTUAL_DISBURSEMENT_AMOUNT",     precision = 14, scale = 2) private BigDecimal actualDisbursementAmount;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_AMOUNT", precision = 14, scale = 2) private BigDecimal lfcActualDisbursementAmount;
    @Column(name = "DIRECTCREDITAMOUNT",             precision = 14, scale = 2) private BigDecimal directCreditAmount;
    @Column(name = "DF_AMOUNT",                      precision = 14, scale = 2) private BigDecimal dfAmount;
    @Column(name = "DRL_NUMBER",                     length = 100)              private String     drlNumber;
    @Column(name = "DISBURSEMENT_AMOUNT",            precision = 14, scale = 2) private BigDecimal disbursementAmount;
    @Column(name = "LOAN_COUNT")                     private Integer loanCount;

    // Insurance
    @Column(name = "MOTOR_INSURANCE_TYPE",    length = 20)               private String     motorInsuranceType;
    @Column(name = "INSURANCE_PLAN",          length = 20)               private String     insurancePlan;
    @Column(name = "LI_CHARGES",              precision = 12, scale = 2) private BigDecimal liCharges;
    @Column(name = "MI_CHARGES",              precision = 12, scale = 2) private BigDecimal miCharges;
    @Column(name = "POCKET_INSURANCE_CHARGE", precision = 12, scale = 2) private BigDecimal pocketInsuranceCharge;
    @Column(name = "BKAWACH_CHARGES",         precision = 12, scale = 2) private BigDecimal bkawachCharges;

    // Regulatory Charges
    @Column(name = "CIBIL_CHARGES",         precision = 10, scale = 2) private BigDecimal cibilCharges;
    @Column(name = "DOCUMENTATION_CHARGES", precision = 10, scale = 2) private BigDecimal documentationCharges;
    @Column(name = "STAMP_CHARGES",         precision = 10, scale = 2) private BigDecimal stampCharges;
    @Column(name = "RTO_CHARGES",           precision = 12, scale = 2) private BigDecimal rtoCharges;
    @Column(name = "VALUATION_CHARGES",     precision = 10, scale = 2) private BigDecimal valuationCharges;

    // Partner/Product Charges
    @Column(name = "CHM_CHARGES",                    precision = 10, scale = 2) private BigDecimal chmCharges;
    @Column(name = "FWR_CHARGES",                    precision = 10, scale = 2) private BigDecimal fwrCharges;
    @Column(name = "PF_CHARGES",                     precision = 12, scale = 2) private BigDecimal pfCharges;
    @Column(name = "ABC_CHARGES",                    precision = 12, scale = 2) private BigDecimal abcCharges;
    @Column(name = "EW_CHARGES",                     precision = 12, scale = 2) private BigDecimal ewCharges;
    @Column(name = "AMC_CHARGES",                    precision = 10, scale = 2) private BigDecimal amcCharges;
    @Column(name = "CAREPLUS_CHARGES",               precision = 10, scale = 2) private BigDecimal careplusCharges;
    @Column(name = "RSA_CHARGES",                    precision = 10, scale = 2) private BigDecimal rsaCharges;
    @Column(name = "LFF_CHARGES",                    precision = 10, scale = 2) private BigDecimal lffCharges;
    @Column(name = "BT_LFC_CHARGES",                 precision = 10, scale = 2) private BigDecimal btLfcCharges;
    @Column(name = "PROTEKT_CHARGES",                precision = 10, scale = 2) private BigDecimal protektCharges;
    @Column(name = "PROTEKT_PRO_CHARGES",            precision = 10, scale = 2) private BigDecimal protektProCharges;
    @Column(name = "PROTEKT_PLUS_CHARGES",           precision = 12, scale = 2) private BigDecimal protektPlusCharges;
    @Column(name = "FLEXI_PAYMENT_FACILITY_CHARGE",  precision = 10, scale = 2) private BigDecimal flexiPaymentFacilityCharge;
    @Column(name = "BUYER_PROTECTION_PLAN_CHARGE",   precision = 10, scale = 2) private BigDecimal buyerProtectionPlanCharge;
    @Column(name = "LIFETIME_WARRANTY_CHARGE",       precision = 12, scale = 2) private BigDecimal lifetimeWarrantyCharge;

    // Holdbacks
    @Column(name = "PARTY_PESHI_HOLDBACK",    precision = 12, scale = 2) private BigDecimal partyPeshiHoldback;
    @Column(name = "ONLINE_CHALLAN_HOLDBACK", precision = 12, scale = 2) private BigDecimal onlineChallanHoldback;
    @Column(name = "NOC_HOLDBACK",            precision = 12, scale = 2) private BigDecimal nocHoldback;
    @Column(name = "MOTOR_INSURANCE_HOLDBACK",precision = 12, scale = 2) private BigDecimal motorInsuranceHoldback;
    @Column(name = "RTO_HOLDBACK",            precision = 12, scale = 2) private BigDecimal rtoHoldback;
    @Column(name = "OTHER_HOLDBACK",          precision = 14, scale = 2) private BigDecimal otherHoldback;
    @Column(name = "OFFLINE_CHALLAN_HOLDBACK",precision = 10, scale = 2) private BigDecimal offlineChallanHoldback;
    @Column(name = "PARTNER_HOLDBACK",        precision = 12, scale = 2) private BigDecimal partnerHoldback;

    // Co-lending
    @Column(name = "COLENDING_LOAN_ID", length = 50) private String colendingLoanId;
    @Column(name = "COLENDING_FLAG",    length = 10) private String colendingFlag;

    // Actual Disbursal Tranches 1-5
    @Column(name = "ACTUAL_DISBURSEMENT_AMOUNT_1", precision = 12, scale = 2) private BigDecimal actualDisbAmount1;
    @Column(name = "ACTUAL_DISBURSEMENT_UTR_1",    length = 100)               private String     actualDisbUtr1;
    @Column(name = "ACTUAL_DISBURSEMENT_DATE_1")                               private LocalDate  actualDisbDate1;
    @Column(name = "ACTUAL_PAYMENT_MODE_1",        length = 10)               private String     actualPayMode1;
    @Column(name = "ACTUAL_PAYMENT_STATUS_1",      length = 15)               private String     actualPayStatus1;

    @Column(name = "ACTUAL_DISBURSEMENT_AMOUNT_2", precision = 12, scale = 2) private BigDecimal actualDisbAmount2;
    @Column(name = "ACTUAL_DISBURSEMENT_UTR_2",    length = 100)               private String     actualDisbUtr2;
    @Column(name = "ACTUAL_DISBURSEMENT_DATE_2")                               private LocalDate  actualDisbDate2;
    @Column(name = "ACTUAL_PAYMENT_MODE_2",        length = 10)               private String     actualPayMode2;
    @Column(name = "ACTUAL_PAYMENT_STATUS_2",      length = 15)               private String     actualPayStatus2;

    @Column(name = "ACTUAL_DISBURSEMENT_AMOUNT_3", precision = 12, scale = 2) private BigDecimal actualDisbAmount3;
    @Column(name = "ACTUAL_DISBURSEMENT_UTR_3",    length = 100)               private String     actualDisbUtr3;
    @Column(name = "ACTUAL_DISBURSEMENT_DATE_3")                               private LocalDate  actualDisbDate3;
    @Column(name = "ACTUAL_PAYMENT_MODE_3",        length = 10)               private String     actualPayMode3;
    @Column(name = "ACTUAL_PAYMENT_STATUS_3",      length = 15)               private String     actualPayStatus3;

    @Column(name = "ACTUAL_DISBURSEMENT_AMOUNT_4", precision = 12, scale = 2) private BigDecimal actualDisbAmount4;
    @Column(name = "ACTUAL_DISBURSEMENT_UTR_4",    length = 100)               private String     actualDisbUtr4;
    @Column(name = "ACTUAL_DISBURSEMENT_DATE_4")                               private LocalDate  actualDisbDate4;
    @Column(name = "ACTUAL_PAYMENT_MODE_4",        length = 10)               private String     actualPayMode4;
    @Column(name = "ACTUAL_PAYMENT_STATUS_4",      length = 15)               private String     actualPayStatus4;

    @Column(name = "ACTUAL_DISBURSEMENT_AMOUNT_5", precision = 12, scale = 2) private BigDecimal actualDisbAmount5;
    @Column(name = "ACTUAL_DISBURSEMENT_UTR_5",    length = 100)               private String     actualDisbUtr5;
    @Column(name = "ACTUAL_DISBURSEMENT_DATE_5")                               private LocalDate  actualDisbDate5;
    @Column(name = "ACTUAL_PAYMENT_MODE_5",        length = 10)               private String     actualPayMode5;

    // LFC Tranches 1-4
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_AMOUNT_1", precision = 14, scale = 2) private BigDecimal lfcDisbAmount1;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_UTR_1",    length = 100)               private String     lfcDisbUtr1;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_DATE_1")                               private LocalDate  lfcDisbDate1;
    @Column(name = "LFC_ACTUAL_PAYMENT_MODE_1",        length = 10)               private String     lfcPayMode1;
    @Column(name = "LFC_ACTUAL_PAYMENT_STATUS_1",      length = 15)               private String     lfcPayStatus1;

    @Column(name = "LFC_ACTUAL_DISBURSEMENT_AMOUNT_2", precision = 12, scale = 2) private BigDecimal lfcDisbAmount2;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_UTR_2",    length = 100)               private String     lfcDisbUtr2;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_DATE_2")                               private LocalDate  lfcDisbDate2;
    @Column(name = "LFC_ACTUAL_PAYMENT_MODE_2",        length = 10)               private String     lfcPayMode2;
    @Column(name = "LFC_ACTUAL_PAYMENT_STATUS_2",      length = 15)               private String     lfcPayStatus2;

    @Column(name = "LFC_ACTUAL_DISBURSEMENT_AMOUNT_3", precision = 12, scale = 2) private BigDecimal lfcDisbAmount3;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_UTR_3",    length = 100)               private String     lfcDisbUtr3;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_DATE_3")                               private LocalDate  lfcDisbDate3;
    @Column(name = "LFC_ACTUAL_PAYMENT_MODE_3",        length = 10)               private String     lfcPayMode3;
    @Column(name = "LFC_ACTUAL_PAYMENT_STATUS_3",      length = 15)               private String     lfcPayStatus3;

    @Column(name = "LFC_ACTUAL_DISBURSEMENT_AMOUNT_4", precision = 12, scale = 2) private BigDecimal lfcDisbAmount4;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_UTR_4",    length = 100)               private String     lfcDisbUtr4;
    @Column(name = "LFC_ACTUAL_DISBURSEMENT_DATE_4")                               private LocalDate  lfcDisbDate4;
    @Column(name = "LFC_ACTUAL_PAYMENT_MODE_4",        length = 10)               private String     lfcPayMode4;
    @Column(name = "LFC_ACTUAL_PAYMENT_STATUS_4",      length = 15)               private String     lfcPayStatus4;

    // PMax
    @Column(name = "P_MAX_SHEET_TIMESTAMP",      length = 25)               private String     pMaxSheetTimestamp;
    @Column(name = "P_MAX_EMAIL_ADDRESS",        length = 50)               private String     pMaxEmailAddress;
    @Column(name = "P_MAX_VEHICLE_NUMBER",       length = 25)               private String     pMaxVehicleNumber;
    @Column(name = "P_MAX_CAR_FINANCE_AMOUNT",   precision = 14, scale = 2) private BigDecimal pMaxCarFinanceAmount;
    @Column(name = "PMAXX_TOTAL_CHARGES",        precision = 12, scale = 2) private BigDecimal pmaxxTotalCharges;
    @Column(name = "PMAXX_SURAKSHA",             precision = 12, scale = 2) private BigDecimal pmaxxSuraksha;
    @Column(name = "PMAXX_MI",                   precision = 12, scale = 2) private BigDecimal pmaxxMi;
    @Column(name = "PMAXX_OTHER_CHARGES",        precision = 12, scale = 2) private BigDecimal pmaxxOtherCharges;
    @Column(name = "PMAXX_PF_DOCUMENTS_CHARGES", precision = 12, scale = 2) private BigDecimal pmaxxPfDocumentsCharges;
    @Column(name = "P_MAX_SUBFINANCER",          length = 100)              private String     pMaxSubfinancer;

    // Pennant
    @Column(name = "PENNANT_DISBURSAL_DATE")                               private LocalDate  pennantDisbursalDate;
    @Column(name = "PENNANT_FIRST_EMI_AMOUNT", precision = 12, scale = 2)  private BigDecimal pennantFirstEmiAmount;
    @Column(name = "PENNANT_FIRST_EMI_DATE")                               private LocalDate  pennantFirstEmiDate;
    @Column(name = "PENNANT_EMI_AMOUNT",       precision = 12, scale = 2)  private BigDecimal pennantEmiAmount;

    // Flags — Boolean in Excel, stored as String
    @Column(name = "AMOUNT_CHECK_FLAG", length = 10) private String amountCheckFlag;
    @Column(name = "ACCOUNTING_FLAG",   length = 10) private String accountingFlag;

    // Audit
    @Column(name = "uploaded_by",    length = 50) private String        uploadedBy;
    @Column(name = "uploaded_at")                  private LocalDateTime uploadedAt;
    @UpdateTimestamp
    @Column(name = "last_updated_at")              private LocalDateTime lastUpdatedAt;
}