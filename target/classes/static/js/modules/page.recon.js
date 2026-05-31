/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * page.recon.js — Loan Insurance & Motor Insurance Recon Pages
 *
 * ARCHITECTURE:
 *   This file registers two Router pages: 'loanins' and 'motor'.
 *   All Excel logic runs 100% client-side via SheetJS (XLSX).
 *   Python backend generates the final .xlsx download — the JS
 *   does classification + display, Python does formatted export.
 *
 * LI LOGIC SOURCE: LI_Float_Reconciliation_Tool_v4.ipynb (exact)
 * MI LOGIC SOURCE: mi_recon.py (exact)
 *
 * Author : Jatin Mittal | jatin.mittal@cars24.com
 * Version: 5.0.0 — Clean rebuild
 * ================================================================
 */

/* ================================================================
   SHARED UTILITIES
   ================================================================ */

/** Normalise column key: UPPER_SNAKE_CASE */
function _c(s) {
  return String(s ?? '').trim().toUpperCase().replace(/[\s\-\.\/]+/g, '_');
}

/** Normalise all keys in a row object */
function _normRow(row) {
  const out = {};
  for (const k of Object.keys(row)) {
    const nk = _c(k);
    const v  = row[k];
    out[nk]  = (v === null || v === undefined) ? '' :
               (typeof v === 'string' ? v.trim() : v);
  }
  return out;
}

/** Get first non-empty value from a normalised row, trying multiple column names */
function _g(row, ...cols) {
  for (const c of cols) {
    const v = row[_c(c)];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

/** Coerce to number */
function _n(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

/** True if blank / nan / none */
function _blank(v) {
  return !v || /^(nan|none|null|undefined|)$/i.test(String(v).trim());
}

/** Stable string key — strips trailing .0 from float IDs */
function _k(v) {
  const s = String(v ?? '').trim();
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Format date → DD-MM-YYYY */
function _dt(v) {
  if (!v && v !== 0) return '';
  try {
    if (typeof v === 'number' && v > 40000) {
      // Excel serial date
      const d = new Date((v - 25569) * 86400 * 1000);
      return d.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,'-');
    }
    if (v instanceof Date) return v.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,'-');
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,'-');
  } catch(_) {}
  return String(v);
}

/** Month label → sort integer (Jan 2026 → 202601) */
function _msk(label) {
  const mo = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
  try {
    const p = String(label).trim().toUpperCase().split(/\s+/);
    const m = mo[p[0].slice(0,3)]; const y = parseInt(p[1]);
    return (isNaN(y) || !m) ? 0 : y * 100 + m;
  } catch(_) { return 0; }
}

/** Read file → SheetJS workbook (cellDates:false keeps text as text) */
function _readWB(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('Cannot read: ' + file.name));
    r.onload  = ev => {
      try { res(XLSX.read(new Uint8Array(ev.target.result), { type:'array', cellDates:false, raw:false })); }
      catch(e) { rej(e); }
    };
    r.readAsArrayBuffer(file);
  });
}

/**
 * Read a sheet → normalised row objects.
 * Scans up to 15 rows for a row containing `keyword` (case-insensitive)
 * to handle Excel files with title rows above the actual header.
 */
function _sheetToRows(wb, sheetName, keyword) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', blankrows:false, raw:false });
  let hdrIdx = 0;
  if (keyword) {
    const kw = keyword.toUpperCase();
    for (let i = 0; i < Math.min(15, raw.length); i++) {
      if (raw[i].some(c => String(c).toUpperCase().includes(kw))) { hdrIdx = i; break; }
    }
  }
  const hdrs = raw[hdrIdx] || [];
  const rows = [];
  for (let i = hdrIdx + 1; i < raw.length; i++) {
    const rowArr = raw[i];
    // skip fully blank rows
    if (!rowArr.some(v => v !== '' && v !== null && v !== undefined)) continue;
    const obj = {};
    hdrs.forEach((h, ci) => {
      if (h) obj[String(h).trim()] = rowArr[ci] ?? '';
    });
    rows.push(_normRow(obj));
  }
  return rows;
}

/** Find first sheet that has a row containing keyword */
function _findSheet(wb, keyword) {
  for (const sn of wb.SheetNames) {
    const rows = _sheetToRows(wb, sn, keyword);
    if (rows.length) return { rows, sheetName: sn };
  }
  return { rows: [], sheetName: '' };
}

/** Progress bar helper */
function _progress(labelId, barId, pctId) {
  return (pct, msg) => {
    const b = document.getElementById(barId);
    const l = document.getElementById(labelId);
    const p = document.getElementById(pctId);
    if (b) b.style.width = pct + '%';
    if (l) l.textContent = msg || '';
    if (p) p.textContent = pct + '%';
  };
}

/** Show/hide loading overlay */
function _showLoad(prefix) {
  const z = document.getElementById(prefix + '-upload-zone');
  const ld = document.getElementById(prefix + '-loading');
  const rs = document.getElementById(prefix + '-results');
  if (z)  z.style.display  = 'none';
  if (ld) ld.style.display = 'block';
  if (rs) rs.style.display = 'none';
}

function _showResults(prefix) {
  const ld = document.getElementById(prefix + '-loading');
  const rs = document.getElementById(prefix + '-results');
  if (ld) ld.style.display = 'none';
  if (rs) rs.style.display = 'block';
}

function _showUpload(prefix) {
  const z  = document.getElementById(prefix + '-upload-zone');
  const ld = document.getElementById(prefix + '-loading');
  const rs = document.getElementById(prefix + '-results');
  if (z)  z.style.display  = 'block';
  if (ld) ld.style.display = 'none';
  if (rs) rs.style.display = 'none';
}

/** Display inline error/info hint */
function _hint(id, type, html) {
  const el = document.getElementById(id);
  if (!el) return;
  const colors = {
    danger:  { bg:'var(--red-bg)',    border:'var(--red)',   color:'var(--red-text)' },
    success: { bg:'var(--green-bg)',  border:'var(--green)', color:'var(--green-text)' },
    info:    { bg:'var(--gold-pale)', border:'var(--gold)',  color:'var(--amber)' },
    '':      { bg:'transparent',      border:'transparent',  color:'var(--text)' },
  };
  const s = colors[type] || colors[''];
  el.style.cssText = `display:block;padding:10px 14px;border-radius:6px;font-size:12px;line-height:1.6;
    background:${s.bg};border-left:3px solid ${s.border};color:${s.color};margin-bottom:12px;`;
  el.innerHTML = html;
}

