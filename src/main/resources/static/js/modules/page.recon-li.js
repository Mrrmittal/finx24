/**
 * FINX24 — Loan Insurance Reconciliation
 * Go Digit Float Register vs PR Register vs SAP HANA (DB)
 * Requires: page.recon-utils.js loaded first
 * @author  Jatin Mittal
 * @contact jatin.mittal@cars24.com | +91-8221944248
 * @company CARS24 Financial Services Pvt. Ltd. (CFSPL)
 */

/* ================================================================
   LOAN INSURANCE — v4 NOTEBOOK LOGIC (exact)
   ================================================================ */

/**
 * Classify float rows — mirrors v4 notebook Cell 17 exactly.
 * Top Up  = blank/missing POLICY_NUMBER AND credit>0 AND debit==0
 * Issue n Cancel  = debit>0 AND credit>0 (same period)
 * Issue Case      = debit>0, credit==0
 * Last Month Credit = debit==0, credit>0 (debit was prior period)
 */
function _liClassify(rows) {
    const byPol = {}; // pol → {td, tc}

    for (const r of rows) {
        const pol  = _k(_g(r, 'POLICY_NUMBER', 'POLICY_NO', 'POLICY_NUM', 'POLICY NO', 'POLICY'));
        const deb  = _n(_g(r, 'DEBIT_AMT',  'DEBIT_AMOUNT',  'DEBIT'));
        const cred = _n(_g(r, 'CREDIT_AMT', 'CREDIT_AMOUNT', 'CREDIT'));
        const isTopUp = _blank(pol) && cred > 0 && deb === 0;
        if (isTopUp) continue; // exclude true top-ups from grouping
        const key = _blank(pol) ? '__BLANK__' + Math.random() : pol;
        if (!byPol[key]) byPol[key] = { td:0, tc:0 };
        byPol[key].td += deb;
        byPol[key].tc += cred;
    }

    // remark per policy
    const remMap = {};
    for (const [key, g] of Object.entries(byPol)) {
        if (g.td > 0 && g.tc > 0)        remMap[key] = 'Issue n Cancel';
        else if (g.td > 0 && g.tc === 0) remMap[key] = 'Issue Case';
        else if (g.td === 0 && g.tc > 0) remMap[key] = 'Last Month Credit';
        else                              remMap[key] = 'Issue Case';
    }

    return rows.map(r => {
        const pol  = _k(_g(r, 'POLICY_NUMBER', 'POLICY_NO', 'POLICY_NUM', 'POLICY NO', 'POLICY'));
        const deb  = _n(_g(r, 'DEBIT_AMT',  'DEBIT_AMOUNT',  'DEBIT'));
        const cred = _n(_g(r, 'CREDIT_AMT', 'CREDIT_AMOUNT', 'CREDIT'));
        const isTopUp = _blank(pol) && cred > 0 && deb === 0;
        const remark = isTopUp ? 'Top Up' : (remMap[pol] || 'Issue Case');
        return { ...r, _POL:pol, _DEB:deb, _CRED:cred, _REM:remark };
    });
}

/**
 * Build PR lookup: POLICY_NUMBER → {loanId, type, premium}
 * type is always lowercase 'health' or 'pa'
 */
function _liPRLookup(prRows) {
    const lu = {};
    // v5: also read GROSS_PREMIUM for Float vs PR check
    for (const r of prRows) {
        const pol      = _k(_g(r, 'POLICY_NUMBER', 'POLICY_NO', 'POLICY_NUM', 'POLICY NO'));
        const loanId   = _k(_g(r, 'BOOKINGID_PLANID', 'LOAN_ID', 'LOAN_APPLICATION_ID', 'BOOKING_ID'));
        const typeRaw  = String(_g(r, 'PRODUCT_LOB', 'POLICY_TYPE', 'PLAN_TYPE', 'LOB', 'PRODUCT_TYPE')).trim().toUpperCase();
        const prem     = _n(_g(r, 'NET_PREMIUM_COLLECTED', 'PREMIUM_AMOUNT', 'PREMIUM', 'NET_PREMIUM'));
        const grossPrem= _n(_g(r, 'GROSS_PREMIUM', 'GROSSPREMIUM', 'GROSS_PREM'));  // v5 new
        if (pol && (typeRaw === 'HEALTH' || typeRaw === 'PA')) {
            lu[pol] = { loanId, type: typeRaw.toLowerCase(), premium: prem, gross: grossPrem };
        }
    }
    return lu;
}

/**
 * Build SAP HANA map: loanId → {liAmt, disbDate}
 * Uses BOM-safe, case-insensitive column matching (v4 notebook approach)
 */
function _liHANAMap(hanaRows) {
    const map = {};
    for (const r of hanaRows) {
        // BOM-safe: _normRow already strips BOM via _c()
        const id   = _k(_g(r, 'LOAN_APPLICATION_ID', 'LOANAPPLICATIONID', 'SAP_LOAN_ID', 'LOAN_ID'));
        const liAmt= _n(_g(r, 'LI_CHARGES', 'LI_AMOUNT', 'LI_AMT', 'LICHARGES'));
        const dt   = _g(r, 'DISBURSEMENT_DATE', 'DISBURSAL_DATE', 'DISB_DATE');
        if (id && !map[id]) { // first entry wins (latest date sort done before this)
            map[id] = { liAmt, disbDate: _dt(dt) };
        }
    }
    return map;
}

/**
 * Build status map: loanId → latest loan status
 * Accepts STATUS or LOAN_STATUS column, case-insensitive (v4 notebook)
 * Sort key ensures latest month wins when deduplicating
 */
function _liStatusMap(monthEntries) {
    // monthEntries: [{rows, label}]
    const all = [];
    for (const { rows, label } of monthEntries) {
        const sk = _msk(label);
        for (const r of rows) {
            const id = _k(_g(r, 'LOAN_APPLICATION_ID', 'LOANAPPLICATIONID', 'LOAN_ID', 'SAP_LOAN_ID'));
            const st = _g(r, 'STATUS', 'LOAN_STATUS', 'LOAN STATUS');
            if (id && st) all.push({ id, st, sk });
        }
    }
    // sort ascending so latest sort key is last → keep last
    all.sort((a, b) => a.sk - b.sk);
    const map = {};
    for (const { id, st } of all) map[id] = st;
    return map;
}

