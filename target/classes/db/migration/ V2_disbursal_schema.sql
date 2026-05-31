-- ================================================================
-- FinX24 — V2 Disbursal Records Table
-- All 120 columns from the disbursal report
-- LOAN_APPLICATION_ID = Primary Key (UPSERT key)
-- ================================================================

CREATE TABLE disbursal_records (
    -- ── Identity ────────────────────────────────────────────────
                                   LOAN_APPLICATION_ID         NVARCHAR(50)    NOT NULL PRIMARY KEY,
                                   CUSTOMER_NAME_01            NVARCHAR(200),
                                   VEHICLE_REGISTRATION_NUMBER NVARCHAR(50),
                                   SEGMENT                     NVARCHAR(50),
                                   CHANNEL                     NVARCHAR(50),
                                   HPA_STATUS                  NVARCHAR(50),
                                   DEALER_CODE                 NVARCHAR(50),

    -- ── Dates ───────────────────────────────────────────────────
                                   DISBURSEMENT_DATE           DATE,
                                   CANCELLATION_DATE           DATE,

    -- ── Loan Status ─────────────────────────────────────────────
                                   LOAN_STATUS                 NVARCHAR(100),
                                   STATUS                      NVARCHAR(100),  -- Same Month / Old Month Cancellation

    -- ── Location ────────────────────────────────────────────────
                                   CITY                        NVARCHAR(100),
                                   PINCODE_01                  NVARCHAR(20),
                                   STATE                       NVARCHAR(100),
                                   CITY_CODE                   NVARCHAR(20),
                                   STATE_CODE                  NVARCHAR(20),

    -- ── Loan Amounts ────────────────────────────────────────────
                                   TOTAL_LOAN_AMOUNT           DECIMAL(18,2),
                                   CAR_FINANCE_AMOUNT          DECIMAL(18,2),
                                   TENNURE_IN_MONTHS           INT,
                                   INTEREST_RATE               DECIMAL(8,4),
                                   NET_DISBURSAL_AMOUNT        DECIMAL(18,2),
                                   ACTUAL_DISBURSEMENT_AMOUNT  DECIMAL(18,2),
                                   LFC_ACTUAL_DISBURSEMENT_AMOUNT DECIMAL(18,2),
                                   DIRECTCREDITAMOUNT          DECIMAL(18,2),
                                   DF_AMOUNT                   DECIMAL(18,2),
                                   DRL_NUMBER                  NVARCHAR(100),

    -- ── Insurance ───────────────────────────────────────────────
                                   MOTOR_INSURANCE_TYPE        NVARCHAR(100),
                                   INSURANCE_PLAN              NVARCHAR(200),
                                   LI_CHARGES                  DECIMAL(18,2),
                                   MI_CHARGES                  DECIMAL(18,2),
                                   POCKET_INSURANCE_CHARGE     DECIMAL(18,2),
                                   BKAWACH_CHARGES             DECIMAL(18,2),

    -- ── Regulatory Charges ──────────────────────────────────────
                                   CIBIL_CHARGES               DECIMAL(18,2),
                                   DOCUMENTATION_CHARGES       DECIMAL(18,2),
                                   STAMP_CHARGES               DECIMAL(18,2),
                                   RTO_CHARGES                 DECIMAL(18,2),
                                   VALUATION_CHARGES           DECIMAL(18,2),

    -- ── Partner/Product Charges ─────────────────────────────────
                                   CHM_CHARGES                 DECIMAL(18,2),
                                   FWR_CHARGES                 DECIMAL(18,2),
                                   PF_CHARGES                  DECIMAL(18,2),
                                   ABC_CHARGES                 DECIMAL(18,2),
                                   EW_CHARGES                  DECIMAL(18,2),
                                   AMC_CHARGES                 DECIMAL(18,2),
                                   CAREPLUS_CHARGES            DECIMAL(18,2),
                                   RSA_CHARGES                 DECIMAL(18,2),
                                   LFF_CHARGES                 DECIMAL(18,2),
                                   BT_LFC_CHARGES              DECIMAL(18,2),
                                   PROTEKT_CHARGES             DECIMAL(18,2),
                                   PROTEKT_PRO_CHARGES         DECIMAL(18,2),
                                   PROTEKT_PLUS_CHARGES        DECIMAL(18,2),
                                   FLEXI_PAYMENT_FACILITY_CHARGE DECIMAL(18,2),
                                   BUYER_PROTECTION_PLAN_CHARGE  DECIMAL(18,2),
                                   LIFETIME_WARRANTY_CHARGE    DECIMAL(18,2),

    -- ── Holdbacks ───────────────────────────────────────────────
                                   PARTY_PESHI_HOLDBACK        DECIMAL(18,2),
                                   ONLINE_CHALLAN_HOLDBACK     DECIMAL(18,2),
                                   NOC_HOLDBACK                DECIMAL(18,2),
                                   MOTOR_INSURANCE_HOLDBACK    DECIMAL(18,2),
                                   RTO_HOLDBACK                DECIMAL(18,2),
                                   OTHER_HOLDBACK              DECIMAL(18,2),
                                   OFFLINE_CHALLAN_HOLDBACK    DECIMAL(18,2),
                                   PARTNER_HOLDBACK            DECIMAL(18,2),

    -- ── Co-lending ──────────────────────────────────────────────
                                   COLENDING_LOAN_ID           NVARCHAR(100),
                                   COLENDING_FLAG              NVARCHAR(20),

    -- ── Actual Disbursal Tranches (1-5) ─────────────────────────
                                   ACTUAL_DISBURSEMENT_AMOUNT_1  DECIMAL(18,2),
                                   ACTUAL_DISBURSEMENT_UTR_1     NVARCHAR(100),
                                   ACTUAL_DISBURSEMENT_DATE_1    DATE,
                                   ACTUAL_PAYMENT_MODE_1         NVARCHAR(50),
                                   ACTUAL_PAYMENT_STATUS_1       NVARCHAR(50),

                                   ACTUAL_DISBURSEMENT_AMOUNT_2  DECIMAL(18,2),
                                   ACTUAL_DISBURSEMENT_UTR_2     NVARCHAR(100),
                                   ACTUAL_DISBURSEMENT_DATE_2    DATE,
                                   ACTUAL_PAYMENT_MODE_2         NVARCHAR(50),
                                   ACTUAL_PAYMENT_STATUS_2       NVARCHAR(50),

                                   ACTUAL_DISBURSEMENT_AMOUNT_3  DECIMAL(18,2),
                                   ACTUAL_DISBURSEMENT_UTR_3     NVARCHAR(100),
                                   ACTUAL_DISBURSEMENT_DATE_3    DATE,
                                   ACTUAL_PAYMENT_MODE_3         NVARCHAR(50),
                                   ACTUAL_PAYMENT_STATUS_3       NVARCHAR(50),

                                   ACTUAL_DISBURSEMENT_AMOUNT_4  DECIMAL(18,2),
                                   ACTUAL_DISBURSEMENT_UTR_4     NVARCHAR(100),
                                   ACTUAL_DISBURSEMENT_DATE_4    DATE,
                                   ACTUAL_PAYMENT_MODE_4         NVARCHAR(50),
                                   ACTUAL_PAYMENT_STATUS_4       NVARCHAR(50),

                                   ACTUAL_DISBURSEMENT_AMOUNT_5  DECIMAL(18,2),
                                   ACTUAL_DISBURSEMENT_UTR_5     NVARCHAR(100),
                                   ACTUAL_DISBURSEMENT_DATE_5    DATE,
                                   ACTUAL_PAYMENT_MODE_5         NVARCHAR(50),

    -- ── LFC Tranches (1-4) ───────────────────────────────────────
                                   LFC_ACTUAL_DISBURSEMENT_AMOUNT_1  DECIMAL(18,2),
                                   LFC_ACTUAL_DISBURSEMENT_UTR_1     NVARCHAR(100),
                                   LFC_ACTUAL_DISBURSEMENT_DATE_1    DATE,
                                   LFC_ACTUAL_PAYMENT_MODE_1         NVARCHAR(50),
                                   LFC_ACTUAL_PAYMENT_STATUS_1       NVARCHAR(50),

                                   LFC_ACTUAL_DISBURSEMENT_AMOUNT_2  DECIMAL(18,2),
                                   LFC_ACTUAL_DISBURSEMENT_UTR_2     NVARCHAR(100),
                                   LFC_ACTUAL_DISBURSEMENT_DATE_2    DATE,
                                   LFC_ACTUAL_PAYMENT_MODE_2         NVARCHAR(50),
                                   LFC_ACTUAL_PAYMENT_STATUS_2       NVARCHAR(50),

                                   LFC_ACTUAL_DISBURSEMENT_AMOUNT_3  DECIMAL(18,2),
                                   LFC_ACTUAL_DISBURSEMENT_UTR_3     NVARCHAR(100),
                                   LFC_ACTUAL_DISBURSEMENT_DATE_3    DATE,
                                   LFC_ACTUAL_PAYMENT_MODE_3         NVARCHAR(50),
                                   LFC_ACTUAL_PAYMENT_STATUS_3       NVARCHAR(50),

                                   LFC_ACTUAL_DISBURSEMENT_AMOUNT_4  DECIMAL(18,2),
                                   LFC_ACTUAL_DISBURSEMENT_UTR_4     NVARCHAR(100),
                                   LFC_ACTUAL_DISBURSEMENT_DATE_4    DATE,
                                   LFC_ACTUAL_PAYMENT_MODE_4         NVARCHAR(50),
                                   LFC_ACTUAL_PAYMENT_STATUS_4       NVARCHAR(50),

    -- ── PMax ────────────────────────────────────────────────────
                                   P_MAX_SHEET_TIMESTAMP         NVARCHAR(100),
                                   P_MAX_EMAIL_ADDRESS           NVARCHAR(200),
                                   P_MAX_VEHICLE_NUMBER          NVARCHAR(50),
                                   P_MAX_CAR_FINANCE_AMOUNT      DECIMAL(18,2),
                                   PMAXX_TOTAL_CHARGES           DECIMAL(18,2),
                                   PMAXX_SURAKSHA                DECIMAL(18,2),
                                   PMAXX_MI                      DECIMAL(18,2),
                                   PMAXX_OTHER_CHARGES           DECIMAL(18,2),
                                   PMAXX_PF_DOCUMENTS_CHARGES    DECIMAL(18,2),
                                   P_MAX_SUBFINANCER             NVARCHAR(100),

    -- ── Pennant ─────────────────────────────────────────────────
                                   PENNANT_DISBURSAL_DATE        DATE,
                                   PENNANT_FIRST_EMI_AMOUNT      DECIMAL(18,2),
                                   PENNANT_FIRST_EMI_DATE        DATE,
                                   PENNANT_EMI_AMOUNT            DECIMAL(18,2),

    -- ── Flags & Misc ────────────────────────────────────────────
                                   AMOUNT_CHECK_FLAG             NVARCHAR(20),
                                   ACCOUNTING_FLAG               NVARCHAR(20),
                                   LOAN_COUNT                    INT,
                                   DISBURSEMENT_AMOUNT           DECIMAL(18,2),   -- "DISBURSEMENT AMOUNT" column

    -- ── Audit (added by system) ──────────────────────────────────
                                   uploaded_by                   NVARCHAR(50),
                                   uploaded_at                   DATETIME2 NOT NULL DEFAULT GETDATE(),
                                   last_updated_at               DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- ── Indexes for dashboard queries ────────────────────────────────
CREATE INDEX idx_disb_date        ON disbursal_records(DISBURSEMENT_DATE);
CREATE INDEX idx_cancel_date      ON disbursal_records(CANCELLATION_DATE);
CREATE INDEX idx_loan_status      ON disbursal_records(LOAN_STATUS);
CREATE INDEX idx_status           ON disbursal_records(STATUS);
CREATE INDEX idx_segment          ON disbursal_records(SEGMENT);
CREATE INDEX idx_channel          ON disbursal_records(CHANNEL);
CREATE INDEX idx_city             ON disbursal_records(CITY);
CREATE INDEX idx_state            ON disbursal_records(STATE);

-- ── Upload log (track what admin uploaded when) ──────────────────
CREATE TABLE disbursal_upload_log (
                                      id              BIGINT IDENTITY(1,1) PRIMARY KEY,
                                      file_name       NVARCHAR(255),
                                      uploaded_by     NVARCHAR(50),
                                      total_rows      INT,
                                      inserted_rows   INT,
                                      updated_rows    INT,
                                      cancelled_rows  INT,
                                      period_from     DATE,
                                      period_to       DATE,
                                      uploaded_at     DATETIME2 NOT NULL DEFAULT GETDATE()
);