/** Render a data table */
function _renderTable(containerId, rows, cols) {
  const el = document.getElementById(containerId);
  if (!el || !rows.length) {
    if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px;">No data</div>';
    return;
  }
  const thead = cols.map(c => `<th style="white-space:nowrap">${c.label}</th>`).join('');
  const tbody = rows.slice(0, 50).map(r => {
    const cells = cols.map(c => {
      const v = r[c.key] ?? '';
      if (c.badge) {
        const vs = String(v).toLowerCase();
        let bg = 'var(--gold-pale)', color = 'var(--amber)';
        if (vs === 'match' || vs.includes('knocked')) { bg = 'var(--green-bg)'; color = 'var(--green-text)'; }
        else if (vs.includes('cancel') || vs.includes('mismatch') || vs.includes('not disbursed') || vs.includes('shortfall')) {
          bg = 'var(--red-bg)'; color = 'var(--red-text)';
        }
        return `<td><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;background:${bg};color:${color};white-space:nowrap">${v}</span></td>`;
      }
      return `<td style="white-space:nowrap">${v}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  el.innerHTML = `
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
    ${rows.length > 50 ? `<div style="padding:8px 12px;font-size:11px;color:var(--muted)">Showing 50 of ${rows.length.toLocaleString()} rows — export for full data</div>` : ''}
  `;
}

/** Trigger browser download of ArrayBuffer as .xlsx */
function _downloadXLSX(bytes, filename) {
  const blob = new Blob([bytes], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Indian locale number format */
function _inr(n) {
  return Number(n).toLocaleString('en-IN');
}


/* ================================================================
   BANK RECONCILIATION — PAGE
   ================================================================ */
Router.register('bank', function(panel) {
  const s = AppData.bankRecon.summary;
  const entries = AppData.bankRecon.entries;

  panel.innerHTML = `
    <div class="module-hero">
      <div>
        <div class="hero-label">Reconciliation</div>
        <div class="hero-title">Bank Reconciliation</div>
        <div class="hero-sub">Ledger vs bank statement matching · open items · variance analysis</div>
      </div>
    </div>

    <!-- Summary chips -->
    <div class="chips-strip">
      <div class="stat-chip">
        <div class="chip-val">${s.ledgerTotal}</div>
        <div class="chip-lbl">Ledger Total</div>
      </div>
      <div class="stat-chip">
        <div class="chip-val">${s.bankTotal}</div>
        <div class="chip-lbl">Bank Total</div>
      </div>
      <div class="stat-chip">
        <div class="chip-val negative">${s.difference}</div>
        <div class="chip-lbl">Difference</div>
      </div>
      <div class="stat-chip">
        <div class="chip-val">${s.matched}</div>
        <div class="chip-lbl">Matched</div>
      </div>
    </div>

    <!-- Entries table -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Statement entries</span>
        <span class="card-action">Export →</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Reference</th><th>Narration</th>
              <th>Ledger (₹)</th><th>Bank (₹)</th><th>Diff (₹)</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(r => `
              <tr>
                <td>${r.date}</td>
                <td style="font-family:monospace;font-size:11px">${r.ref}</td>
                <td>${r.narration}</td>
                <td style="text-align:right">${r.ledger}</td>
                <td style="text-align:right">${r.bank}</td>
                <td style="text-align:right;font-weight:500;color:${r.diff === '—' ? 'var(--green)' : 'var(--red)'}">${r.diff}</td>
                <td>${UI.tag(r.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>${entries.length} entries</span>
        <span style="color:var(--gold);cursor:pointer">Upload statement →</span>
      </div>
    </div>

    <!-- Notice -->
    <div class="notice" style="margin-top:14px">
      <strong>Live upload coming soon</strong> — upload your ledger and bank statement Excel files to run automatic matching. Currently showing sample data.
    </div>
  `;
});

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
            <input class="form-input" id="li-month" value="Mar 2026" placeholder="e.g. Mar 2026" style="width:120px">
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
        <div class="card-header"><span class="card-title">Step 1 — Float Register &amp; SAP HANA</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${_liFileCard('li-float','Float Register','Go Digit Float file · POLICY_NUMBER, TRANS_DATE, DEBIT_AMT / CREDIT_AMT','required')}
          ${_liFileCard('li-hana','SAP HANA Loan Sheet','LOAN_APPLICATION_ID, LI_CHARGES, DISBURSEMENT_DATE','optional')}
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
          <span style="font-size:11px;color:var(--muted)">Month auto-detected from DISBURSEMENT_DATE · press ＋ to add more</span>
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
    // Collect all DR files from dynamic rows (class=li-dr-file)
    const monthFiles = Array.from(
      document.querySelectorAll('#li-dr-rows .li-dr-file')
    ).map(inp => inp.files?.[0]).filter(Boolean);
    const mode        = document.getElementById('li-mode')?.value || 'month';
    const monthLabel  = document.getElementById('li-month')?.value?.trim() || 'Mar 2026';
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
      let periodStart, periodEnd, periodLabel;
      const MO = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
      if (mode === 'month') {
        const p = monthLabel.trim().toUpperCase().split(/\s+/);
        const mn = MO[p[0].slice(0,3)]; const y = parseInt(p[1]);
        if (!mn || isNaN(y)) throw new Error(`Invalid month format: "${monthLabel}". Use "Mar 2026"`);
        periodStart = new Date(y, mn-1, 1);
        periodEnd   = new Date(y, mn, 0); // last day of month
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
      const floatRows = allFloatRows.filter(r => {
        // Month mode with MONTHS column — exact string match (most reliable)
        if (mode === 'month') {
          const mVal = _g(r,'MONTHS','Months','months');
          if (mVal && String(mVal).trim()) {
            return String(mVal).trim() === monthLabel;
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

      setP(38, 'Reading SAP HANA…');
      let hanaRows = [];
      if (hanaFile) {
        const hanaWB = await _readWB(hanaFile);
        const found  = _findSheet(hanaWB, 'LOAN');
        hanaRows = found.rows;
        console.log('[LI] HANA rows:', hanaRows.length);
      }

      setP(52, 'Reading Monthly Disbursal Reports…');
      const monthEntries = [];
      const MO_NAME = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

/* ================================================================
   MOTOR INSURANCE — PAGE REGISTRATION
   (mi_recon.py constants + classification mirrored in JS)
   ================================================================ */

// ── MI Constants (from mi_recon.py) ──────────────────────────────

// ================================================================
//  MOTOR INSURANCE — COMPLETE IMPLEMENTATION
//  Exact port of mi_recon.py — all functions included
// ================================================================

const MI_PARTNERS = ['Go Digit','ICICI Lombard','Tata AIG','Zurich Kotak','United India'];

const MI_FLOAT_SHEET_MAP = {
  'Go Digit':      { GS:'Go Digit',        INSURE24:'Go Digit Insure24' },
  'ICICI Lombard': { GS:'ICICI',           INSURE24:'ICICI - INSURE24'  },
  'Zurich Kotak':  { GS:'Kotak',           INSURE24:'Kotak Insure24'    },
  'Tata AIG':      { GS:'TATA AIG',        INSURE24:'TATA Insure24'     },
  'United India':  { GS:'United',          INSURE24:null                },
};

// mirrors PARTNER_CONFIG in mi_recon.py
const MI_PARTNER_CFG = {
  'Go Digit':          { hrow:6, mcol:'Months', polCol:'POLICY_NUMBER', debCol:'DEBIT_AMT',    credCol:'CREDIT_AMT',    iciciNorm:false, cleanReg:false },
  'ICICI':             { hrow:8, mcol:'Months', polCol:'POLICY_NO',     debCol:'DEBIT',         credCol:'CREDIT',        iciciNorm:true,  cleanReg:false },
  'Kotak':             { hrow:8, mcol:'Months', polCol:'Policy Number', debCol:'Debit',         credCol:'Credit',        iciciNorm:false, cleanReg:true  },
  'TATA AIG':          { hrow:7, mcol:'Month',  polCol:'Policy No',     debCol:'Debit Amount',  credCol:'Credit Amount', iciciNorm:false, cleanReg:false },
  'United':            { hrow:7, mcol:'Months', polCol:'Policy Number', debCol:null,            credCol:'Credit Amount', iciciNorm:false, cleanReg:true  },
  'Go Digit Insure24': { hrow:6, mcol:'Months', polCol:'POLICY_NUMBER', debCol:'DEBIT_AMT',    credCol:'CREDIT_AMT',    iciciNorm:false, cleanReg:false },
  'ICICI - INSURE24':  { hrow:7, mcol:'Month',  polCol:'POLICY_NO',     debCol:'debit',         credCol:'credit',        iciciNorm:true,  cleanReg:false },
  'Kotak Insure24':    { hrow:7, mcol:'Months', polCol:'Policy Number', debCol:'Debit',         credCol:'Credit',        iciciNorm:false, cleanReg:true  },
  'TATA Insure24':     { hrow:7, mcol:'Months', polCol:'Policy No',     debCol:'Debit Amount',  credCol:'Credit Amount', iciciNorm:false, cleanReg:false },
};

// mirrors PR_CONFIG in mi_recon.py
const MI_PR_CFG = {
  'Go Digit':      { prPol:'POLICY_NUMBER',  prReg:'VEH_REG_NO',             clean:false, iciciNorm:false },
  'ICICI Lombard': { prPol:'POL_NUM_TXT',    prReg:'MOTOR_REGISTRATION_NUM',  clean:false, iciciNorm:true  },
  'Tata AIG':      { prPol:'policy_no',      prReg:'registration_no',          clean:false, iciciNorm:false },
  'Zurich Kotak':  { prPol:'POLICY NO',      prReg:'Registration Number',      clean:true,  iciciNorm:false },
  'United India':  { prPol:null,             prReg:'Registration No.',          clean:true,  iciciNorm:false },
};

const MI_SAP_TOLERANCE = 200;

const MI_REMARK_COLORS = {
  'Issued':'#D9F0D9','Issue n Cancel':'#FFF2CC','Issue n Credit':'#FFF2CC',
  'Last Month Credit':'#FFE8CC','Double Debit':'#FFE0E0','Double Issued':'#FFE0E0',
  'Double Debit - Same Reg No':'#F4CCCC','Top Up':'#E8E8E8',
};

const MI_FINAL_COLORS = {
  'Match':'#D9F0D9',
  'Match — Greater in Disbursal':'#D9F0D9',
  'Less in Disbursal — Loss Making':'#FFE0E0',
  'MI Not Funded — Loss Impact':'#FFE0E0',
  'Loan Not Disbursed — Policy Need to Cancel':'#FFE0E0',
  'Loan Cancelled — Policy Need to Cancel':'#FFE0E0',
  'Not in PR — Commission at Risk':'#FFE0E0',
  'Double Policy — Cancel One':'#FFE0E0',
  'Loan ID Not Found — Provide to OPS':'#FFF2CC',
  'Amount Mismatch — Recover Diff from CAPL':'#FFF2CC',
  'Not Mapped — Recovery Pending':'#FFF2CC',
};

// ── Utilities ──────────────────────────────────────────────────────
function _miCleanReg(v) {
  if (!v || String(v).trim().toLowerCase().match(/^(nan|none|)$/)) return '';
  return String(v).replace(/[-\/\s]/g,'').toUpperCase().trim();
}
function _miNormIcici(pol) {
  const p = String(pol).trim(); const parts = p.rsplit ? p.rsplit('/',1) : p.split('/').slice(0,-1).concat(p.split('/').slice(-1));
  // mirrors normalize_icici: rsplit('/',1) → take parts[0] if len==2
  const sp = p.split('/');
  return sp.length === 2 ? sp[0] : p;
}
function _miKey(v) {
  const s = String(v||'').trim();
  return s.endsWith('.0') ? s.slice(0,-2) : s;
}
function _miGetPk(raw, iciciNorm) {
  const p = _miKey(String(raw||'').trim());
  if (!p || p==='---') return '';
  if (iciciNorm) {
    const parts = p.split('/');
    return parts.length >= 3 ? parts.slice(0,3).join('/') : p;
  }
  return p;
}
function _miIsBlank(v) {
  return !v || String(v).trim().toLowerCase().match(/^(nan|none|)$/) !== null;
}

// ── Level 1: Float sheet reader ────────────────────────────────────
function _miReadSheet(ws, sheetKey, monthLabel) {
  const cfg = MI_PARTNER_CFG[sheetKey];
  if (!cfg || !ws) return [];
  const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', blankrows:false, raw:false });
  const hdrIdx = Math.max(0, cfg.hrow - 1);
  const hdrs   = raw[hdrIdx] || [];
  const rows   = [];
  for (let i = hdrIdx+1; i < raw.length; i++) {
    if (!raw[i].some(v => v !== '' && v !== null)) continue;
    const obj = {};
    hdrs.forEach((h,ci) => {
      if (h && !String(h).startsWith('Unnamed')) obj[String(h).trim()] = raw[i][ci] ?? '';
    });
    rows.push(obj);
  }
  // Filter by month column (exact match — mirrors mi_recon.py)
  const mCol = cfg.mcol;
  const filtered = rows.filter(r => {
    const v = String(r[mCol] ?? r[mCol.toLowerCase()] ?? '').trim();
    return v === monthLabel;
  });
  console.log(`[MI] ${sheetKey}: total=${rows.length} → filtered=${filtered.length} for "${monthLabel}"`);
  return filtered;
}

function _miScanMonths(ws, sheetKey) {
  const cfg = MI_PARTNER_CFG[sheetKey];
  if (!cfg || !ws) return [];
  const raw    = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', blankrows:false, raw:false });
  const hdrIdx = Math.max(0, cfg.hrow - 1);
  const hdrs   = raw[hdrIdx] || [];
  const mIdx   = hdrs.findIndex(h => String(h).trim() === cfg.mcol ||
                                     String(h).trim().toUpperCase() === 'MONTH');
  if (mIdx < 0) return [];
  const vals = new Set();
  for (let i = hdrIdx+1; i < Math.min(raw.length, hdrIdx+600); i++) {
    const v = String(raw[i][mIdx] ?? '').trim();
    if (v && v.length > 1) { vals.add(v); if (vals.size >= 15) break; }
  }
  return [...vals];
}

// ── Level 1: Classification (mirrors classify_float exactly) ───────
function _miClassify(rows, partner, cfg) {
  const polCol  = cfg.polCol;
  const debCol  = cfg.debCol;
  const credCol = cfg.credCol;
  const iciciN  = cfg.iciciNorm;

  // Reg No from PR (built separately) — for United India, from float row itself
  function getRegFromRow(r) {
    return String(r['Reg_No'] ?? r['Registration No.'] ?? r['Registration Number'] ??
                  r['VEH_REG_NO'] ?? r['MOTOR_REGISTRATION_NUM'] ?? '').trim();
  }

  function getDeb(r) {
    if (debCol && r[debCol] !== undefined && r[debCol] !== '') return _n(r[debCol]);
    // United India / fallback
    for (const alt of ['Total Premium in Portal','Net Premium in Portal','Debit Amount','DEBIT_AMT','debit','Debit']) {
      if (r[alt] !== undefined && r[alt] !== '') return _n(r[alt]);
    }
    return 0;
  }
  function getCred(r) {
    if (credCol && r[credCol] !== undefined && r[credCol] !== '') return _n(r[credCol]);
    for (const alt of ['credit','Credit','CREDIT','Credit Amount']) {
      if (r[alt] !== undefined && r[alt] !== '') return _n(r[alt]);
    }
    return 0;
  }
  function getPk(r) {
    const rawPol = String(r[polCol] ?? r['POLICY_NUMBER'] ?? r['POLICY_NO'] ?? r['Policy No'] ?? '').trim();
    return _miGetPk(rawPol, iciciN);
  }

  // Group by policy key for remark assignment
  const byPol = {};
  for (const r of rows) {
    const pk   = getPk(r);
    const deb  = getDeb(r);
    const cred = getCred(r);
    const isTopUp = !pk && cred > 0 && deb === 0;
    if (isTopUp) continue;
    const key = pk || ('__' + Math.random());
    if (!byPol[key]) byPol[key] = { td:0, tc:0, dc:0 };
    byPol[key].td += deb;
    byPol[key].tc += cred;
    if (deb > 0) byPol[key].dc++;
  }

  const remMap = {};
  for (const [key, g] of Object.entries(byPol)) {
    if (g.td > 0 && g.tc === 0) {
      remMap[key] = g.dc >= 2 ? (partner==='Zurich Kotak' ? 'Double Issued' : 'Double Debit') : 'Issued';
    } else if (g.td > 0 && g.tc > 0) {
      remMap[key] = partner==='Zurich Kotak' ? 'Issue n Credit' : 'Issue n Cancel';
    } else if (g.td === 0 && g.tc > 0) {
      remMap[key] = 'Last Month Credit';
    } else {
      remMap[key] = 'Issued';
    }
  }

  // Double Debit - Same Reg No: find Issued policies sharing a Reg No
  const polByReg = {};
  for (const r of rows) {
    const pk  = getPk(r);
    const reg = _miCleanReg(getRegFromRow(r));
    if (pk && reg && remMap[pk] === 'Issued') {
      if (!polByReg[reg]) polByReg[reg] = new Set();
      polByReg[reg].add(pk);
    }
  }
  const doubleRegs = new Set(Object.entries(polByReg).filter(([,s])=>s.size>1).map(([r])=>r));

  return rows.map(r => {
    const pk   = getPk(r);
    const deb  = getDeb(r);
    const cred = getCred(r);
    const reg  = _miCleanReg(getRegFromRow(r));
    const rawPol = String(r[polCol] ?? r['POLICY_NUMBER'] ?? r['POLICY_NO'] ?? r['Policy No'] ?? '').trim();
    const isTopUp = !pk && cred > 0 && deb === 0;
    let remark;
    if (isTopUp) {
      remark = 'Top Up';
    } else {
      const base = remMap[pk] || 'Issued';
      remark = (base==='Issued' && reg && doubleRegs.has(reg)) ? 'Double Debit - Same Reg No' : base;
    }
    return { ...r, _POL:pk, _RAW_POL:rawPol, _DEB:deb, _CRED:cred, _REG:reg, _REM:remark, _PARTNER:partner };
  });
}

// ── PR Lookup: policy key → PR row ────────────────────────────────
// mirrors the pr_lu dict built in build_issued_sheet()
function _miPRLookup(prRows, partner) {
  if (!prRows || !prRows.length) return { lu:{}, odC:null, tpC:null, totC:null, custC:null, basicC:null };
  const prc = MI_PR_CFG[partner];
  if (!prc || !prc.prPol) return { lu:{}, odC:null, tpC:null, totC:null, custC:null, basicC:null };

  // detect column names from actual data
  const sample = prRows[0] || {};
  const cols   = Object.keys(sample);

  const findCol = (...candidates) => {
    for (const c of candidates) {
      const found = cols.find(k => k.toLowerCase() === c.toLowerCase());
      if (found) return found;
    }
    // partial match fallback
    for (const c of candidates) {
      const found = cols.find(k => k.toLowerCase().includes(c.toLowerCase()));
      if (found) return found;
    }
    return null;
  };

  // OD, TP, Total columns — mirrors pr_od_c, pr_tp_c, pr_tot_c logic
  const odC = findCol('od_premium','od_prem','motor_od_premium_amt','od premium','OD_PREMIUM');
  let tpC=null, totC=null, basicC=null;

  if (partner === 'Tata AIG') {
    basicC = findCol('premiumamount','PremiumAmount') || findCol('premium amount','premium');
  } else {
    tpC  = findCol('tp_premium','tp_prem','motor_tp_premium_amt','tp premium','TP_PREMIUM');
    totC = findCol('gross_premium','tot_premium_amt','total premium','grosspremium','GROSS_PREMIUM') ||
           findCol('gross','tot_prem');
  }
  const custC = findCol('insured_name','cust_full_name','clientname','customer name','name of insured','INSURED_NAME') ||
                findCol('name','cust');

  // Build policy lookup
  const lu = {};
  for (const r of prRows) {
    const rawPol = String(r[prc.prPol] ?? '').trim();
    if (!rawPol) continue;
    const pk = _miGetPk(rawPol, prc.iciciNorm);
    if (pk) lu[pk] = r;
  }
  console.log(`[MI PR] ${partner}: ${Object.keys(lu).length} entries | od:${odC} tp:${tpC} tot:${totC} basic:${basicC}`);
  return { lu, odC, tpC, totC, custC, basicC };
}

// ── PR Reg No lookup: for classify_float Reg_No population ─────────
function _miPRRegLookup(prRows, partner) {
  if (!prRows || !prRows.length) return {};
  const prc = MI_PR_CFG[partner];
  if (!prc || !prc.prPol || !prc.prReg) return {};
  const lu = {};
  for (const r of prRows) {
    const rawPol = String(r[prc.prPol] ?? '').trim();
    if (!rawPol) continue;
    const pk  = _miGetPk(rawPol, prc.iciciNorm);
    const reg = prc.clean ? _miCleanReg(String(r[prc.prReg]??'')) : String(r[prc.prReg]??'').trim();
    if (pk && reg) lu[pk] = reg;
  }
  return lu;
}

// Get PR premium amounts for one policy row — mirrors PR section in build_issued_sheet
function _miPRAmounts(prd, partner, prMeta) {
  if (!prd) return { od:0, tp:0, basic:0, gst:0, total:0, cust:'' };
  const { odC, tpC, totC, custC, basicC } = prMeta;
  const cust = String(prd[custC] ?? '').trim();
  const od   = _n(prd[odC] ?? 0);

  if (partner === 'Tata AIG') {
    const basic = _n(prd[basicC] ?? 0);
    const gst   = Math.round(basic * 0.18 * 100) / 100;
    return { od:0, tp:0, basic, gst, total: Math.round((basic+gst)*100)/100, cust };
  }
  const tp       = _n(prd[tpC] ?? 0);
  const basic    = Math.round((od + tp) * 100) / 100;
  const gst      = Math.round(basic * 0.18 * 100) / 100;
  const prTotRaw = _n(prd[totC] ?? 0);
  const total    = prTotRaw > 0 ? prTotRaw : Math.round((basic+gst)*100)/100;
  return { od, tp, basic, gst, total, cust };
}

// United India: PR amounts come from the float row itself
function _miUnitedAmounts(floatRow) {
  const od    = _n(floatRow['OD Premium']              ?? 0);
  const tp    = _n(floatRow['TP Premium']              ?? 0);
  const total = _n(floatRow['Total Premium in Portal'] ?? 0);
  const cust  = String(floatRow['Name Of Insured']     ?? '').trim();
  const basic = od + tp;
  const gst   = Math.round(basic * 0.18 * 100) / 100;
  return { od, tp, basic, gst, total: total || Math.round((basic+gst)*100)/100, cust };
}

// ── OPS Sources: Self / Insurance Master / Fulfilment / DCF ─────────
// mirrors _load_ops_sources() and map_ops_row() in mi_recon.py

function _miLoadOPS(selfRows, insMasterRows, fulfilRows, dcfRows) {
  // Returns { Self, 'Insurance Master', Fulfilment, DCF }
  // Each entry: { polLU, regLU, meta: { loanC, uidC, amtC } }
  const srcs = {};

  function buildLU(rows, polFinder, regFinder) {
    const polLU = {}, regLU = {};
    if (!rows || !rows.length) return { polLU, regLU };
    for (const r of rows) {
      const polCol = polFinder(r);
      const regCol = regFinder(r);
      const pk  = polCol ? _miKey(String(r[polCol]??'').trim()) : '';
      const rk  = regCol ? _miCleanReg(String(r[regCol]??'')) : '';
      if (pk && !_miIsBlank(pk)) polLU[pk] = r;
      if (rk) regLU[rk] = r;
    }
    return { polLU, regLU };
  }

  function colFinder(rows, ...tests) {
    if (!rows || !rows.length) return null;
    const cols = Object.keys(rows[0]);
    for (const test of tests) {
      const found = cols.find(c => test(c.toLowerCase()));
      if (found) return found;
    }
    return null;
  }

  if (selfRows && selfRows.length) {
    const polC = colFinder(selfRows, c=>c.includes('policy'));
    const regC = colFinder(selfRows, c=>c.includes('reg')||c.includes('registration'));
    const amtC = colFinder(selfRows, c=>c.includes('premium')||c.includes('amount'));
    const { polLU, regLU } = buildLU(selfRows, ()=>polC, ()=>regC);
    srcs['Self'] = { polLU, regLU, meta:{ loanC:null, uidC:null, amtC } };
  }

  if (insMasterRows && insMasterRows.length) {
    const polC  = colFinder(insMasterRows, c=>c.includes('policy'));
    const regC  = colFinder(insMasterRows, c=>c.includes('car')&&c.includes('reg')) ||
                  colFinder(insMasterRows, c=>c.includes('reg'));
    const loanC = colFinder(insMasterRows, c=>c.includes('loan')&&c.includes('id'));
    const uidC  = colFinder(insMasterRows, c=>c.includes('uid')||c.includes('deal'));
    const amtC  = colFinder(insMasterRows, c=>c.includes('premium')||c.includes('amount'));
    const { polLU, regLU } = buildLU(insMasterRows, ()=>polC, ()=>regC);
    srcs['Insurance Master'] = { polLU, regLU, meta:{ loanC, uidC, amtC } };
  }

  if (fulfilRows && fulfilRows.length) {
    const polC = colFinder(fulfilRows, c=>c.includes('policy'));
    const regC = colFinder(fulfilRows, c=>c.includes('reg')||c.includes('registration'));
    const amtC = colFinder(fulfilRows, c=>c.includes('premium')||c.includes('amount'));
    const { polLU, regLU } = buildLU(fulfilRows, ()=>polC, ()=>regC);
    srcs['Fulfilment'] = { polLU, regLU, meta:{ loanC:null, uidC:null, amtC } };
  }

  if (dcfRows && dcfRows.length) {
    const polC  = colFinder(dcfRows, c=>c.includes('policy'));
    const regC  = colFinder(dcfRows, c=>c.includes('car')&&c.includes('reg')) ||
                  colFinder(dcfRows, c=>c.includes('reg'));
    const loanC = colFinder(dcfRows, c=>c.includes('loan')&&c.includes('id'));
    const uidC  = colFinder(dcfRows, c=>c.includes('uid')||c.includes('deal'));
    // DCF: "Total Premium" exact match first, then fuzzy
    const amtC  = dcfRows[0] && Object.keys(dcfRows[0]).find(c=>c.trim()==='Total Premium') ||
                  colFinder(dcfRows, c=>c.includes('total')&&c.includes('prem')) ||
                  colFinder(dcfRows, c=>c.includes('premium')||c.includes('amount'));
    const { polLU, regLU } = buildLU(dcfRows, ()=>polC, ()=>regC);
    srcs['DCF'] = { polLU, regLU, meta:{ loanC, uidC, amtC } };
  }

  return srcs;
}

// mirrors map_ops_row() exactly
function _miMapOPS(polKey, regKey, segment, opsSrcs) {
  const res = { caseType:'', loanId:'', uidDealId:'', opsTotalPrem:0, opsSource:'' };
  // Priority: GS → Self, Insurance Master, Fulfilment | INSURE24 → DCF only
  const priority = segment === 'GS' ? ['Self','Insurance Master','Fulfilment'] : ['DCF'];

  for (const src of priority) {
    const entry = opsSrcs[src];
    if (!entry) continue;
    const { polLU, regLU, meta } = entry;
    let mr = polKey ? polLU[polKey] : null;
    if (!mr && regKey) mr = regLU[regKey];
    if (!mr) continue;

    res.opsSource    = src;
    res.opsTotalPrem = _n(meta.amtC ? (mr[meta.amtC] ?? 0) : 0);

    if (src === 'Self') {
      res.caseType = 'Self';
    } else if (src === 'DCF') {
      res.caseType   = 'INSURE24';
      res.loanId     = meta.loanC ? String(mr[meta.loanC]??'').trim() : '';
      res.uidDealId  = meta.uidC  ? String(mr[meta.uidC ]??'').trim() : '';
    } else if (src === 'Insurance Master') {
      res.caseType   = 'CF Funded';
      res.loanId     = meta.loanC ? String(mr[meta.loanC]??'').trim() : '';
      res.uidDealId  = meta.uidC  ? String(mr[meta.uidC ]??'').trim() : '';
    } else if (src === 'Fulfilment') {
      res.caseType = 'CF Funded';
    }

    if (_miIsBlank(res.loanId))    res.loanId    = '';
    if (_miIsBlank(res.uidDealId)) res.uidDealId = '';
    return res;
  }
  return res;
}

// ── SAP HANA lookup by Reg No ────────────────────────────────────────
// mirrors prepare_sap_lookups() + map_sap_row()
function _miHANAMap(hanaRows) {
  const map = {};
  if (!hanaRows || !hanaRows.length) return map;
  const cols  = Object.keys(hanaRows[0]);
  const find  = (...tests) => cols.find(c => tests.some(t => c.toLowerCase().includes(t))) || null;
  const loanC = find('loan_application_id') || find('loan') && find('id') || null;
  const regC  = cols.find(c=>c.toLowerCase().includes('vehicle')&&c.toLowerCase().includes('reg')) ||
                find('reg') || null;
  const dateC = find('disburs') || null;
  const custC = find('customer') || find('cust_name') || null;
  const hpaC  = find('hpa') || null;
  const chC   = find('channel') || null;
  const miC   = cols.find(c=>c.toLowerCase()==='mi_charges'||c.toLowerCase().includes('mi_charge')) || null;
  const hbC   = find('holdback') || null;

  if (!regC) { console.warn('[MI HANA] No reg no column found'); return map; }

  // Latest DISBURSEMENT_DATE wins per reg no (sort ascending → last overwrites)
  const sorted = dateC ? [...hanaRows].sort((a,b) => {
    const da = new Date(a[dateC]||0), db = new Date(b[dateC]||0);
    return da - db;
  }) : hanaRows;

  for (const r of sorted) {
    const rk = _miCleanReg(String(r[regC]??''));
    if (!rk) continue;
    map[rk] = {
      loanId:   loanC ? _miKey(String(r[loanC]??'').trim()) : '',
      cust:     custC ? String(r[custC]??'').trim()         : '',
      reg:      String(r[regC]??'').trim(),
      disbursal:dateC ? String(r[dateC]??'').trim()          : '',
      hpa:      hpaC  ? String(r[hpaC ]??'').trim()          : '',
      channel:  chC   ? String(r[chC  ]??'').trim()          : '',
      mi:       _n(miC ? r[miC] : 0),
      holdback: _n(hbC ? r[hbC] : 0),
    };
    map[rk].sapTotal = Math.round((map[rk].mi + map[rk].holdback)*100)/100;
  }
  console.log(`[MI HANA] ${Object.keys(map).length} entries by reg no`);
  return map;
}

// ── Status Map from Monthly DR files ────────────────────────────────
function _miStatusMap(mdrRows) {
  const map = {};
  if (!mdrRows || !mdrRows.length) return map;
  const cols   = Object.keys(mdrRows[0]);
  const loanC  = cols.find(c=>c==='LOAN_APPLICATION_ID') ||
                 cols.find(c=>c.toLowerCase().includes('loan')&&c.toLowerCase().includes('id'));
  const statusC= cols.find(c=>c==='LOAN_STATUS') || cols.find(c=>c.toLowerCase().includes('status'));
  if (!loanC || !statusC) return map;
  for (const r of mdrRows) {
    const id = _miKey(String(r[loanC]??'').trim());
    const st = String(r[statusC]??'').trim();
    if (id && st) map[id] = st;
  }
  return map;
}

// ── compute_final_remark — exact mirror of mi_recon.py ──────────────
function _miComputeFinalRemark(assembled) {
  const caseType   = String(assembled.Case_Type    || '').trim();
  const prRemarks  = String(assembled.PR_Remarks   || '').trim();
  const polType    = String(assembled.Policy_Type  || '').trim();
  const loanId     = String(assembled.Loan_ID      || '').trim();
  const loanStatus = String(assembled.Loan_Status  || '').trim().toLowerCase();
  const sapFound   = !!assembled.SAP_Found;
  const sapTotal   = _n(assembled.SAP_Total        || 0);
  const floatDed   = _n(assembled.Float_Deduction  || 0);
  const sapDiffRaw = assembled.SAP_Diff;
  const selfStatus = String(assembled.Self_Status  || '').trim();
  const selfAmount = _n(assembled.Self_Amount      || 0);

  if (prRemarks === 'Not in PR')
    return 'Not in PR — Commission at Risk';
  if (polType.toLowerCase().includes('double'))
    return 'Double Policy — Cancel One';
  if (caseType === 'Self') {
    if (selfStatus === 'Found') {
      const diff = Math.round((floatDed - selfAmount)*100)/100;
      return Math.abs(diff) <= 1 ? 'Match' : 'Amount Mismatch — Recover Diff from CAPL';
    }
    return 'Not Mapped — Recovery Pending';
  }
  if (_miIsBlank(loanId) && _miIsBlank(caseType))
    return 'Loan ID Not Found — Provide to OPS';
  if (!sapFound)
    return 'Loan Not Disbursed — Policy Need to Cancel';
  if (loanStatus.includes('cancel'))
    return 'Loan Cancelled — Policy Need to Cancel';
  if (sapTotal === 0)
    return 'MI Not Funded — Loss Impact';
  if (sapDiffRaw !== '' && sapDiffRaw !== null && sapDiffRaw !== undefined) {
    const d = _n(sapDiffRaw);
    if (Math.abs(d) <= MI_SAP_TOLERANCE)  return 'Match';
    if (d > MI_SAP_TOLERANCE)             return 'Match — Greater in Disbursal';
    if (d < -MI_SAP_TOLERANCE)            return 'Less in Disbursal — Loss Making';
  }
  return 'Match';
}

// ── Motor Insurance Page ─────────────────────────────────────────────
Router.register('motor', function(panel) {
  let _miData = null;

  panel.innerHTML = `
    <div class="module-hero">
      <div>
        <div class="hero-label">Reconciliation</div>
        <div class="hero-title">Motor Insurance Recon</div>
        <div class="hero-sub">Go Digit · ICICI Lombard · Tata AIG · Zurich Kotak · United India — Level 1 + Full Level 2</div>
      </div>
      <div class="hero-actions">
        <button class="btn-ghost" id="mi-reset-btn">↺ Reset</button>
        <button class="btn-ghost" id="mi-export-btn" style="display:none">Export Report</button>
      </div>
    </div>

    <div id="mi-upload-zone">
      <div id="mi-hint"></div>

      <!-- Step 1: Month + Float -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-header"><span class="card-title">Step 1 — Month &amp; Combined Float Register</span></div>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Month Label <span style="font-weight:400;color:var(--muted)">(exact string in float file)</span></div>
            <input class="form-input" id="mi-month-input" placeholder="e.g. Jan'26 or Jan 2026" style="width:160px">
          </div>
          <div style="flex:1;min-width:220px">
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Combined Float Register <span style="color:var(--red-text)">required</span></div>
            <input type="file" id="mi-float-input" accept=".xlsx,.xls" style="font-size:11px;color:var(--muted)">
          </div>
          <button class="btn-o" id="mi-scan-btn" style="font-size:11px;padding:6px 12px">🔍 Scan Months</button>
        </div>
        <div id="mi-month-hint" style="display:none;margin-top:10px"></div>
      </div>

      <!-- Step 2: PR Registers -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">
          <span class="card-title">Step 2 — PR Registers</span>
          <span style="font-size:11px;color:var(--muted)">optional — needed for PR Amount check &amp; Final Remark</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
          ${['Go Digit','ICICI Lombard','Tata AIG','Zurich Kotak'].map(p => `
            <div class="recon-file-card">
              <div class="recon-file-label">${p} PR Register</div>
              <div class="recon-file-sub">Policy No, Reg No, OD/TP Premium</div>
              <input type="file" id="mi-pr-${p.replace(/\s+/g,'').toLowerCase()}-input" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted)">
            </div>`).join('')}
        </div>
      </div>

      <!-- Step 3: OPS Internal Files -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">
          <span class="card-title">Step 3 — OPS Internal Files</span>
          <span style="font-size:11px;color:var(--muted)">GS: Self + Insurance Master + Fulfilment &nbsp;|&nbsp; INSURE24: DCF Report</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
          <div class="recon-file-card">
            <div class="recon-file-label">Self Cases (CAPL)</div>
            <div class="recon-file-sub">MI_GS Self — Policy No, Reg No, Amount</div>
            <input type="file" id="mi-self-input" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted)">
          </div>
          <div class="recon-file-card">
            <div class="recon-file-label">Insurance Master</div>
            <div class="recon-file-sub">MI_GS — Policy No, Car Reg No, Loan ID, UID</div>
            <input type="file" id="mi-insmaster-input" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted)">
          </div>
          <div class="recon-file-card">
            <div class="recon-file-label">Fulfilment Sheet</div>
            <div class="recon-file-sub">MI_GS — Policy No, Reg No, Premium</div>
            <input type="file" id="mi-fulfilment-input" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted)">
          </div>
          <div class="recon-file-card">
            <div class="recon-file-label">DCF Report</div>
            <div class="recon-file-sub">INSURE24 — Policy No, Reg No, Loan ID, UID, Total Premium</div>
            <input type="file" id="mi-dcf-input" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted)">
          </div>
        </div>
      </div>

      <!-- Step 4: SAP HANA + Monthly DR -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">
          <span class="card-title">Step 4 — SAP HANA &amp; Monthly Disbursal</span>
          <span style="font-size:11px;color:var(--muted)">for SAP MI amount match &amp; Loan Status</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
          <div class="recon-file-card">
            <div class="recon-file-label">SAP HANA Loan Sheet</div>
            <div class="recon-file-sub">VEHICLE_REGISTRATION_NUMBER, MI_CHARGES, HOLDBACK, LOAN_APPLICATION_ID</div>
            <input type="file" id="mi-hana-input" accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted)">
          </div>
          <div class="recon-file-card">
            <div class="recon-file-label">Monthly Disbursal Report(s)</div>
            <div class="recon-file-sub">LOAN_APPLICATION_ID, LOAN_STATUS — multiple files allowed</div>
            <input type="file" id="mi-monthly-input" accept=".xlsx,.xls,.csv" multiple style="font-size:11px;color:var(--muted)">
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div class="card-header"><span class="card-title">Step 5 — Run</span></div>
        <button class="btn-g" id="mi-run-btn" style="padding:9px 28px">▶  Run MI Reconciliation</button>
      </div>
    </div>

    <div id="mi-loading" style="display:none">
      <div class="card" style="padding:32px;text-align:center">
        <div style="font-size:13px;font-weight:500;color:var(--navy);margin-bottom:16px" id="mi-progress-label">Processing…</div>
        <div style="background:rgba(11,31,58,.08);border-radius:4px;height:6px;overflow:hidden;margin-bottom:8px">
          <div id="mi-progress-bar" style="height:100%;width:0%;background:var(--gold);border-radius:4px;transition:width .3s"></div>
        </div>
        <div style="font-size:11px;color:var(--muted)" id="mi-progress-pct">0%</div>
      </div>
    </div>

    <div id="mi-results" style="display:none">
      <div id="mi-kpi-strip" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div class="tab-bar" id="mi-tabs"></div>
      <div id="mi-tab-content"></div>
    </div>
  `;

  // Scan months
  document.getElementById('mi-scan-btn')?.addEventListener('click', async () => {
    const f = document.getElementById('mi-float-input')?.files?.[0];
    if (!f) { _hint('mi-hint','danger','Please select the Combined Float Register first.'); return; }
    try {
      const wb = await _readWB(f);
      const allVals = new Set();
      for (const partner of MI_PARTNERS) {
        const sheetKey = MI_FLOAT_SHEET_MAP[partner]?.GS;
        if (!sheetKey || !wb.Sheets[sheetKey]) continue;
        _miScanMonths(wb.Sheets[sheetKey], sheetKey).forEach(v => allVals.add(v));
        if (allVals.size >= 15) break;
      }
      const vals = [...allVals];
      const hintEl = document.getElementById('mi-month-hint');
      if (!vals.length) {
        hintEl.style.display='block';
        hintEl.innerHTML=`<span style="color:var(--red-text);font-size:11px">Could not read month values. Check float file has correct sheets.</span>`;
        return;
      }
      hintEl.style.display='block';
      hintEl.innerHTML = `<strong style="font-size:11px;color:var(--green-text)">✓ Month values found — click to fill:</strong><br style="margin-bottom:4px">` +
        vals.map(v => `<span class="month-chip" onclick="document.getElementById('mi-month-input').value='${v.replace(/'/g,"\\'")}';">${v}</span>`).join('');
      if (!document.getElementById('mi-month-input').value)
        document.getElementById('mi-month-input').value = vals[vals.length-1];
    } catch(e) { _hint('mi-hint','danger','Error scanning file: ' + e.message); }
  });

  document.getElementById('mi-reset-btn')?.addEventListener('click', () => {
    _miData = null; _showUpload('mi'); _hint('mi-hint','','');
    document.getElementById('mi-export-btn').style.display = 'none';
    document.getElementById('mi-month-hint').style.display = 'none';
  });

  document.getElementById('mi-export-btn')?.addEventListener('click', () => {
    if (!_miData) return;
    const label = document.getElementById('mi-month-input')?.value?.trim() || 'Recon';
    const safe  = label.replace(/'/g,'').replace(/\s+/g,'_');
    const wb    = XLSX.utils.book_new();
    // L1 Summary sheet
    const sumCols = ['partner','seg','Issued','Issue n Cancel','Issue n Credit',
                     'Last Month Credit','Double Debit','Double Debit - Same Reg No','Top Up','total'];
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.aoa_to_sheet([sumCols, ..._miData.l1Summary.map(r=>sumCols.map(c=>r[c]??0))]),
      'L1 Summary');
    // Level 2 sheets per partner
    for (const [sname, rows] of Object.entries(_miData.allLevel2)) {
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]).filter(k=>!k.startsWith('_'));
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.aoa_to_sheet([cols, ...rows.map(r=>cols.map(c=>r[c]??''))]),
        sname.slice(0,30));
    }
    // Cancellation sheet
    const cancelRows = Object.values(_miData.allClassified).flat()
      .filter(r=>['Issue n Cancel','Issue n Credit','Last Month Credit'].includes(r._REM));
    if (cancelRows.length) {
      const cols = ['_PARTNER','_REM','_RAW_POL','_REG','_DEB','_CRED'];
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.aoa_to_sheet([['Partner','Type','Policy No','Reg No','Debit','Credit'],
          ...cancelRows.map(r=>cols.map(c=>r[c]??''))]),
        'Cancellation');
    }
    _downloadXLSX(XLSX.write(wb,{type:'array',bookType:'xlsx'}), `MI_Recon_${safe}.xlsx`);
  });

  document.getElementById('mi-run-btn')?.addEventListener('click', _runMI);

  async function _readFileRows(inputId) {
    const f = document.getElementById(inputId)?.files?.[0];
    if (!f) return [];
    const wb = await _readWB(f);
    const { rows } = _findSheet(wb, '');  // first sheet
    return rows;
  }

  async function _runMI() {
    const floatFile  = document.getElementById('mi-float-input')?.files?.[0];
    const monthLabel = document.getElementById('mi-month-input')?.value?.trim();
    if (!floatFile)  { _hint('mi-hint','danger','Combined Float Register is required.'); return; }
    if (!monthLabel) { _hint('mi-hint','danger','Month label is required. Click Scan Months first.'); return; }
    if (!window.XLSX){ _hint('mi-hint','danger','SheetJS not loaded. Refresh page.'); return; }

    _showLoad('mi'); _hint('mi-hint','','');
    const setP = _progress('mi-progress-label','mi-progress-bar','mi-progress-pct');

    try {
      setP(5, 'Reading Combined Float Register…');
      const floatWB = await _readWB(floatFile);

      // Step 2: PR Registers
      setP(12, 'Reading PR Registers…');
      const prMeta    = {};  // partner → { lu, odC, tpC, totC, custC, basicC }
      const prRegLU   = {};  // partner → {polKey → regNo} for classify_float Reg_No population
      for (const partner of ['Go Digit','ICICI Lombard','Tata AIG','Zurich Kotak']) {
        const fId = 'mi-pr-' + partner.replace(/\s+/g,'').toLowerCase() + '-input';
        const pf  = document.getElementById(fId)?.files?.[0];
        if (pf) {
          const pwb        = await _readWB(pf);
          const { rows: pr } = _findSheet(pwb, '');
          prMeta[partner]  = _miPRLookup(pr, partner);
          prRegLU[partner] = _miPRRegLookup(pr, partner);
          console.log(`[MI PR] ${partner}: lu=${Object.keys(prMeta[partner].lu).length} regLU=${Object.keys(prRegLU[partner]).length}`);
        } else {
          prMeta[partner]  = { lu:{}, odC:null, tpC:null, totC:null, custC:null, basicC:null };
          prRegLU[partner] = {};
        }
      }

      // Step 3: OPS Internal Files
      setP(22, 'Reading OPS internal files…');
      const selfRows      = await _readFileRows('mi-self-input');
      const insMasterRows = await _readFileRows('mi-insmaster-input');
      const fulfilRows    = await _readFileRows('mi-fulfilment-input');
      const dcfRows       = await _readFileRows('mi-dcf-input');
      console.log(`[MI OPS] Self:${selfRows.length} InsMaster:${insMasterRows.length} Fulfil:${fulfilRows.length} DCF:${dcfRows.length}`);

      // Build OPS sources (GS and INSURE24 separately — matches segment logic)
      const opsGS       = _miLoadOPS(selfRows, insMasterRows, fulfilRows, null);
      const opsINSURE24 = _miLoadOPS(null,     null,          null,       dcfRows);
      console.log(`[MI OPS] GS sources: ${Object.keys(opsGS).join(', ')} | INSURE24: ${Object.keys(opsINSURE24).join(', ')}`);

      // Step 4: SAP HANA
      setP(32, 'Reading SAP HANA…');
      let hanaMap = {};
      const hanaFile = document.getElementById('mi-hana-input')?.files?.[0];
      if (hanaFile) {
        const hwb        = await _readWB(hanaFile);
        const { rows: hr } = _findSheet(hwb, '');
        hanaMap = _miHANAMap(hr);
      }

      // Monthly DR → status map
      setP(38, 'Reading Monthly Disbursal Reports…');
      let statusMap = {};
      const monthFiles = Array.from(document.getElementById('mi-monthly-input')?.files || []);
      for (const mf of monthFiles) {
        const mwb        = await _readWB(mf);
        const { rows: mr } = _findSheet(mwb, '');
        Object.assign(statusMap, _miStatusMap(mr));
      }
      console.log(`[MI Status] ${Object.keys(statusMap).length} loans`);

      // Level 1 + Level 2 per partner × segment
      const allClassified = {};
      const allLevel2     = {};
      const l1Summary     = [];
      let totalRows = 0;
      const debugInfo = [];

      for (let pi = 0; pi < MI_PARTNERS.length; pi++) {
        const partner = MI_PARTNERS[pi];
        setP(Math.round(42 + pi/MI_PARTNERS.length*50), `Processing ${partner}…`);

        for (const seg of ['GS','INSURE24']) {
          const sheetKey = MI_FLOAT_SHEET_MAP[partner]?.[seg];
          if (!sheetKey) continue;
          const ws = floatWB.Sheets[sheetKey];
          if (!ws) { debugInfo.push(`"${sheetKey}" not found`); continue; }

          const cfg  = MI_PARTNER_CFG[sheetKey];
          const rows = _miReadSheet(ws, sheetKey, monthLabel);
          debugInfo.push(`${partner}/${seg}: ${rows.length} rows`);
          if (!rows.length) continue;

          // Enrich with Reg_No from PR lookup (needed for Double Debit - Same Reg No)
          const prRegMap = prRegLU[partner] || {};
          const iciciN   = cfg.iciciNorm;
          for (const r of rows) {
            if (partner === 'United India') {
              r['Reg_No'] = _miCleanReg(String(r['Registration No.'] ?? r['Registration Number'] ?? ''));
            } else {
              const rawPol = String(r[cfg.polCol] ?? '').trim();
              const pk     = _miGetPk(rawPol, iciciN);
              const reg    = prRegMap[pk] || '';
              r['Reg_No']  = reg;
            }
          }

          // Level 1 classification
          const classified = _miClassify(rows, partner, cfg);
          const vc = {};
          for (const r of classified) vc[r._REM] = (vc[r._REM]||0)+1;
          const sname = `${partner.slice(0,12)} ${seg}`;
          allClassified[sname] = classified;
          totalRows += classified.length;
          l1Summary.push({ partner, seg, ...vc, total: classified.length });

          // Level 2 — only for Issued / Double rows
          const ISSUED_TYPES = ['Issued','Double Debit','Double Issued','Double Debit - Same Reg No'];
          const issuedRows   = classified.filter(r => ISSUED_TYPES.includes(r._REM));

          const pm        = prMeta[partner]  || { lu:{}, odC:null, tpC:null, totC:null, custC:null, basicC:null };
          const opsSrcs   = seg === 'GS' ? opsGS : opsINSURE24;

          // Self lookup (only for GS segment)
          const selfPolLU = {};
          const selfRegLU = {};
          if (seg === 'GS' && selfRows.length) {
            const s = selfRows;
            const sCols = Object.keys(s[0]||{});
            const sPC   = sCols.find(c=>c.toLowerCase().includes('policy'));
            const sRC   = sCols.find(c=>c.toLowerCase().includes('reg')||c.toLowerCase().includes('registration'));
            const sAC   = sCols.find(c=>c.toLowerCase().includes('premium')||c.toLowerCase().includes('amount'));
            for (const r of s) {
              const pk = _miKey(String(r[sPC]??'').trim());
              const rk = _miCleanReg(String(r[sRC]??''));
              const amt= _n(r[sAC]??0);
              if (pk && !_miIsBlank(pk)) selfPolLU[pk] = amt;
              if (rk) selfRegLU[rk] = amt;
            }
          }

          // Date column detection for this sheet
          const sampleRow = issuedRows[0] || {};
          const dateCols  = Object.keys(sampleRow);
          const dateCol   = dateCols.find(c=>c.trim()==='Transaction Date') ||
                            dateCols.find(c=>c.toLowerCase().includes('trans')&&c.toLowerCase().includes('date')) ||
                            dateCols.find(c=>c.toLowerCase().includes('date')) || null;

          const level2 = issuedRows.map(r => {
            const pk        = r._POL;
            const rawPol    = r._RAW_POL;
            const regNo     = r._REG;
            const floatDed  = r._DEB;
            const dateVal   = dateCol ? String(r[dateCol]??'').trim() : '';

            // PR section
            let prRem='Not in PR', cust='', od=0, tp=0, basic=0, gst=0, prTotal=0, diffPR=-floatDed;
            if (partner === 'United India') {
              const ua = _miUnitedAmounts(r);
              od=ua.od; tp=ua.tp; basic=ua.basic; gst=ua.gst; prTotal=ua.total; cust=ua.cust;
              diffPR = Math.round((prTotal - floatDed)*100)/100;
              prRem  = Math.abs(diffPR) <= 1 ? 'Match' : 'Amount Mismatch';
            } else {
              const prd = pm.lu[pk];
              if (prd !== undefined) {
                const pa = _miPRAmounts(prd, partner, pm);
                od=pa.od; tp=pa.tp; basic=pa.basic; gst=pa.gst; prTotal=pa.total; cust=pa.cust;
                diffPR = Math.round((prTotal - floatDed)*100)/100;
                prRem  = Math.abs(diffPR) <= 1 ? 'Match' : 'Amount Mismatch';
              }
            }

            // OPS section — ICICI: normalise to 3-part key before OPS lookup
            let opsPk = pk;
            if (iciciN) {
              const pts = _miKey(rawPol).split('/');
              opsPk = pts.length >= 3 ? pts.slice(0,3).join('/') : _miKey(rawPol);
            }
            const ops         = _miMapOPS(opsPk, regNo, seg, opsSrcs);
            const loanId      = ops.loanId;
            const caseType    = ops.caseType || 'CF Funded';
            const opsTot      = ops.opsTotalPrem;
            const diffOPS     = opsTot ? Math.round((floatDed - opsTot)*100)/100 : null;
            const opsRem      = !caseType         ? '' :
                                opsTot === 0       ? 'Amount Missing' :
                                diffOPS !== null && Math.abs(diffOPS) <= 1 ? 'Match' : 'Mismatch';

            // SAP section
            const sapRow      = regNo ? hanaMap[regNo] : null;
            const sapFound    = !!sapRow;
            const sapLoanId   = sapFound && sapRow.loanId ? sapRow.loanId : loanId;
            const sapDiff     = sapFound ? Math.round((sapRow.sapTotal - floatDed)*100)/100 : null;
            const loanStatus  = !_miIsBlank(sapLoanId) ? (statusMap[sapLoanId] || '') : '';

            // Self validation
            let selfStatus='', selfAmt=0, diffSelf='', selfRem='';
            if (caseType === 'Self') {
              const sa = selfPolLU[pk] ?? (regNo ? selfRegLU[regNo] : undefined);
              if (sa !== undefined) {
                selfStatus = 'Found'; selfAmt = sa;
                diffSelf   = Math.round((floatDed - sa)*100)/100;
                selfRem    = Math.abs(diffSelf) <= 1 ? 'Match' : 'Amount Mismatch — Recover Diff from CAPL';
              } else {
                selfStatus = 'Not Found';
                selfRem    = 'Not Mapped — Recovery Pending';
              }
            }

            const assembled = {
              Date:              dateVal,
              Partner:           partner,
              Segment:           seg,
              Policy_No:         rawPol,
              Reg_No:            regNo,
              Customer_Name:     cust,
              Policy_Type:       r._REM,
              OD_Prem:           od,
              TP_Prem:           tp,
              Basic_Prem:        basic,
              GST:               gst,
              Total_Prem:        prTotal,
              Float_Deduction:   floatDed,
              Diff_PR_vs_Float:  diffPR,
              PR_Remarks:        prRem,
              Case_Type:         caseType,
              Loan_ID:           loanId,
              UID_Deal_ID:       ops.uidDealId,
              OPS_Total_Premium: opsTot,
              Diff_Float_vs_OPS: diffOPS !== null ? diffOPS : '',
              OPS_Remark:        opsRem,
              OPS_Source:        ops.opsSource,
              SAP_Loan_ID:       sapFound ? (sapRow.loanId||'') : '',
              SAP_Customer:      sapFound ? (sapRow.cust||'')   : '',
              SAP_Disbursal_Date:sapFound ? (sapRow.disbursal||''): '',
              HPA_Status:        sapFound ? (sapRow.hpa||'')    : '',
              Channel:           sapFound ? (sapRow.channel||''): '',
              MI_Charges:        sapFound ? sapRow.mi       : 0,
              MI_Holdback:       sapFound ? sapRow.holdback : 0,
              SAP_Total:         sapFound ? sapRow.sapTotal : 0,
              SAP_Diff:          sapDiff !== null ? sapDiff : '',
              Loan_Status:       loanStatus,
              Self_Status:       caseType==='Self' ? selfStatus : '',
              Self_Amount:       caseType==='Self' ? selfAmt    : '',
              Diff_Float_vs_Self:caseType==='Self' ? diffSelf   : '',
              Self_Remarks:      caseType==='Self' ? selfRem    : '',
              SAP_Found:         sapFound,
            };
            assembled.Final_Remark = _miComputeFinalRemark(assembled);
            delete assembled.SAP_Found;
            return assembled;
          });

          allLevel2[sname] = level2;
        }
      }

      setP(95, 'Building summary…');

      if (!totalRows) {
        _hint('mi-hint','danger',
          `<strong>No data found for month "${monthLabel}"</strong><br>
           Sheets in file: <code>${floatWB.SheetNames.join(', ')}</code><br>
           Debug: ${debugInfo.join(' · ')}<br>
           Fix: Click Scan Months to see actual values.`);
        _showUpload('mi');
        return;
      }

      _miData = { allClassified, allLevel2, l1Summary };

      // Update dashboard
      const allL2 = Object.values(allLevel2).flat();
      window._lastMIResult = {
        monthLabel, total: totalRows,
        issued:  l1Summary.reduce((s,r)=>s+(r['Issued']||0),0),
        queries: allL2.filter(r=>r.Final_Remark!=='Match').length,
        partners:MI_PARTNERS.length,
      };
      if (typeof _updateDashboard === 'function') _updateDashboard();

      setP(100, 'Done!');
      setTimeout(() => _miShowResults(_miData, monthLabel), 250);

    } catch(err) {
      console.error('[MI]', err);
      _hint('mi-hint','danger', `<strong>Error:</strong> ${err.message}`);
      _showUpload('mi');
    }
  }

  function _miShowResults(data, label) {
    const { l1Summary, allLevel2 } = data;
    _showResults('mi');
    document.getElementById('mi-export-btn').style.display = 'inline-block';

    const totIssued = l1Summary.reduce((s,r)=>s+(r['Issued']||0),0);
    const totINC    = l1Summary.reduce((s,r)=>s+(r['Issue n Cancel']||0)+(r['Issue n Credit']||0),0);
    const totLMC    = l1Summary.reduce((s,r)=>s+(r['Last Month Credit']||0),0);
    const totDouble = l1Summary.reduce((s,r)=>s+(r['Double Debit']||0)+(r['Double Issued']||0)+(r['Double Debit - Same Reg No']||0),0);
    const totTopUp  = l1Summary.reduce((s,r)=>s+(r['Top Up']||0),0);
    const totAll    = l1Summary.reduce((s,r)=>s+r.total,0);

    const allL2      = Object.values(allLevel2).flat();
    const l2Match    = allL2.filter(r=>r.Final_Remark==='Match').length;
    const l2NotInPR  = allL2.filter(r=>(r.Final_Remark||'').includes('Not in PR')).length;
    const l2Loss     = allL2.filter(r=>(r.Final_Remark||'').includes('Loss')).length;
    const l2NotDisb  = allL2.filter(r=>(r.Final_Remark||'').includes('Not Disbursed')).length;
    const l2Cancelled= allL2.filter(r=>(r.Final_Remark||'').includes('Cancelled')).length;

    document.getElementById('mi-kpi-strip').innerHTML = [
      {label:'TOTAL ROWS',       value:totAll.toLocaleString(),    color:'var(--navy-lt)'},
      {label:'ISSUED',           value:totIssued.toLocaleString(), color:'var(--green)'},
      {label:'ISSUE n CANCEL',   value:totINC.toLocaleString(),    color:'var(--amber)'},
      {label:'LAST MO CREDIT',   value:totLMC.toLocaleString(),    color:'var(--gold)'},
      {label:'DOUBLE DEBIT',     value:totDouble.toLocaleString(), color:'var(--red)'},
      {label:'L2 MATCH',         value:l2Match.toLocaleString(),   color:'var(--green)'},
      {label:'NOT IN PR',        value:l2NotInPR.toLocaleString(), color:'var(--red)'},
      {label:'NOT DISBURSED',    value:l2NotDisb.toLocaleString(), color:'var(--red)'},
      {label:'CANCELLED',        value:l2Cancelled.toLocaleString(),color:'var(--red)'},
      {label:'LOSS MAKING',      value:l2Loss.toLocaleString(),    color:'var(--red)'},
    ].map(k => `
      <div class="stat-chip" style="min-width:90px;flex:1;border-top:3px solid ${k.color}">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:3px">${k.label}</div>
        <div style="font-size:17px;font-weight:500;color:var(--navy)">${k.value}</div>
      </div>`).join('');

    // Tabs
    const tabs = [
      { id:'l1summary', label:'L1 Summary' },
      { id:'l2summary', label:`L2 Final Recon (${allL2.length})` },
      { id:'l2queries', label:`L2 Queries (${allL2.filter(r=>r.Final_Remark!=='Match').length})` },
      ...Object.keys(data.allClassified).map(sn => ({ id:'l1_'+sn, label:sn })),
    ];
    const cancelRows = Object.values(data.allClassified).flat()
      .filter(r=>['Issue n Cancel','Issue n Credit','Last Month Credit'].includes(r._REM));
    if (cancelRows.length) tabs.push({ id:'cancellation', label:`Cancellation (${cancelRows.length})` });

    document.getElementById('mi-tabs').innerHTML = tabs.map((t,i) =>
      `<div class="tab-item${i===0?' active':''}" data-tab="${t.id}" onclick="
        document.querySelectorAll('#mi-tabs .tab-item').forEach(el=>el.classList.remove('active'));
        this.classList.add('active');_miRenderTab('${t.id}');
      ">${t.label}</div>`).join('');

    window._miTabData = data;
    _miRenderTab('l1summary');
  }

  window._miRenderTab = function(id) {
    const data    = window._miTabData;
    const content = document.getElementById('mi-tab-content');
    if (!content || !data) return;

    if (id === 'l1summary') {
      const cols = [
        {key:'partner',label:'Partner'},{key:'seg',label:'Segment'},
        {key:'Issued',label:'Issued'},{key:'Issue n Cancel',label:'INC'},
        {key:'Issue n Credit',label:'Issue n Credit'},{key:'Last Month Credit',label:'LMC'},
        {key:'Double Debit',label:'Double Debit'},{key:'Double Debit - Same Reg No',label:'Dbl Same Reg'},
        {key:'Top Up',label:'Top Up'},{key:'total',label:'Total'},
      ];
      content.innerHTML = `<div class="table-wrap" id="mi-tbl-wrap"></div>`;
      _renderTable('mi-tbl-wrap', data.l1Summary.map(r=>({...r})), cols);

    } else if (id === 'l2summary' || id === 'l2queries') {
      const allL2 = Object.values(data.allLevel2).flat();
      const rows  = id === 'l2queries' ? allL2.filter(r=>r.Final_Remark!=='Match') : allL2;
      const cols  = [
        {key:'Final_Remark',  label:'Final Remark', badge:true},
        {key:'Partner',       label:'Partner'},
        {key:'Segment',       label:'Segment'},
        {key:'Policy_No',     label:'Policy No'},
        {key:'Reg_No',        label:'Reg No'},
        {key:'Customer_Name', label:'Customer'},
        {key:'Case_Type',     label:'Case Type'},
        {key:'Float_Deduction',label:'Float (₹)'},
        {key:'Total_Prem',    label:'PR Total (₹)'},
        {key:'Diff_PR_vs_Float',label:'PR Diff'},
        {key:'PR_Remarks',    label:'PR Rem'},
        {key:'Loan_ID',       label:'Loan ID'},
        {key:'UID_Deal_ID',   label:'UID/Deal'},
        {key:'OPS_Source',    label:'OPS Source'},
        {key:'SAP_Total',     label:'SAP Total'},
        {key:'SAP_Diff',      label:'SAP Diff'},
        {key:'Loan_Status',   label:'Loan Status'},
      ];
      content.innerHTML = `<div class="table-wrap" id="mi-tbl-wrap"></div>`;
      _renderTable('mi-tbl-wrap', rows, cols);

    } else if (id === 'cancellation') {
      const cancelRows = Object.values(data.allClassified).flat()
        .filter(r=>['Issue n Cancel','Issue n Credit','Last Month Credit'].includes(r._REM));
      const cols = [
        {key:'_REM',     label:'Type',    badge:true},
        {key:'_PARTNER', label:'Partner'},
        {key:'_RAW_POL', label:'Policy No'},
        {key:'_REG',     label:'Reg No'},
        {key:'_DEB',     label:'Debit'},
        {key:'_CRED',    label:'Credit'},
      ];
      content.innerHTML = `<div class="table-wrap" id="mi-tbl-wrap"></div>`;
      _renderTable('mi-tbl-wrap', cancelRows, cols);

    } else if (id.startsWith('l1_')) {
      const sname   = id.replace(/^l1_/,'');
      const rows    = data.allClassified[sname] || [];
      const colKeys = rows.length ? Object.keys(rows[0]).filter(k=>!k.startsWith('_')) : [];
      content.innerHTML = `<div class="table-wrap" id="mi-tbl-wrap"></div>`;
      _renderTable('mi-tbl-wrap', rows, [
        {key:'_REM', label:'Remarks', badge:true},
        ...colKeys.map(k=>({key:k,label:k})).slice(0,13)
      ]);
    }
  };
});