/**
 * v4 Final Status logic — exact mirror of final_status() in notebook Cell 19
 */
function _liFinalStatus(inSAP, inDR, loanStatus, diff) {
    const ls = String(loanStatus || '').toLowerCase();
    if (!inSAP) {
        if (!inDR)                         return 'Loan Not Disbursed - Policy Need to Cancel';
        if (ls.includes('active'))         return 'Active - Loan Disbursed (SAP Data Missing)';
        if (ls.includes('cancel'))         return 'Loan Cancelled - Policy Need to Cancel Too';
        return (loanStatus || 'Unknown')   + ' - Verify in SAP';
    }
    if (ls.includes('cancel'))           return 'Loan Cancelled - Policy Need to Cancel Too';
    if (Math.abs(diff) <= 1)             return 'Match';
    return diff < 0 ? 'Amount Mismatch - SAP Lower' : 'Amount Mismatch - Float Lower';
}

/**
 * Full LI reconciliation pipeline — v4 notebook logic.
 * Returns { issuedRows, cancelRows, topupRows, summary }
 */
function _liRunRecon(floatRows, floatAllRows, prRows, hanaRows, monthEntries) {
    // v5: store monthEntries sorted LATEST-FIRST for _drStatusLatestFirst()
    window._liMonthEntriesLatestFirst = [...monthEntries].sort((a,b) => _msk(b.label) - _msk(a.label));
    // 1. classify
    const classified = _liClassify(floatRows);

    // 2. lookups
    const prLU     = _liPRLookup(prRows);
    const hanaMap  = _liHANAMap(hanaRows);
    const statusMap= _liStatusMap(monthEntries);

    // 3. enrich with PR data (v5: also capture gross premium)
    const enriched = classified.map(r => {
        const pr = prLU[r._POL] || null;
        return { ...r, _LOAN_ID: pr?.loanId || '', _TYPE: pr?.type || '',
            _PREM: pr?.premium || 0, _GROSS: pr?.gross || 0 };
    });

    // v5: gross_by_loan — SUMIFS equivalent: sum GROSS_PREMIUM per Loan ID across all PR rows
    const grossByLoan = {};
    for (const [pol, entry] of Object.entries(prLU)) {
        const lid = entry.loanId;
        if (lid) grossByLoan[lid] = (grossByLoan[lid] || 0) + (entry.gross || 0);
    }

    // 4. LMC: prior-debit lookup from full history
    const lmcPolicies = new Set(
        classified.filter(r => r._REM === 'Last Month Credit').map(r => r._POL)
    );
    const lmcDebitMap = {};
    for (const r of floatAllRows) {
        const pol = _k(_g(r, 'POLICY_NUMBER', 'POLICY_NO', 'POLICY'));
        const deb = _n(_g(r, 'DEBIT_AMT', 'DEBIT_AMOUNT', 'DEBIT'));
        if (lmcPolicies.has(pol) && deb > 0) {
            lmcDebitMap[pol] = (lmcDebitMap[pol] || 0) + deb;
        }
    }

    // 5. Build ISSUED CASES — Health + PA aggregated per Loan ID
    const issueRows  = enriched.filter(r => r._REM === 'Issue Case');
    const healthRows = issueRows.filter(r => r._TYPE === 'health');
    const paRows     = issueRows.filter(r => r._TYPE === 'pa');

    const byH = {};
    for (const r of healthRows) {
        const id = r._LOAN_ID;
        if (!byH[id]) byH[id] = { deb:0, prem:0, pol:'', imd:'', date:'' };
        byH[id].deb  += r._DEB;
        byH[id].prem += r._PREM;
        byH[id].pol   = byH[id].pol  || r._POL;
        byH[id].imd   = byH[id].imd  || _g(r, 'IMD_CODE', 'IMDCODE');
        byH[id].date  = byH[id].date  || _g(r, 'TRANS_DATE', 'TRANSACTION_DATE', 'DATE');
    }
    const byP = {};
    for (const r of paRows) {
        const id = r._LOAN_ID;
        if (!byP[id]) byP[id] = { deb:0, prem:0, pol:'' };
        byP[id].deb  += r._DEB;
        byP[id].prem += r._PREM;
        byP[id].pol   = byP[id].pol || r._POL;
    }

    // v5: multi-DR latest-first status lookup (mirrors get_dr_status() in notebook)
    function _drStatusLatestFirst(loanId) {
        // monthEntries already sorted latest-first by the caller (_liStatusMap already
        // uses ascending sort for dedup, but we need to iterate latest-first here).
        // We store monthEntries sorted latest → oldest for this function.
        if (!window._liMonthEntriesLatestFirst) return { status: null, month: null };
        const CONCLUSIVE = ['active','cancel','disbursed','closed','reject'];
        let fallbackStatus = null, fallbackMonth = null;
        for (const { rows, label } of window._liMonthEntriesLatestFirst) {
            for (const r of rows) {
                const id = _k(_g(r, 'LOAN_APPLICATION_ID','LOANAPPLICATIONID','LOAN_ID','SAP_LOAN_ID'));
                if (id !== loanId) continue;
                const st = String(_g(r, 'STATUS','LOAN_STATUS','LOAN STATUS') || '').trim();
                if (!st || st === 'nan') continue;
                const stl = st.toLowerCase();
                if (CONCLUSIVE.some(k => stl.includes(k))) return { status: st, month: label };
                if (!fallbackStatus) { fallbackStatus = st; fallbackMonth = label; }
            }
        }
        return { status: fallbackStatus, month: fallbackMonth };
    }

    const allIds = [...new Set([...Object.keys(byH), ...Object.keys(byP)])];
    const issuedRows = allIds.map(id => {
        const h   = byH[id] || { deb:0, prem:0, pol:'', imd:'', date:'' };
        const p   = byP[id] || { deb:0, prem:0, pol:'' };
        const tot = h.deb + p.deb;
        const sap = hanaMap[id];
        const liAmt = sap?.liAmt || 0;
        const diff  = liAmt - tot;

        // v5: multi-DR latest-first status lookup
        const drRes   = _drStatusLatestFirst(id);
        const dr      = drRes.status;
        const loanSt  = dr || 'Not Found';
        const stMonth = drRes.month || '';
        const finalSt = _liFinalStatus(!!sap, !!dr, loanSt, diff);

        // v5: Gross Premium from PR SUMIFS + Float vs PR check
        const grossPR = grossByLoan[id] || 0;
        const fvpr    = Math.abs(tot - grossPR) <= 1 ? 'Match' : 'Mismatch';

        return {
            'Loan ID':                   id,
            'IMD Code':                  h.imd,
            'Policy Issue Date':         _dt(h.date),
            'Policy No - Health':        h.pol,
            'Debit Float (Health)':      Math.round(h.deb),
            'Premium - Health':          Math.round(h.prem),
            'Policy No - PA':            p.pol,
            'Debit Float (PA)':          Math.round(p.deb),
            'Premium - PA':              Math.round(p.prem),
            'Total Deduction (Float)':   Math.round(tot),
            'Gross Premium (PR)':        Math.round(grossPR),   // v5
            'Float vs PR Check':         fvpr,                  // v5
            'Disbursal Date':            sap?.disbDate || '',
            'LI Amount (SAP)':           Math.round(liAmt),
            'Difference':                Math.round(diff),
            'Loan Status':               loanSt,
            'Status Month':              stMonth,               // v5
            '_FINAL_STATUS':             finalSt,
        };
    });

    // 6. CANCELLATION — Issue n Cancel + Last Month Credit
    const cancelEnriched = enriched.filter(r => ['Issue n Cancel','Last Month Credit'].includes(r._REM));
    const byC = {};
    for (const r of cancelEnriched) {
        const id = r._LOAN_ID || r._POL;
        if (!byC[id]) byC[id] = { cH:0,cP:0,dH:0,dP:0, polH:'',polP:'', date:'', rtype:r._REM };
        const t = r._TYPE;
        if (t === 'health') {
            byC[id].cH  += r._CRED;
            byC[id].dH  += r._REM === 'Last Month Credit' ? (lmcDebitMap[r._POL] || r._DEB) : r._DEB;
            byC[id].polH = byC[id].polH || r._POL;
        } else {
            byC[id].cP  += r._CRED;
            byC[id].dP  += r._REM === 'Last Month Credit' ? (lmcDebitMap[r._POL] || r._DEB) : r._DEB;
            byC[id].polP = byC[id].polP || r._POL;
        }
        byC[id].date = byC[id].date || _g(r, 'TRANS_DATE', 'TRANSACTION_DATE', 'DATE');
    }

    const cancelRows = Object.entries(byC).map(([id, c]) => {
        const tc = c.cH + c.cP, td = c.dH + c.dP, diff = tc - td;
        let rem;
        if (Math.abs(diff) <= 1) rem = c.rtype === 'Issue n Cancel' ? 'Knocked Off - Debit & Credit Match' : 'Match';
        else rem = diff < 0 ? 'Shortfall - Go Digit Refunded Less' : 'Excess Credit - Investigate';
        return {
            'Loan ID':               id,
            'Policy Issue Date':     _dt(c.date),
            'Type':                  c.rtype,
            'Policy No - Health':    c.polH,
            'Credit Health':         Math.round(c.cH),
            'Debit Health (Original)': Math.round(c.dH),
            'Policy No - PA':        c.polP,
            'Credit PA':             Math.round(c.cP),
            'Debit PA (Original)':   Math.round(c.dP),
            'Total Credit':          Math.round(tc),
            'Total Debit':           Math.round(td),
            'Difference':            Math.round(diff),
            '_CANCEL_REM':           rem,
        };
    });

    // 7. Top Up rows
    const topupRows = enriched.filter(r => r._REM === 'Top Up').map(r => ({
        'Date':    _dt(_g(r,'TRANS_DATE','TRANSACTION_DATE','DATE')),
        'Type':    _g(r,'BOOKING_TYPE','FLOAT_TYPE','TYPE'),
        'Details': _g(r,'TRANSACTION_DETAILS','NARRATION','DESCRIPTION','DETAILS'),
        'Credit':  Math.round(r._CRED),
        'Debit':   Math.round(r._DEB),
    }));

    // 8. Summary
    const queries   = issuedRows.filter(r => r['_FINAL_STATUS'] !== 'Match');
    const matchC    = issuedRows.length - queries.length;
    const summary = {
        total:        issuedRows.length,
        match:        matchC,
        matchPct:     Math.round(matchC / Math.max(issuedRows.length, 1) * 100),
        queries:      queries.length,
        cancelled:    issuedRows.filter(r => r['_FINAL_STATUS'].includes('Cancelled')).length,
        notDisbursed: issuedRows.filter(r => r['_FINAL_STATUS'].includes('Not Disbursed')).length,
        mismatch:     issuedRows.filter(r => r['_FINAL_STATUS'].includes('Mismatch')).length,
        totalFloat:   issuedRows.reduce((s,r) => s + r['Total Deduction (Float)'], 0),
        cancelCount:  cancelRows.length,
        topupCount:   topupRows.length,
        prMatch:      issuedRows.filter(r => r['Float vs PR Check'] === 'Match').length,    // v5
        prMismatch:   issuedRows.filter(r => r['Float vs PR Check'] === 'Mismatch').length, // v5
        totalGrossPR: issuedRows.reduce((s,r) => s + (r['Gross Premium (PR)'] || 0), 0),   // v5
    };

    return { issuedRows, cancelRows, topupRows, queries, summary };
}

