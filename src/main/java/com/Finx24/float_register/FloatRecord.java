package com.Finx24.float_register;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@MappedSuperclass
@Getter @Setter @NoArgsConstructor
public class FloatRecord {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** "Apr'25" — auto-derived from TRANS_DATE */
    @Column(name = "MONTH_LABEL",  length = 10, nullable = false)
    private String monthLabel;

    /** Upload period label e.g. "Apr'25 - Mar'26" */
    @Column(name = "PERIOD_LABEL", length = 30, nullable = false)
    private String periodLabel;

    // ── Exact columns as in the file ─────────────────────────────
    @Column(name = "FLOAT_TYPE",          length = 50)  private String floatType;
    @Column(name = "ACCOUNT_MANAGER",     length = 100) private String accountManager;
    @Column(name = "IMD_CODE",            length = 50)  private String imdCode;
    @Column(name = "TRANS_DATE")                        private LocalDate transDate;
    @Column(name = "BOOKING_TYPE",        length = 100) private String bookingType;
    @Column(name = "TRANSACTION_DETAILS", length = 500) private String transactionDetails;
    @Column(name = "CREDIT_AMT",  precision=18, scale=4) private BigDecimal creditAmt;
    @Column(name = "DEBIT_AMT",   precision=18, scale=4) private BigDecimal debitAmt;
    @Column(name = "BALANCE",     precision=18, scale=4) private BigDecimal balance;
    @Column(name = "POLICY_NUMBER", length=100)         private String policyNumber;
    @Column(name = "LOAN_ID",       length=50)          private String loanId;
}