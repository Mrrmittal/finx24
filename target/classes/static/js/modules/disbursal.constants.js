/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/disbursal.constants.js
 * Description : Single source of truth for all disbursal report
 *               constants — column names, cancel keyword detection,
 *               charge groups, KPI definitions, breakdown dims.
 *               Update ONLY this file when column names change.
 *
 * Author      : Jatin Mittal
 * Email       : jatin.mittal@cars24.com
 * Version     : 2.0.0
 * Updated     : April 2024
 * ================================================================
 */

const DisbursalConstants = (() => {

  /* ── Internal status codes ───────────────────────────────────── */
  const LOAN_STATUS = {
    ACTIVE:            'ACTIVE',
    SAME_MONTH_CANCEL: 'SAME_MONTH_CANCEL',  // exclude entirely
    OLD_MONTH_CANCEL:  'OLD_MONTH_CANCEL',   // include as negative
  };

  /* ── Cancel keyword detection (on LOAN_STATUS column) ──────────
   * Instead of mapping exact STATUS text, we detect ANY cancel
   * keyword in LOAN_STATUS column, then use DISBURSEMENT_DATE
   * vs CANCELLATION_DATE to decide same-month vs old-month.
   * ─────────────────────────────────────────────────────────── */
  const CANCEL_KEYWORDS = [
    'cancel', 'cancelled', 'cancellation',
    'canceled', 'canceld', 'cnx', 'cncl',
  ];

  /* ── Core columns ────────────────────────────────────────────── */
  const CORE_COLS = {
    LOAN_ID:           'LOAN_APPLICATION_ID',
    CUSTOMER_NAME:     'CUSTOMER_NAME_01',
    VEHICLE_REG:       'VEHICLE_REGISTRATION_NUMBER',
    SEGMENT:           'SEGMENT',
    CHANNEL:           'CHANNEL',
    HPA_STATUS:        'HPA_STATUS',
    DEALER_CODE:       'DEALER_CODE',
    DISBURSEMENT_DATE: 'DISBURSEMENT_DATE',
    LOAN_STATUS:       'LOAN_STATUS',
    CANCELLATION_DATE: 'CANCELLATION_DATE',
    CITY:              'CITY',
    PINCODE:           'PINCODE_01',
    STATE:             'STATE',
    INSURANCE_PLAN:    'INSURANCE_PLAN',
    STATUS:            'STATUS',
  };

  /* ── Amount columns ──────────────────────────────────────────── */
  const AMOUNT_COLS = {
    TOTAL_LOAN_AMOUNT:              'TOTAL_LOAN_AMOUNT',
    CAR_FINANCE_AMOUNT:             'CAR_FINANCE_AMOUNT',
    NET_DISBURSAL_AMOUNT:           'NET_DISBURSAL_AMOUNT',
    ACTUAL_DISBURSEMENT_AMOUNT:     'ACTUAL_DISBURSEMENT_AMOUNT',
    LFC_ACTUAL_DISBURSEMENT_AMOUNT: 'LFC_ACTUAL_DISBURSEMENT_AMOUNT',
    DIRECT_CREDIT_AMOUNT:           'DIRECTCREDITAMOUNT',
    TENURE_MONTHS:                  'TENNURE_IN_MONTHS',
    INTEREST_RATE:                  'INTEREST_RATE',
    LI_CHARGES:                     'LI_CHARGES',
    MI_CHARGES:                     'MI_CHARGES',
  };

  /* ── Channel labels ──────────────────────────────────────────── */
  const CHANNEL_CARS24 = 'CARS24';
  const CHANNEL_BAJAJ  = 'BAJAJ';

  /* ── Charge groups ───────────────────────────────────────────── */
  const CHARGE_GROUPS = {
    REGULATORY: {
      label: 'Regulatory Charges',
      columns: ['CIBIL_CHARGES','DOCUMENTATION_CHARGES','STAMP_CHARGES','RTO_CHARGES'],
    },
    INSURANCE: {
      label: 'Insurance Charges',
      columns: ['MI_CHARGES','LI_CHARGES','POCKET_INSURANCE_CHARGE','BKAWACH_CHARGES'],
    },
    PARTNER_PRODUCT: {
      label: 'Partner & Product Charges',
      columns: [
        'CHM_CHARGES','FWR_CHARGES','PF_CHARGES','ABC_CHARGES',
        'EW_CHARGES','AMC_CHARGES','CAREPLUS_CHARGES','RSA_CHARGES',
        'LFF_CHARGES','BT_LFC_CHARGES','PROTEKT_CHARGES',
        'PROTEKT_PRO_CHARGES','PROTEKT_PLUS_CHARGES','VALUATION_CHARGES',
        'LIFETIME_WARRANTY_CHARGE','BUYER_PROTECTION_PLAN_CHARGE',
        'FLEXI_PAYMENT_FACILITY_CHARGE',
      ],
    },
    PARTNER_MAX: {
      label: 'Partner Max (P-MAX)',
      columns: [
        'PMAXX_TOTAL_CHARGES','PMAXX_SURAKSHA','PMAXX_MI',
        'PMAXX_OTHER_CHARGES','PMAXX_PF_DOCUMENTS_CHARGES',
        'P_MAX_CAR_FINANCE_AMOUNT',
      ],
    },
    HOLDBACKS: {
      label: 'Holdback Amounts',
      columns: [
        'PARTY_PESHI_HOLDBACK','ONLINE_CHALLAN_HOLDBACK',
        'NOC_HOLDBACK','MOTOR_INSURANCE_HOLDBACK','RTO_HOLDBACK',
        'OTHER_HOLDBACK','OFFLINE_CHALLAN_HOLDBACK','PARTNER_HOLDBACK',
      ],
    },
  };

  /* ── Tranche columns ─────────────────────────────────────────── */
  const TRANCHE_COLS = [1,2,3,4,5].map(n => ({
    amount: `ACTUAL_DISBURSEMENT_AMOUNT_${n}`,
    utr:    `ACTUAL_DISBURSEMENT_UTR_${n}`,
    date:   `ACTUAL_DISBURSEMENT_DATE_${n}`,
    mode:   `ACTUAL_PAYMENT_MODE_${n}`,
    status: `ACTUAL_PAYMENT_STATUS_${n}`,
  }));

  const LFC_TRANCHE_COLS = [1,2,3,4].map(n => ({
    amount: `LFC_ACTUAL_DISBURSEMENT_AMOUNT_${n}`,
    utr:    `LFC_ACTUAL_DISBURSEMENT_UTR_${n}`,
    date:   `LFC_ACTUAL_DISBURSEMENT_DATE_${n}`,
    mode:   `LFC_ACTUAL_PAYMENT_MODE_${n}`,
    status: `LFC_ACTUAL_PAYMENT_STATUS_${n}`,
  }));

  /* ── KPI definitions (9 cards) ───────────────────────────────── */
  const KPI_DEFINITIONS = [
    { id:'net_count',    label:'Net Loan Count',        format:'count',    accent:'accent-gold'  },
    { id:'active_count', label:'Active Loans',          format:'count',    accent:'accent-green' },
    { id:'net_disbursal',label:'Net Disbursal Amount',  format:'currency', accent:'accent-blue'  },
    { id:'avg_loan',     label:'Avg Loan Amount',       format:'currency', accent:'accent-navy'  },
    { id:'li_charges',   label:'LI Charges (Net)',       format:'currency', accent:'accent-teal'  },
    { id:'mi_charges',   label:'MI Charges (Net)',       format:'currency', accent:'accent-teal'  },
    { id:'cars24_count', label:'Cars24 Channel Cases',  format:'count',    accent:'accent-navy'  },
    { id:'bajaj_count',  label:'Bajaj Channel Cases',   format:'count',    accent:'accent-gold'  },
    { id:'pmax_count',   label:'PMax Cases (Others)',    format:'count',    accent:'accent-slate' },
  ];

  /* ── Summary export table columns ───────────────────────────── */
  const SUMMARY_TABLE_COLS = [
    { key:'LOAN_APPLICATION_ID',         label:'Loan ID',          width:'140px' },
    { key:'CUSTOMER_NAME_01',            label:'Customer',         width:'130px' },
    { key:'VEHICLE_REGISTRATION_NUMBER', label:'Vehicle No.',      width:'110px' },
    { key:'SEGMENT',                     label:'Segment',          width:'80px'  },
    { key:'CHANNEL',                     label:'Channel',          width:'90px'  },
    { key:'HPA_STATUS',                  label:'HPA Status',       width:'90px'  },
    { key:'INSURANCE_PLAN',              label:'Insurance Plan',   width:'120px' },
    { key:'CITY',                        label:'City',             width:'90px'  },
    { key:'STATE',                       label:'State',            width:'80px'  },
    { key:'DISBURSEMENT_DATE',           label:'Disbursal Date',   width:'110px' },
    { key:'CAR_FINANCE_AMOUNT',          label:'Car Finance (₹)',  width:'110px' },
    { key:'NET_DISBURSAL_AMOUNT',        label:'Net Disbursal (₹)',width:'120px' },
    { key:'LI_CHARGES',                  label:'LI Charges (₹)',   width:'100px' },
    { key:'MI_CHARGES',                  label:'MI Charges (₹)',   width:'100px' },
    { key:'_STATUS_LABEL',               label:'Status',           width:'140px' },
  ];

  return {
    LOAN_STATUS, CANCEL_KEYWORDS,
    CORE_COLS, AMOUNT_COLS,
    CHANNEL_CARS24, CHANNEL_BAJAJ,
    CHARGE_GROUPS, TRANCHE_COLS, LFC_TRANCHE_COLS,
    KPI_DEFINITIONS, SUMMARY_TABLE_COLS,
  };

})();
window.DisbursalConstants = DisbursalConstants;