/** Build export XLSX using SheetJS (client-side, for download) */
function _liExportXLSX(data, label) {
    const wb = XLSX.utils.book_new();

    function addSheet(name, rows, cols) {
        if (!rows.length) return;
        const wsData = [cols.map(c=>c.label), ...rows.map(r => cols.map(c => r[c.key] ?? ''))];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, name);
    }

    // v5: 18-column Issued Cases (matches notebook v5 exactly)
    const issuedCols = [
        {key:'Loan ID',                  label:'Loan ID'},
        {key:'IMD Code',                 label:'IMD Code'},
        {key:'Policy Issue Date',        label:'Policy Issue Date'},
        {key:'Policy No - Health',       label:'Policy No - Health'},
        {key:'Debit Float (Health)',      label:'Debit Float (Health)'},
        {key:'Premium - Health',         label:'Premium - Health'},
        {key:'Policy No - PA',           label:'Policy No - PA'},
        {key:'Debit Float (PA)',          label:'Debit Float (PA)'},
        {key:'Premium - PA',             label:'Premium - PA'},
        {key:'Total Deduction (Float)',   label:'Total Deduction (Float)'},
        {key:'Gross Premium (PR)',        label:'Gross Premium (PR)'},          // v5
        {key:'Float vs PR Check',         label:'Float vs PR Check'},           // v5
        {key:'Disbursal Date',            label:'Disbursal Date'},
        {key:'LI Amount (SAP)',           label:'LI Amount (SAP)'},
        {key:'Difference',                label:'Difference'},
        {key:'Loan Status',               label:'Loan Status'},
        {key:'Status Month',              label:'Status Month'},                // v5
        {key:'_FINAL_STATUS',             label:'Final Status'},
    ];
    addSheet('Issued Cases', data.issuedRows, issuedCols);
    addSheet('LI Queries',   data.queries,    issuedCols);

    const cancelCols = [
        {key:'Loan ID',label:'Loan ID'},{key:'Policy Issue Date',label:'Policy Issue Date'},
        {key:'Type',label:'Type'},{key:'Policy No - Health',label:'Policy No - Health'},
        {key:'Credit Health',label:'Credit Health'},{key:'Debit Health (Original)',label:'Debit Health (Original)'},
        {key:'Policy No - PA',label:'Policy No - PA'},{key:'Credit PA',label:'Credit PA'},
        {key:'Debit PA (Original)',label:'Debit PA (Original)'},
        {key:'Total Credit',label:'Total Credit'},{key:'Total Debit',label:'Total Debit'},
        {key:'Difference',label:'Difference'},{key:'_CANCEL_REM',label:'Remarks'},
    ];
    addSheet('Cancellation', data.cancelRows, cancelCols);
    addSheet('Top Up', data.topupRows, [
        {key:'Date',label:'Date'},{key:'Type',label:'Type'},
        {key:'Details',label:'Details'},{key:'Credit',label:'Credit'},{key:'Debit',label:'Debit'},
    ]);

    return XLSX.write(wb, { type:'array', bookType:'xlsx' });
}

