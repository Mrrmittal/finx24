/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/disbursal.parser.js
 * Description : Pure data engine for the disbursal report.
 *
 *               KEY CHANGES v2:
 *               - Multi-file merge: mergeFiles([rows1, rows2...])
 *               - Date-based cancel classification (not status text):
 *                   LOAN_STATUS contains cancel keyword?
 *                     → Yes: check DISBURSEMENT_DATE month
 *                         Same month as file period → SAME_MONTH_CANCEL
 *                         Earlier month            → OLD_MONTH_CANCEL
 *                     → No: ACTIVE
 *               - Daily trend uses ACTIVE rows only
 *               - Breakdowns: HPA_STATUS + INSURANCE_PLAN (blank→'Standalone')
 *               - KPI: LI_CHARGES, MI_CHARGES, Cars24 count, Bajaj count, PMax count
 *
 *               No DOM access — UI-free.
 *
 * Author      : Jatin Mittal
 * Email       : jatin.mittal@cars24.com
 * Version     : 2.0.0
 * Updated     : April 2024
 * ================================================================
 */

const DisbursalParser = (() => {

  const C  = DisbursalConstants;
  const LS = C.LOAN_STATUS;

  /* ============================================================
     PUBLIC — parseExcelRows
     Normalise SheetJS output → clean row array
     ============================================================ */
  function parseExcelRows(sheetRows) {
    if (!sheetRows || !sheetRows.length) return [];

    const normalised = sheetRows.map(row => _normaliseRow(row));
    const firstRow   = normalised[0] || {};

    const loanIdKey = _detectColumn(firstRow, [
      'LOAN_APPLICATION_ID','LOANAPPLICATIONID','LOAN_ID',
      'APPLICATION_ID','APPLICATIONID','LOAN_APP_ID','LOANID',
    ]);

    console.info('[Parser] First 15 cols:', Object.keys(firstRow).slice(0,15));
    console.info('[Parser] Loan ID col:', loanIdKey || 'NOT FOUND');
    console.info('[Parser] Raw rows:', normalised.length);

    if (!loanIdKey) {
      console.error('[Parser] Loan ID column not found. Cols:', Object.keys(firstRow));
      return [];
    }

    const valid = normalised.filter(row => {
      const val = row[loanIdKey];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });

    console.info('[Parser] Valid rows:', valid.length);
    return valid;
  }

  /* ============================================================
     PUBLIC — parsePastedText
     Tab/comma separated text → row array
     ============================================================ */
  function parsePastedText(text) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep     = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toUpperCase());
    return lines.slice(1).map(line => {
      const cells = line.split(sep);
      const obj   = {};
      headers.forEach((h, i) => { obj[h] = (cells[i] || '').trim(); });
      return obj;
    }).filter(r => r[headers[0]]);
  }

  /* ============================================================
     PUBLIC — mergeFiles
     Merge rows from multiple uploaded files into one dataset.
     Deduplicates by LOAN_APPLICATION_ID (last file wins for dupes).
     ============================================================ */
  function mergeFiles(rowArrays) {
    const merged = new Map();
    rowArrays.forEach(rows => {
      rows.forEach(row => {
        const id = row['LOAN_APPLICATION_ID'] || row[Object.keys(row)[0]];
        merged.set(String(id).trim(), row);
      });
    });
    const result = Array.from(merged.values());
    console.info(`[Parser] Merged ${rowArrays.length} file(s) → ${result.length} unique rows`);
    return result;
  }

  /* ============================================================
     PUBLIC — process
     Full classification + aggregation pipeline.
     period: { from: Date, to: Date } — the selected report period
     ============================================================ */
  function process(rawRows, period) {
    console.info('[Parser] Processing', rawRows.length, 'rows | Period:', period);

    /* Convert amounts to numbers */
    const rows = rawRows.map(row => _toNumericAmounts(row));

    /* Classify each row using date-based logic */
    const classified = rows.map(row => ({
      ...row,
      _STATUS:       _classifyByDate(row, period),
      _STATUS_LABEL: '',
    }));
    classified.forEach(r => {
      r._STATUS_LABEL = {
        [LS.ACTIVE]:            'Active',
        [LS.SAME_MONTH_CANCEL]: 'Same Month Cancel',
        [LS.OLD_MONTH_CANCEL]:  'Old Month Cancel',
      }[r._STATUS] || 'Active';
    });

    /* Split buckets */
    const active      = classified.filter(r => r._STATUS === LS.ACTIVE);
    const sameCancel  = classified.filter(r => r._STATUS === LS.SAME_MONTH_CANCEL);
    const oldCancel   = classified.filter(r => r._STATUS === LS.OLD_MONTH_CANCEL);
    const oldNegated  = oldCancel.map(r => _negateAmounts(r));

    console.info(`[Parser] Active: ${active.length} | Same-cancel: ${sameCancel.length} (excluded) | Old-cancel: ${oldCancel.length} (negated)`);

    /* Working set for amounts = active + old cancel negated */
    const workingSet = [...active, ...oldNegated];

    return {
      allRows:         classified,
      active,
      sameCancel,
      oldCancel,
      oldNegated,
      workingSet,
      period,
      summary:         _buildSummary(active, sameCancel, oldNegated),
      byHPA:           _groupBy(workingSet, C.CORE_COLS.HPA_STATUS,     'HPA Status'),
      byChannel:       _groupBy(workingSet, C.CORE_COLS.CHANNEL,        'Channel'),
      byInsurancePlan: _groupByInsurancePlan(workingSet),
      byDate:          _groupByDate(active),  /* ACTIVE only — point 4 */
      chargeBreakdown: _buildChargeBreakdown(workingSet),
    };
  }

  /* ============================================================
     PRIVATE — _classifyByDate
     Uses LOAN_STATUS keyword + date comparison (NOT status text)
     ============================================================ */
  function _classifyByDate(row, period) {
    const loanStatusRaw = String(row[C.CORE_COLS.LOAN_STATUS] || '').trim().toLowerCase();
    const isCancel = C.CANCEL_KEYWORDS.some(kw => loanStatusRaw.includes(kw));

    if (!isCancel) return LS.ACTIVE;

    /* Parse DISBURSEMENT_DATE */
    const disbDate = _parseDate(row[C.CORE_COLS.DISBURSEMENT_DATE]);
    if (!disbDate) return LS.SAME_MONTH_CANCEL; // no date → treat as same month

    /* If a period is provided, check if disbDate falls within period */
    if (period && period.from && period.to) {
      const from = new Date(period.from.getFullYear(), period.from.getMonth(), 1);
      const to   = new Date(period.to.getFullYear(),   period.to.getMonth(),   1);

      /* disbDate is within the selected period → same month cancel (exclude) */
      if (disbDate >= from && disbDate <= to) return LS.SAME_MONTH_CANCEL;

      /* disbDate is before the period → old month cancel (negate) */
      return LS.OLD_MONTH_CANCEL;
    }

    /* Fallback when no period: compare disbDate month to cancellation month */
    const cancelDate = _parseDate(row[C.CORE_COLS.CANCELLATION_DATE]);
    if (!cancelDate) return LS.SAME_MONTH_CANCEL;

    const disbYM   = `${disbDate.getFullYear()}-${disbDate.getMonth()}`;
    const cancelYM = `${cancelDate.getFullYear()}-${cancelDate.getMonth()}`;

    return disbYM === cancelYM ? LS.SAME_MONTH_CANCEL : LS.OLD_MONTH_CANCEL;
  }

  /* ============================================================
     PRIVATE — _buildSummary
     Net KPIs including LI/MI charges + channel counts
     ============================================================ */
  function _buildSummary(active, sameCancel, oldNegated) {
    const working = [...active, ...oldNegated];

    const s = (col) => working.reduce((sum, r) => sum + _n(r[col]), 0);
    const a = (col) => {
      const vals = active.map(r => _n(r[col])).filter(v => v > 0);
      return vals.length ? vals.reduce((t,v) => t+v, 0) / vals.length : 0;
    };

    const netCount = active.length - oldNegated.length;

    /* HPA_STATUS-based counts — ACTIVE only
     * Cars24 → HPA_STATUS contains "CARS24"
     * Bajaj  → HPA_STATUS starts with "Bajaj" (case-insensitive)
     * PMax   → everything else (not Cars24, not Bajaj)
     */
    const cars24Count = active.filter(r =>
      String(r[C.CORE_COLS.HPA_STATUS] || '').toUpperCase().includes('CARS24')
    ).length;
    const bajajCount = active.filter(r =>
      String(r[C.CORE_COLS.HPA_STATUS] || '').trim().toLowerCase().startsWith('bajaj')
    ).length;
    const pmaxCount = active.length - cars24Count - bajajCount;

    return {
      /* Counts */
      net_count:              netCount,
      active_count:           active.length,
      same_month_cancel_count:sameCancel.length,
      old_month_cancel_count: oldNegated.length,

      /* Amounts */
      net_disbursal:          Math.round(s(C.AMOUNT_COLS.NET_DISBURSAL_AMOUNT)),
      car_finance_amount:     Math.round(s(C.AMOUNT_COLS.CAR_FINANCE_AMOUNT)),
      actual_disbursal:       Math.round(s(C.AMOUNT_COLS.ACTUAL_DISBURSEMENT_AMOUNT)),
      lfc_disbursal:          Math.round(s(C.AMOUNT_COLS.LFC_ACTUAL_DISBURSEMENT_AMOUNT)),

      /* LI / MI */
      li_charges:             Math.round(s(C.AMOUNT_COLS.LI_CHARGES)),
      mi_charges:             Math.round(s(C.AMOUNT_COLS.MI_CHARGES)),

      /* Averages */
      avg_loan:               Math.round(s(C.AMOUNT_COLS.CAR_FINANCE_AMOUNT) / Math.max(netCount, 1)),
      avg_tenure:             Math.round(a(C.AMOUNT_COLS.TENURE_MONTHS) * 10) / 10,
      avg_interest:           Math.round(a(C.AMOUNT_COLS.INTEREST_RATE) * 100) / 100,

      /* Channel counts */
      cars24_count:           cars24Count,
      bajaj_count:            bajajCount,
      pmax_count:             Math.max(pmaxCount, 0),
    };
  }

  /* ============================================================
     PRIVATE — breakdowns
     ============================================================ */
  function _groupBy(rows, colKey, dimLabel) {
    const groups = {};
    rows.forEach(row => {
      const key = String(row[colKey] || '').trim() || 'Unknown';
      if (!groups[key]) groups[key] = { name: key, count: 0, carFinance: 0, netDisbursal: 0 };
      groups[key].count       += row._STATUS === LS.OLD_MONTH_CANCEL ? -1 : 1;
      groups[key].carFinance  += _n(row[C.AMOUNT_COLS.CAR_FINANCE_AMOUNT]);
      groups[key].netDisbursal+= _n(row[C.AMOUNT_COLS.NET_DISBURSAL_AMOUNT]);
    });
    return Object.values(groups).sort((a,b) => b.netDisbursal - a.netDisbursal);
  }

  function _groupByInsurancePlan(rows) {
    const groups = {};
    rows.forEach(row => {
      const raw = String(row[C.CORE_COLS.INSURANCE_PLAN] || '').trim();
      const key = raw === '' || raw.toLowerCase() === 'nan' ? 'Standalone' : raw;
      if (!groups[key]) groups[key] = { name: key, count: 0, carFinance: 0, netDisbursal: 0 };
      groups[key].count       += row._STATUS === LS.OLD_MONTH_CANCEL ? -1 : 1;
      groups[key].carFinance  += _n(row[C.AMOUNT_COLS.CAR_FINANCE_AMOUNT]);
      groups[key].netDisbursal+= _n(row[C.AMOUNT_COLS.NET_DISBURSAL_AMOUNT]);
    });
    return Object.values(groups).sort((a,b) => b.netDisbursal - a.netDisbursal);
  }

  /* Daily trend — ACTIVE rows ONLY (point 4) */
  function _groupByDate(activeRows) {
    const groups = {};
    activeRows.forEach(row => {
      const raw = row[C.CORE_COLS.DISBURSEMENT_DATE];
      const key = _formatDateKey(raw);
      if (!key) return;
      if (!groups[key]) groups[key] = { date: key, count: 0, amount: 0, rawDate: _parseDate(raw) };
      groups[key].count  += 1;
      groups[key].amount += _n(row[C.AMOUNT_COLS.NET_DISBURSAL_AMOUNT]);
    });
    return Object.values(groups)
      .sort((a,b) => (a.rawDate || 0) - (b.rawDate || 0));
  }

  function _buildChargeBreakdown(rows) {
    const result = {};
    Object.entries(C.CHARGE_GROUPS).forEach(([gk, group]) => {
      result[gk] = { label: group.label, total: 0, columns: {} };
      group.columns.forEach(col => {
        const sum = rows.reduce((t,r) => t + _n(r[col]), 0);
        result[gk].columns[col] = Math.round(sum);
        result[gk].total       += sum;
      });
      result[gk].total = Math.round(result[gk].total);
    });
    return result;
  }

  /* ============================================================
     PRIVATE — helpers
     ============================================================ */
  function _normaliseRow(row) {
    const out = {};
    Object.keys(row).forEach(k => {
      const norm = k.trim().toUpperCase().replace(/\s+/g,'_');
      out[norm]  = typeof row[k] === 'string' ? row[k].trim() : row[k];
    });
    return out;
  }

  function _detectColumn(row, candidates) {
    const keys = Object.keys(row);
    for (const c of candidates) {
      if (keys.includes(c)) return c;
      const stripped = c.replace(/[\s_]/g,'');
      const found    = keys.find(k => k.replace(/[\s_]/g,'') === stripped);
      if (found) return found;
    }
    return null;
  }

  function _toNumericAmounts(row) {
    const out = { ...row };
    const allAmtCols = _getAllAmountCols();
    allAmtCols.forEach(col => {
      if (col in out) {
        const n = parseFloat(String(out[col]).replace(/,/g,''));
        out[col] = isNaN(n) ? 0 : n;
      }
    });
    return out;
  }

  function _negateAmounts(row) {
    const out = { ...row };
    _getAllAmountCols().forEach(col => {
      if (col in out && out[col] !== 0) out[col] = -Math.abs(out[col]);
    });
    return out;
  }

  function _getAllAmountCols() {
    const cols = Object.values(C.AMOUNT_COLS);
    Object.values(C.CHARGE_GROUPS).forEach(g => cols.push(...g.columns));
    C.TRANCHE_COLS.forEach(t => cols.push(t.amount));
    C.LFC_TRANCHE_COLS.forEach(t => cols.push(t.amount));
    return [...new Set(cols)];
  }

  function _n(val) {
    if (val === null || val === undefined || val === '') return 0;
    const n = parseFloat(String(val).replace(/,/g,''));
    return isNaN(n) ? 0 : n;
  }

  function _parseDate(raw) {
    if (!raw) return null;
    /* Excel serial number */
    if (typeof raw === 'number' && raw > 40000) {
      return new Date((raw - 25569) * 86400 * 1000);
    }
    /* Date object from SheetJS cellDates:true */
    if (raw instanceof Date) return raw;
    /* String date */
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function _formatDateKey(raw) {
    const d = _parseDate(raw);
    if (!d) return null;
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  }

  /* ── Public API ── */
  return { parseExcelRows, parsePastedText, mergeFiles, process };

})();