/* ================================================================
   LOAN INSURANCE — PAGE REGISTRATION
   ================================================================ */

Router.register('loanins', function(panel) {
    let _data = null; // holds last recon result

    panel.innerHTML = `
    <!-- Module hero -->
    <div class="module-hero">
      <div>
        <div class="hero-label">Reconciliation</div>
        <div class="hero-title">Loan Insurance Recon</div>
        <div class="hero-sub">Go Digit — Float Register vs PR Register vs SAP HANA · Health + PA per Loan ID</div>
      </div>
      <div class="hero-actions">
        <button class="btn-ghost" id="li-reset-btn">↺ Reset</button>
        <button class="btn-ghost" id="li-export-btn" style="display:none">Export Report</button>
      </div>
    </div>

    <!-- Upload Zone -->
    <div id="li-upload-zone">
      <div id="li-hint"></div>

      <!-- Period config -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Reconciliation Period</span></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Mode</div>
            <select class="form-select" id="li-mode">
              <option value="month">Single Month</option>
              <option value="range">Date Range</option>
            </select>
          </div>
          <div id="li-month-wrap">
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Month</div>
            <input class="form-input" id="li-month" value="Mar'26" placeholder="e.g. Mar'26" style="width:120px">
          </div>
          <div id="li-range-wrap" style="display:none;gap:8px;align-items:flex-end">
            <div>
              <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">From</div>
              <input class="form-input" id="li-range-start" type="date" value="2025-12-01">
            </div>
            <div>
              <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">To</div>
              <input class="form-input" id="li-range-end" type="date" value="2026-03-31">
            </div>
          </div>
        </div>
      </div>

      <!-- File uploads -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Step 1 — Float Register &amp; SAP HANA</span>
          <span id="li-db-badge" style="font-size:10px;padding:2px 8px;border-radius:10px;background:#D9F0D9;color:#1D6F42">Loading DB…</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${_liFileCard('li-float','Float Register','Go Digit Float file · POLICY_NUMBER, TRANS_DATE, DEBIT_AMT / CREDIT_AMT','required')}
          ${_liFileCard('li-hana','SAP HANA Loan Sheet','Override DB data · LOAN_APPLICATION_ID, LI_CHARGES, DISBURSEMENT_DATE','optional')}
        </div>
      </div>

      <!-- PR Register — dynamic rows, exactly like MI partner inputs -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title">Step 2 — PR Register(s)</span>
          <span style="font-size:11px;color:var(--muted)">One file per month · press ＋ to add more</span>
        </div>
        <div id="li-pr-rows" style="display:flex;flex-direction:column;gap:8px">
          <div class="recon-file-card" style="display:flex;align-items:center;gap:10px">
            <div style="flex:1">
              <div class="recon-file-label">PR Register 1</div>
              <div class="recon-file-sub">POLICY_NUMBER · BOOKINGID_PLANID · PRODUCT_LOB · GROSS_PREMIUM</div>
              <input type="file" class="li-pr-file" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted);margin-top:4px">
            </div>
          </div>
        </div>
        <button type="button" id="li-pr-add" class="btn-o"
                style="margin-top:8px;font-size:11px;padding:5px 12px">
          ＋ Add PR Month
        </button>
      </div>

      <!-- Monthly Disbursal Reports — dynamic rows -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title">Step 3 — Monthly Disbursal Reports</span>
          <span style="font-size:11px;color:var(--muted)">Auto-loaded from database · upload additional files for cases not in DB</span>
        </div>
        <div id="li-dr-rows" style="display:flex;flex-direction:column;gap:8px">
          <div class="recon-file-card" style="display:flex;align-items:center;gap:10px">
            <div style="flex:1">
              <div class="recon-file-label">Disbursal Report 1</div>
              <div class="recon-file-sub">LOAN_APPLICATION_ID · LOAN_STATUS · DISBURSEMENT_DATE</div>
              <input type="file" class="li-dr-file" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted);margin-top:4px">
            </div>
          </div>
        </div>
        <button type="button" id="li-dr-add" class="btn-o"
                style="margin-top:8px;font-size:11px;padding:5px 12px">
          ＋ Add Disbursal Month
        </button>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Step 4 — Run</span></div>
        <button class="btn-g" id="li-run-btn" style="padding:9px 28px">▶  Run Reconciliation</button>
      </div>
    </div>

    <!-- Loading -->
    <div id="li-loading" style="display:none">
      <div class="card" style="padding:32px;text-align:center">
        <div style="font-size:13px;font-weight:500;color:var(--navy);margin-bottom:16px" id="li-progress-label">Processing…</div>
        <div style="background:rgba(11,31,58,.08);border-radius:4px;height:6px;overflow:hidden;margin-bottom:8px">
          <div id="li-progress-bar" style="height:100%;width:0%;background:var(--gold);border-radius:4px;transition:width .3s"></div>
        </div>
        <div style="font-size:11px;color:var(--muted)" id="li-progress-pct">0%</div>
      </div>
    </div>

    <!-- Results -->
    <div id="li-results" style="display:none">
      <!-- KPI strip -->
      <div id="li-kpi-strip" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px"></div>

      <!-- Tabs -->
      <div class="tab-bar" id="li-tabs"></div>
      <div id="li-tab-content"></div>
    </div>
  `;

    // wire buttons
    document.getElementById('li-run-btn')?.addEventListener('click', _runLI);

    document.getElementById('li-reset-btn')?.addEventListener('click', () => {
        _data = null;
        _showUpload('li');
        _hint('li-hint','','');
        document.getElementById('li-export-btn').style.display = 'none';
        // Reset PR rows back to 1 empty row
        const prRows = document.getElementById('li-pr-rows');
        if (prRows) {
            prRows.innerHTML = `
        <div class="recon-file-card" style="display:flex;align-items:center;gap:10px">
          <div style="flex:1">
            <div class="recon-file-label">PR Register 1</div>
            <div class="recon-file-sub">POLICY_NUMBER · BOOKINGID_PLANID · PRODUCT_LOB · GROSS_PREMIUM</div>
            <input type="file" class="li-pr-file" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted);margin-top:4px">
          </div>
        </div>`;
        }
        // Reset DR rows back to 1 empty row
        const drRows = document.getElementById('li-dr-rows');
        if (drRows) {
            drRows.innerHTML = `
        <div class="recon-file-card" style="display:flex;align-items:center;gap:10px">
          <div style="flex:1">
            <div class="recon-file-label">Disbursal Report 1</div>
            <div class="recon-file-sub">LOAN_APPLICATION_ID · LOAN_STATUS · DISBURSEMENT_DATE</div>
            <input type="file" class="li-dr-file" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted);margin-top:4px">
          </div>
        </div>`;
        }
    });

    // ── Mode toggle: period inputs only ─────────────────────────────
    document.getElementById('li-mode')?.addEventListener('change', function() {
        const isRange = this.value === 'range';
        document.getElementById('li-month-wrap').style.display = isRange ? 'none' : 'block';
        document.getElementById('li-range-wrap').style.display = isRange ? 'flex' : 'none';
    });

    // ── Dynamic row adders — same pattern as MI partner PR inputs ──
    function _addRow(containerId, label, cls, sub) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const n   = container.querySelectorAll('.' + cls).length + 1;
        const div = document.createElement('div');
        div.className = 'recon-file-card';
        div.style.cssText = 'display:flex;align-items:center;gap:10px';
        div.innerHTML = `
      <div style="flex:1">
        <div class="recon-file-label">${label} ${n}</div>
        <div class="recon-file-sub">${sub}</div>
        <input type="file" class="${cls}" accept=".xlsx,.xls,.csv"
               style="font-size:11px;color:var(--muted);margin-top:4px">
      </div>
      <button type="button"
              style="background:none;border:none;cursor:pointer;font-size:20px;
                     color:var(--muted);padding:0 4px;flex-shrink:0;align-self:flex-start;
                     margin-top:12px"
              onclick="this.closest('.recon-file-card').remove()">×</button>
    `;
        container.appendChild(div);
    }

    document.getElementById('li-pr-add')?.addEventListener('click', () =>
        _addRow('li-pr-rows', 'PR Register',
            'li-pr-file',
            'POLICY_NUMBER · BOOKINGID_PLANID · PRODUCT_LOB · GROSS_PREMIUM'));

    document.getElementById('li-dr-add')?.addEventListener('click', () =>
        _addRow('li-dr-rows', 'Disbursal Report',
            'li-dr-file',
            'LOAN_APPLICATION_ID · LOAN_STATUS · DISBURSEMENT_DATE'));
    document.getElementById('li-export-btn')?.addEventListener('click', () => {
        if (!_data) return;
        const label = _data.summary.label || 'Recon';
        const safe  = label.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');
        _downloadXLSX(_liExportXLSX(_data, label), `LI_Float_Recon_${safe}.xlsx`);
    });

    async function _runLI() {
        const floatFile   = document.getElementById('li-float-input')?.files?.[0];
        const hanaFile    = document.getElementById('li-hana-input')?.files?.[0];
        const monthFiles  = Array.from(
            document.querySelectorAll('#li-dr-rows .li-dr-file')
        ).map(inp => inp.files?.[0]).filter(Boolean);

        // ── Auto-fetch from DB ────────────────────────────────────────
        let _dbReconData = [];
        const badge = document.getElementById('li-db-badge');
        try {
            const dbRes = await API.Disbursal.getReconData();
            _dbReconData = (dbRes && dbRes.data) ? dbRes.data : [];
            if (badge) badge.textContent = '✅ ' + _dbReconData.length.toLocaleString() + ' from DB';
        } catch(e) {
            console.warn('[LI] DB fetch failed:', e.message);
            if (badge) badge.textContent = '⚠️ DB unavailable';
        }
        const mode        = document.getElementById('li-mode')?.value || 'month';
        const monthLabel  = document.getElementById('li-month')?.value?.trim() || "Mar'26";
        const rangeStart  = document.getElementById('li-range-start')?.value || '';
        const rangeEnd    = document.getElementById('li-range-end')?.value || '';

        // PR files — same input for both month and range mode
        // In range mode user Ctrl+Clicks to select multiple files at once
        // Collect all PR files from dynamic rows (class=li-pr-file)
        const prFiles = Array.from(
            document.querySelectorAll('#li-pr-rows .li-pr-file')
        ).map(inp => inp.files?.[0]).filter(Boolean);

        if (!floatFile) { _hint('li-hint','danger','<strong>Float Register is required.</strong>'); return; }
        if (!prFiles.length) {
            _hint('li-hint','danger',
                '<strong>PR Register is required.</strong> Upload at least one PR file. ' +
                'For date range use ＋ Add PR Month to add more files.');
            return;
        }
        if (!window.XLSX){ _hint('li-hint','danger','SheetJS library not loaded — please refresh the page.'); return; }

        _hint('li-hint','','');
        _showLoad('li');
        const setP = _progress('li-progress-label','li-progress-bar','li-progress-pct');

        try {
            // 1. Period
            const MO = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
            if (mode === 'month') {
                // Handles both 'Mar 2026' and "Mar'26" formats
                const lbl = monthLabel.trim();
                const m1  = lbl.match(/^([A-Za-z]+)[' ](\d{2,4})$/);
                if (!m1) throw new Error('Invalid month: "' + monthLabel + '". Use "Mar\'26" or "Mar 2026"');
                const moStr = m1[1].slice(0,3).toUpperCase();
                const mn    = MO[moStr];
                let   y     = parseInt(m1[2]);
                if (y < 100) y += 2000;
                if (!mn || isNaN(y)) throw new Error('Invalid month: "' + monthLabel + '"');
                periodStart = new Date(y, mn-1, 1);
                periodEnd   = new Date(y, mn, 0);
                periodLabel = monthLabel;
            } else {
                if (!rangeStart || !rangeEnd) throw new Error('Please set both Range Start and Range End dates.');
                periodStart = new Date(rangeStart);
                periodEnd   = new Date(rangeEnd);
                periodLabel = `${rangeStart} to ${rangeEnd}`;
            }

            setP(8, 'Reading Float Register…');
            const floatWB = await _readWB(floatFile);
            const allFloatRows = _sheetToRows(floatWB, floatWB.SheetNames[0], 'POLICY_NUMBER');
            console.log('[LI] Float: all rows =', allFloatRows.length, '| sample keys:', Object.keys(allFloatRows[0]||{}));

            // Filter float rows to period
            // Range mode: use TRANS_DATE date range (spans multiple months)
            // Month mode: prefer MONTHS column exact match, fall back to TRANS_DATE
            // Normalize month label for comparison
            // Converts "Mar 2026" → "Mar'26" and "July'25" → "Jul'25"
            const normMonth = (s) => {
                if (!s) return '';
                s = String(s).trim();
                // "Mar 2026" → "Mar'26"
                const m1 = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
                if (m1) {
                    const mo = m1[1].substring(0,3);
                    return mo.charAt(0).toUpperCase() + mo.slice(1).toLowerCase()
                        + "'" + m1[2].slice(-2);
                }
                // "July'25" → "Jul'25"
                const m2 = s.match(/^([A-Za-z]+)'(\d{2})$/);
                if (m2) {
                    const mo = m2[1].substring(0,3);
                    return mo.charAt(0).toUpperCase() + mo.slice(1).toLowerCase()
                        + "'" + m2[2];
                }
                return s;
            };
            const monthLabelNorm = normMonth(monthLabel);

            const floatRows = allFloatRows.filter(r => {
                // Month mode with MONTHS column — normalized match
                if (mode === 'month') {
                    const mVal = _g(r,'MONTHS','Months','months');
                    if (mVal && String(mVal).trim()) {
                        return normMonth(String(mVal).trim()) === monthLabelNorm;
                    }
                }
                // Date range filter (range mode, or month mode without MONTHS col)
                const dtRaw = _g(r,'TRANS_DATE','TRANSACTION_DATE','DATE');
                if (!dtRaw) return mode !== 'range'; // in range mode, drop blank-date rows
                const dt = new Date(dtRaw);
                if (isNaN(dt.getTime())) return mode !== 'range';
                return dt >= periodStart && dt <= periodEnd;
            });
            console.log(`[LI] Float: ${allFloatRows.length} total → ${floatRows.length} in period (mode=${mode})`);
            if (floatRows.length === 0) {
                const sampleMonths = [...new Set(allFloatRows.map(r=>_g(r,'MONTHS','Months','')).filter(Boolean))].slice(0,6);
                _hint('li-hint','danger',
                    `<strong>No float rows found for the selected period.</strong><br>` +
                    (sampleMonths.length ? `Available MONTHS values in file: <code>${sampleMonths.join(', ')}</code><br>` : '') +
                    `Selected: <strong>${periodLabel}</strong>. Check your period selection matches the MONTHS column exactly.`);
                _showUpload('li'); return;
            }

            setP(22, `Reading PR Register(s) — ${prFiles.length} file(s)…`);
            let prRows = [];
            for (let pi = 0; pi < prFiles.length; pi++) {
                setP(22 + Math.round(pi/Math.max(prFiles.length,1)*12),
                    `Reading PR file ${pi+1}/${prFiles.length}: ${prFiles[pi].name}…`);
                const prWB  = await _readWB(prFiles[pi]);
                // Try 'POLICY' keyword sheet first, then first sheet
                const found = _findSheet(prWB, 'POLICY');
                const rows  = found.rows.length ? found.rows : _sheetToRows(prWB, prWB.SheetNames[0], '');
                prRows = prRows.concat(rows);
                console.log(`[LI] PR file ${pi+1}: ${rows.length} rows from ${prFiles[pi].name}`);
            }
            console.log(`[LI] PR combined: ${prRows.length} rows from ${prFiles.length} file(s)`);
            if (!prRows.length) {
                _hint('li-hint','danger','<strong>PR Register(s) empty.</strong> Check files are valid Excel sheets.');
                _showUpload('li'); return;
            }

            setP(38, 'Loading SAP HANA data…');
            let hanaRows = [];

            // DB primary — map to HANA format
            if (_dbReconData.length) {
                hanaRows = _dbReconData.map(r => ({
                    LOAN_APPLICATION_ID: r.loanApplicationId || '',
                    LI_CHARGES:          r.liCharges || 0,
                    DISBURSEMENT_DATE:   r.disbursementDate || '',
                }));
                console.log('[LI] HANA from DB:', hanaRows.length);
            }
            // File override — merge (file wins for same loan ID)
            if (hanaFile) {
                const hanaWB  = await _readWB(hanaFile);
                const found   = _findSheet(hanaWB, 'LOAN');
                const fileRows= found.rows;
                const fileIds = new Set(fileRows.map(r =>
                    String(_g(r,'LOAN_APPLICATION_ID','LOANAPPLICATIONID','LOAN_ID')||'').trim()));
                const dbOnly  = hanaRows.filter(r => !fileIds.has(String(r.LOAN_APPLICATION_ID||'').trim()));
                hanaRows = [...fileRows, ...dbOnly];
                console.log('[LI] HANA merged: file=' + fileRows.length + ' + db-only=' + dbOnly.length);
            }

            setP(52, 'Loading loan status data…');
            const monthEntries = [];
            const MO_NAME = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

            // DB primary — synthetic entry with all records
            if (_dbReconData.length) {
                const dbRows = _dbReconData
                    .filter(r => r.loanApplicationId)
                    .map(r => _normRow({
                        LOAN_APPLICATION_ID: r.loanApplicationId,
                        LOAN_STATUS:         r.loanStatus || '',
                        DISBURSEMENT_DATE:   r.disbursementDate || '',
                    }));
                if (dbRows.length) {
                    monthEntries.push({ rows: dbRows, label: 'DB Records' });
                    console.log('[LI] DR from DB:', dbRows.length);
                }
            }

            // Helper: detect dominant month from DISBURSEMENT_DATE / DISBURSAL_DATE column
            function _detectDRMonth(rows) {
                const dateKeys = Object.keys(rows[0]||{}).filter(k =>
                    k.replace(/[^A-Z]/g,'').includes('DISBURS') || k.replace(/[^A-Z]/g,'').includes('DISB')
                );
                if (!dateKeys.length) return null;
                const dateKey = dateKeys[0];
                const ymCount = {};
                for (const r of rows) {
                    const raw = r[dateKey];
                    if (!raw) continue;
                    const d = new Date(raw);
                    if (isNaN(d.getTime())) continue;
                    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                    ymCount[ym] = (ymCount[ym]||0) + 1;
                }
                const best = Object.entries(ymCount).sort((a,b)=>b[1]-a[1])[0];
                if (!best) return null;
                const [yr, mo] = best[0].split('-');
                return `${MO_NAME[parseInt(mo)]} ${yr}`;
            }

            for (let i = 0; i < monthFiles.length; i++) {
                setP(52 + Math.round(i/Math.max(monthFiles.length,1)*15),
                    `Reading disbursal file ${i+1}/${monthFiles.length}: ${monthFiles[i].name}…`);
                const mwb   = await _readWB(monthFiles[i]);
                const found = _findSheet(mwb, 'LOAN');
                const rows  = found.rows.length ? found.rows : _sheetToRows(mwb, mwb.SheetNames[0], '');
                if (!rows.length) continue;

                // 1st priority: detect from DISBURSEMENT_DATE column
                let mlabel = _detectDRMonth(rows);

                // 2nd priority: filename pattern (Jan26, Feb_2026, etc.)
                if (!mlabel) {
                    const fnMatch = monthFiles[i].name.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^0-9]*([0-9]{2,4})/i);
                    if (fnMatch) {
                        const abbr = fnMatch[1].charAt(0).toUpperCase() + fnMatch[1].slice(1).toLowerCase();
                        const yr   = fnMatch[2].length === 2 ? '20' + fnMatch[2] : fnMatch[2];
                        mlabel = `${abbr} ${yr}`;
                    }
                }

                // 3rd fallback: use current month label
                if (!mlabel) mlabel = monthLabel || `DR File ${i+1}`;

                monthEntries.push({ rows, label: mlabel });
                console.log(`[LI] Disbursal file ${i+1}: ${monthFiles[i].name} → month="${mlabel}" | ${rows.length} rows`);
            }
            console.log(`[LI] Disbursal files: ${monthEntries.length} loaded | months: ${monthEntries.map(e=>e.label).join(', ')}`);

            setP(72, 'Running reconciliation logic…');
            const result = _liRunRecon(floatRows, allFloatRows, prRows, hanaRows, monthEntries);
            console.log('[LI] Issued:', result.issuedRows.length, '| Cancel:', result.cancelRows.length,
                '| TopUp:', result.topupRows.length, '| Queries:', result.queries.length);

            // Warn if all rows ended up as top-up (column detection failure)
            if (result.issuedRows.length === 0 && result.topupRows.length > 0) {
                const keys = Object.keys(allFloatRows[0] || {});
                const hasPol = keys.some(k => k.includes('POLICY'));
                if (!hasPol) {
                    _hint('li-hint','danger',
                        `<strong>Column detection failed.</strong> Could not find <code>POLICY_NUMBER</code> in your Float file.<br>
             Actual columns found: <code>${keys.join(', ')}</code><br>
             Please ensure the Float Register has a column named <strong>POLICY_NUMBER</strong>.`);
                    _showUpload('li');
                    return;
                }
                const prKeys = Object.keys(prRows[0] || {});
                _hint('li-hint','danger',
                    `<strong>No Issued Cases found.</strong> ${result.topupRows.length.toLocaleString()} rows are Top Up.<br>
           Float columns: <code>${keys.slice(0,8).join(', ')}</code><br>
           PR columns: <code>${prKeys.slice(0,8).join(', ')}</code><br>
           <strong>Check:</strong> PRODUCT_LOB in PR should have values <code>Health</code> or <code>PA</code>.<br>
           Also check that TRANS_DATE falls within your selected period (${periodLabel}).`);
                _showUpload('li');
                return;
            }

            result.summary.label = periodLabel;
            _data = result;

            window._lastLIResult = {
                monthLabel:  periodLabel,
                total:       result.summary.total,
                match:       result.summary.match,
                matchPct:    result.summary.matchPct,
                queries:     result.summary.queries,
                totalFloat:  result.summary.totalFloat,
                prMismatch:  result.summary.prMismatch || 0,
            };
            if (typeof _updateDashboard === 'function') _updateDashboard();

            setP(100, 'Done!');
            setTimeout(() => _liShowResults(result, periodLabel), 250);

        } catch(err) {
            console.error('[LI]', err);
            _hint('li-hint','danger', `<strong>Error:</strong> ${err.message}`);
            _showUpload('li');
        }
    }

    function _liShowResults(result, label) {
        const { issuedRows, cancelRows, topupRows, queries, summary } = result;
        _showResults('li');
        document.getElementById('li-export-btn').style.display = 'inline-block';

        // KPI strip
        const kpis = [
            { label:'TOTAL LOANS',       value: summary.total.toLocaleString(),       sub:'Issued this month',   color:'var(--navy-lt)' },
            { label:'MATCH',             value: summary.match.toLocaleString(),        sub:`${summary.matchPct}%`, color:'var(--green)' },
            { label:'OPEN QUERIES',      value: summary.queries.toLocaleString(),      sub:'Need resolution',     color:'var(--red)' },
            { label:'LOAN CANCELLED',    value: summary.cancelled.toLocaleString(),    sub:'Policy to cancel',    color:'var(--navy)' },
            { label:'NOT DISBURSED',     value: summary.notDisbursed.toLocaleString(), sub:'Policy to cancel',    color:'var(--navy)' },
            { label:'TOTAL FLOAT (₹)',   value: '₹' + _inr(summary.totalFloat),       sub:'Deducted this month', color:'var(--gold)' },
            { label:'FLOAT = PR MATCH',  value: summary.prMatch.toLocaleString(),      sub:'Premium verified',    color:'var(--green)' },   // v5
            { label:'FLOAT ≠ PR',        value: summary.prMismatch.toLocaleString(),   sub:'Premium mismatch',    color:'var(--red)' },     // v5
        ];
        document.getElementById('li-kpi-strip').innerHTML = kpis.map(k => `
      <div class="stat-chip" style="min-width:140px;flex:1;border-top:3px solid ${k.color}">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:4px">${k.label}</div>
        <div style="font-size:20px;font-weight:500;color:var(--navy);line-height:1">${k.value}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">${k.sub}</div>
      </div>`).join('');

        // Tabs
        const tabs = [
            { id:'issued',   label:`Issued Cases (${issuedRows.length})` },
            { id:'queries',  label:`LI Queries (${queries.length})` },
            { id:'cancel',   label:`Cancellation (${cancelRows.length})` },
            { id:'topup',    label:`Top Up (${topupRows.length})` },
            { id:'prcheck',  label:`Float vs PR (${summary.prMismatch} Mismatch)` },  // v5
        ];

        document.getElementById('li-tabs').innerHTML = tabs.map((t,i) =>
            `<div class="tab-item${i===0?' active':''}" data-tab="${t.id}" onclick="
        document.querySelectorAll('#li-tabs .tab-item').forEach(el=>el.classList.remove('active'));
        this.classList.add('active');
        _liRenderTab('${t.id}');
      ">${t.label}</div>`
        ).join('');

        // Store data for tab rendering
        window._liTabData = { issuedRows, cancelRows, topupRows, queries };
        _liRenderTab('issued');
    }

    window._liRenderTab = function(id) {
        const { issuedRows, cancelRows, topupRows, queries } = window._liTabData || {};
        const content = document.getElementById('li-tab-content');
        if (!content) return;

        const issuedCols = [
            {key:'Loan ID',label:'Loan ID'},{key:'Policy Issue Date',label:'Issue Date'},
            {key:'Policy No - Health',label:'Policy Health'},{key:'Debit Float (Health)',label:'Debit H (₹)'},
            {key:'Premium - Health',label:'Prem H (₹)'},
            {key:'Policy No - PA',label:'Policy PA'},{key:'Debit Float (PA)',label:'Debit PA (₹)'},
            {key:'Premium - PA',label:'Prem PA (₹)'},
            {key:'Total Deduction (Float)',label:'Total Dedn'},{key:'LI Amount (SAP)',label:'SAP LI Amt'},
            {key:'Difference',label:'Diff'},{key:'Loan Status',label:'Loan Status'},
            {key:'_FINAL_STATUS',label:'Final Status',badge:true},
        ];
        const cancelCols = [
            {key:'Loan ID',label:'Loan ID'},{key:'Type',label:'Type'},
            {key:'Policy No - Health',label:'Policy Health'},{key:'Credit Health',label:'Credit H'},
            {key:'Debit Health (Original)',label:'Debit H (Orig)'},
            {key:'Policy No - PA',label:'Policy PA'},{key:'Credit PA',label:'Credit PA'},
            {key:'Debit PA (Original)',label:'Debit PA (Orig)'},
            {key:'Total Credit',label:'Total Credit'},{key:'Total Debit',label:'Total Debit'},
            {key:'Difference',label:'Diff'},{key:'_CANCEL_REM',label:'Remarks',badge:true},
        ];

        content.innerHTML = `<div class="table-wrap" id="li-tbl-wrap"></div>`;
        if (id==='issued')  _renderTable('li-tbl-wrap', issuedRows, issuedCols);
        if (id==='queries') _renderTable('li-tbl-wrap', queries,    issuedCols);
        if (id==='cancel')  _renderTable('li-tbl-wrap', cancelRows, cancelCols);
        if (id==='topup')   _renderTable('li-tbl-wrap', topupRows,
            [{key:'Date',label:'Date'},{key:'Type',label:'Type'},{key:'Details',label:'Details'},
                {key:'Credit',label:'Credit (₹)'},{key:'Debit',label:'Debit (₹)'}]);
    };
});

/** File upload card HTML */
function _liFileCard(id, title, sub, badge) {
    const badgeHtml = badge === 'required'
        ? `<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:var(--red-bg);color:var(--red-text);margin-left:6px">required</span>`
        : `<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:var(--gold-pale);color:var(--amber);margin-left:6px">optional</span>`;
    return `
    <div style="border:1px dashed var(--border);border-radius:8px;padding:12px">
      <div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:2px">${title}${badgeHtml}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:8px">${sub}</div>
      <input type="file" id="${id}-input" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted)">
    </div>`;
}