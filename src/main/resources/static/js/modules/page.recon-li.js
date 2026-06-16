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
    const lmcDebitMonthMap = {};
    for (const r of floatAllRows) {
        const pol = _k(_g(r, 'POLICY_NUMBER', 'POLICY_NO', 'POLICY'));
        const deb = _n(_g(r, 'DEBIT_AMT', 'DEBIT_AMOUNT', 'DEBIT'));
        if (lmcPolicies.has(pol) && deb > 0) {
            lmcDebitMap[pol] = (lmcDebitMap[pol] || 0) + deb;
            if (!lmcDebitMonthMap[pol])
                lmcDebitMonthMap[pol] = _g(r,'MONTHS','Months','MONTH_LABEL')
                    || _dt(_g(r,'TRANS_DATE','TRANSACTION_DATE','DATE'));
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
        if (!byC[id]) byC[id] = { cH:0,cP:0,dH:0,dP:0, polH:'',polP:'', date:'', rtype:r._REM, debitMo:'' };
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
        if (!byC[id].debitMo)
            byC[id].debitMo = r._REM === 'Last Month Credit'
                ? (lmcDebitMonthMap[r._POL] || '')
                : (_g(r,'MONTHS','Months','MONTH_LABEL') || '');
    }

    const cancelRows = Object.entries(byC).map(([id, c]) => {
        const tc = c.cH + c.cP, td = c.dH + c.dP, diff = tc - td;
        let rem;
        if (Math.abs(diff) <= 1) rem = c.rtype === 'Issue n Cancel' ? 'Knocked Off - Debit & Credit Match' : 'Match';
        else rem = diff < 0 ? 'Shortfall - Go Digit Refunded Less' : 'Excess Credit - Investigate';
        return {
            'Loan ID':               id,
            'Policy Issue Date':     _dt(c.date),
            'Debit Month':           c.debitMo || '',
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

/** @deprecated replaced below */ function _liExportXLSX_OLD_SHEETJS(data,label){ return null; }
/** Build export XLSX — ExcelJS: Aptos 8, navy headers, white fill, freeze, formulas */
async function _liExportXLSX(data, label) {
    const { issuedRows, cancelRows, topupRows, queries, summary } = data;

    // ── Fallback if ExcelJS CDN failed to load ───────────────────────
    if (!window.ExcelJS) {
        console.warn('[LI] ExcelJS not loaded');
        const wb2 = XLSX.utils.book_new();
        const fb = (n,r,c) => { if(r.length) XLSX.utils.book_append_sheet(wb2,XLSX.utils.aoa_to_sheet([c.map(x=>x.label),...r.map(ro=>c.map(x=>ro[x.key]??''))]),n); };
        fb('Issued Cases',issuedRows,[{key:'Loan ID',label:'Loan ID'},{key:'_FINAL_STATUS',label:'Final Status'}]);
        fb('LI Queries',  queries,   [{key:'Loan ID',label:'Loan ID'},{key:'_FINAL_STATUS',label:'Final Status'}]);
        fb('Cancellation',cancelRows,[{key:'Loan ID',label:'Loan ID'},{key:'_CANCEL_REM',  label:'Remarks'}]);
        return XLSX.write(wb2,{type:'array',bookType:'xlsx'});
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'FinX24';

    // ── Palette ──────────────────────────────────────────────────────
    const F8    = { name:'Aptos', size:8 };
    const FH    = { name:'Aptos', size:8, bold:true, color:{ argb:'FFFFFFFF' } };
    const FILH  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1E3A5F' } };
    const FILW  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFFFFF' } };
    const FILA  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF0F4F9' } };
    const ALN_C = { horizontal:'center', vertical:'middle' };
    const ALN_L = { horizontal:'left',   vertical:'middle' };
    const ALN_R = { horizontal:'right',  vertical:'middle' };
    const ALN_H = { horizontal:'center', vertical:'middle', wrapText:true };
    const ST = {
        ok:  { fill:{ type:'pattern',pattern:'solid',fgColor:{ argb:'FFC6EFCE' } }, font:{ name:'Aptos',size:8,bold:true,color:{ argb:'FF276221' } } },
        err: { fill:{ type:'pattern',pattern:'solid',fgColor:{ argb:'FFFFC7CE' } }, font:{ name:'Aptos',size:8,bold:true,color:{ argb:'FF9C0006' } } },
        amb: { fill:{ type:'pattern',pattern:'solid',fgColor:{ argb:'FFFFEB9C' } }, font:{ name:'Aptos',size:8,bold:true,color:{ argb:'FF9C6500' } } },
        blu: { fill:{ type:'pattern',pattern:'solid',fgColor:{ argb:'FFDEEBF7' } }, font:{ name:'Aptos',size:8,bold:true,color:{ argb:'FF1F497D' } } },
    };
    function _ss(val) {
        const v = String(val||'').toLowerCase();
        if (v === 'match' || v.startsWith('knocked off')) return ST.ok;
        if (v.includes('mismatch') || v.includes('shortfall') || v.includes('excess')) return ST.err;
        if (v.includes('cancel') || v.includes('missing') || v.includes('not disbursed') || v.includes('verify')) return ST.amb;
        return ST.blu;
    }

    // ── Sheet factory ────────────────────────────────────────────────
    function _addSheet(name, rows, cols, opts) {
        if (!rows || !rows.length) return;
        opts = opts || {};
        const fCols  = opts.formCols   || {};
        const sCols  = new Set(opts.statusCols || []);
        const nCols  = new Set(opts.numCols    || []);
        const widths = opts.widths || cols.map(c => Math.max(c.label.length + 3, 12));

        const ws = wb.addWorksheet(name, {
            views: [{ state:'frozen', ySplit:1, topLeftCell:'A2' }],
        });
        ws.columns = widths.map(w => ({ width:w, style:{ font:F8 } }));

        // Header
        const hRow = ws.addRow(cols.map(c => c.label));
        hRow.height = 22;
        hRow.eachCell({ includeEmpty:true }, cell => {
            cell.font = FH; cell.fill = FILH; cell.alignment = ALN_H;
        });

        // Data rows
        rows.forEach((row, ri) => {
            const er      = ri + 2;
            const defFill = ri % 2 === 0 ? FILW : FILA;
            const vals    = cols.map((col, ci) => {
                const raw = col.key === 'IMD Code' ? (row[col.key] || '1053878') : (row[col.key] ?? '');
                return fCols[ci] ? { formula: fCols[ci](er), result: typeof raw === 'number' ? raw : 0 } : raw;
            });
            const dRow = ws.addRow(vals);
            dRow.height = 15;
            dRow.eachCell({ includeEmpty:true }, (cell, cn) => {
                const ci = cn - 1;
                if (sCols.has(ci)) {
                    const st = _ss(row[cols[ci].key]);
                    cell.fill = st.fill; cell.font = st.font; cell.alignment = ALN_C;
                } else {
                    cell.fill = defFill;
                    cell.font = { ...F8 };
                    if (nCols.has(ci)) { cell.numFmt = '#,##0'; cell.alignment = ALN_R; }
                    else               { cell.alignment = ALN_L; }
                }
            });
        });
        ws.autoFilter = { from:{ row:1, column:1 }, to:{ row:1, column:cols.length } };
    }

    // ── A. ISSUED CASES — A=ID B=IMD C=Date D=PolH E=DebitH F=PolPA G=DebitPA
    //    H=TotalDedn(=E+G) I=PRCheck J=DisbDate K=SAPAmt L=Diff(=K-H) M=Status N=StMo O=Final
    const issuedCols = [
        { key:'Loan ID',                label:'Loan ID'              },
        { key:'IMD Code',               label:'IMD Code'             },
        { key:'Policy Issue Date',      label:'Issue Date'           },
        { key:'Policy No - Health',     label:'Policy No - Health'   },
        { key:'Debit Float (Health)',   label:'Debit Float H'        },
        { key:'Policy No - PA',         label:'Policy No - PA'       },
        { key:'Debit Float (PA)',        label:'Debit Float PA'       },
        { key:'Total Deduction (Float)',label:'Total Deduction'      },
        { key:'Float vs PR Check',      label:'PR Check'             },
        { key:'Disbursal Date',         label:'Disbursal Date'       },
        { key:'LI Amount (SAP)',        label:'LI Amount SAP'        },
        { key:'Difference',             label:'Difference'           },
        { key:'Loan Status',            label:'Loan Status'          },
        { key:'Status Month',           label:'Status Month'         },
        { key:'_FINAL_STATUS',          label:'Final Status'         },
    ];
    const issuedOpts = {
        formCols:   { 7: er=>`E${er}+G${er}`, 11: er=>`K${er}-H${er}` },
        statusCols: [8, 14],
        numCols:    [4, 6, 7, 10, 11],
        widths:     [20,10,11,22,13,22,13,15,9,12,14,11,24,11,30],
    };
    _addSheet('Issued Cases', issuedRows, issuedCols, issuedOpts);
    _addSheet('LI Queries',   queries,    issuedCols, issuedOpts);

    // ── B. CANCELLATION — A=ID B=IssueDate C=DebitMonth D=Type E=PolH F=CrH G=DbHOrig
    //    H=PolPA I=CrPA J=DbPAOrig K=TotalCredit(=F+I) L=TotalDebit(=G+J) M=Diff(=K-L) N=Remarks
    _addSheet('Cancellation', cancelRows, [
        { key:'Loan ID',                 label:'Loan ID'          },
        { key:'Policy Issue Date',       label:'Issue Date'       },
        { key:'Debit Month',             label:'Debit Month'      },
        { key:'Type',                    label:'Type'             },
        { key:'Policy No - Health',      label:'Policy Health'    },
        { key:'Credit Health',           label:'Credit H'         },
        { key:'Debit Health (Original)', label:'Debit H Orig'     },
        { key:'Policy No - PA',          label:'Policy PA'        },
        { key:'Credit PA',              label:'Credit PA'         },
        { key:'Debit PA (Original)',     label:'Debit PA Orig'    },
        { key:'Total Credit',           label:'Total Credit'      },
        { key:'Total Debit',            label:'Total Debit'       },
        { key:'Difference',             label:'Difference'        },
        { key:'_CANCEL_REM',            label:'Remarks'           },
    ], {
        formCols:   { 10: er=>`F${er}+I${er}`, 11: er=>`G${er}+J${er}`, 12: er=>`K${er}-L${er}` },
        statusCols: [13],
        numCols:    [5,6,8,9,10,11,12],
        widths:     [20,11,12,14,20,11,13,20,11,13,13,12,12,28],
    });

    // ── C. TOP UP ─────────────────────────────────────────────────────
    _addSheet('Top Up', topupRows, [
        { key:'Date',    label:'Date'                },
        { key:'Type',    label:'Type'                },
        { key:'Details', label:'Transaction Details' },
        { key:'Credit',  label:'Credit'              },
        { key:'Debit',   label:'Debit'               },
    ], { numCols:[3,4], widths:[12,16,44,12,12] });

    // ── D. SUMMARY PIVOT ──────────────────────────────────────────────
    (function() {
        const ws = wb.addWorksheet('Summary');
        ws.columns = [{ width:44 }, { width:14 }, { width:10 }];

        function _hRow(a, b, c) {
            const row = ws.addRow([a, b === undefined ? '' : b, c === undefined ? '' : c]);
            row.height = 20;
            row.eachCell({ includeEmpty:true }, (cell, cn) => {
                cell.font = FH; cell.fill = FILH;
                cell.alignment = cn === 1 ? ALN_L : ALN_C;
                if (cn === 2) cell.numFmt = '#,##0';
            });
            return row;
        }
        function _dRow(lbl, cnt, pct, stKey, formula) {
            const st  = stKey ? ST[stKey] : null;
            const row = ws.addRow([lbl, cnt, pct == null ? '' : pct + '%']);
            row.height = 16;
            const c1 = row.getCell(1), c2 = row.getCell(2), c3 = row.getCell(3);
            c1.font = st ? st.font : F8;   c1.fill = st ? st.fill : FILW;   c1.alignment = ALN_L;
            c2.font = st ? { ...st.font } : { ...F8, bold:true };
            c2.fill = st ? st.fill : FILW; c2.alignment = ALN_R; c2.numFmt = '#,##0';
            if (formula) c2.value = { formula, result: cnt };
            c3.font = st ? st.font : F8;   c3.fill = st ? st.fill : FILW;   c3.alignment = ALN_C;
            return row;
        }
        function _blk() {
            const r = ws.addRow(['','','']); r.height = 6;
            r.eachCell({ includeEmpty:true }, c => { c.fill = FILW; c.font = F8; });
        }

        const iMax   = issuedRows.length + 1;
        const cMax   = cancelRows.length  + 1;
        const iTotal = issuedRows.length  || 1;

        const t1 = ws.addRow([`LI Float Reconciliation — ${label}`, '', '']);
        t1.height = 26;
        ws.mergeCells(`A${t1.number}:C${t1.number}`);
        t1.getCell(1).font = { name:'Aptos', size:12, bold:true, color:{ argb:'FF1E3A5F' } };
        t1.getCell(1).fill = FILW; t1.getCell(1).alignment = ALN_L;
        _blk();

        _hRow('ISSUED CASES — Final Status', 'Count', '%');
        [
            { lbl:'Match',                             key:'ok',  cnt: summary.match,        pat:'Match'          },
            { lbl:'Amount Mismatch — SAP Lower',  key:'err', cnt: issuedRows.filter(x=>x['_FINAL_STATUS'].includes('SAP Lower')).length,        pat:'SAP Lower'      },
            { lbl:'Amount Mismatch — Float Lower',key:'err', cnt: issuedRows.filter(x=>x['_FINAL_STATUS'].includes('Float Lower')).length,      pat:'Float Lower'    },
            { lbl:'Loan Cancelled — Policy to Cancel', key:'amb', cnt: summary.cancelled,    pat:'Cancelled'      },
            { lbl:'Loan Not Disbursed',                key:'amb', cnt: summary.notDisbursed, pat:'Not Disbursed'  },
            { lbl:'Active — SAP Data Missing',    key:'blu', cnt: issuedRows.filter(x=>x['_FINAL_STATUS'].includes('SAP Data Missing')).length, pat:'SAP Data Missing'},
        ].forEach(st => {
            const row = _dRow(st.lbl, st.cnt, Math.round(st.cnt/iTotal*100), st.key,
                `COUNTIF('Issued Cases'!O2:O${iMax},"*${st.pat}*")`);
            row.getCell(3).fill = ST[st.key].fill;
            row.getCell(3).font = ST[st.key].font;
        });
        _hRow('TOTAL ISSUED LOANS', issuedRows.length);
        _blk();

        _hRow('PR CHECK', 'Count', '');
        _dRow('Float = PR (Match)',     summary.prMatch,    null, 'ok',  `COUNTIF('Issued Cases'!I2:I${iMax},"Match")`);
        _dRow('Float ≠ PR (Mismatch)', summary.prMismatch, null, 'err', `COUNTIF('Issued Cases'!I2:I${iMax},"Mismatch")`);
        _blk();

        _hRow('CANCELLATION', 'Count', '');
        [
            { lbl:'Knocked Off — Debit & Credit Match', key:'ok',  cnt: cancelRows.filter(x=>(x['_CANCEL_REM']||'').includes('Knocked Off')).length, pat:'Knocked Off' },
            { lbl:'Shortfall — Refunded Less',           key:'err', cnt: cancelRows.filter(x=>(x['_CANCEL_REM']||'').includes('Shortfall')).length,   pat:'Shortfall'   },
            { lbl:'Excess Credit — Investigate',         key:'amb', cnt: cancelRows.filter(x=>(x['_CANCEL_REM']||'').includes('Excess')).length,       pat:'Excess'      },
        ].forEach(cs => _dRow(cs.lbl, cs.cnt, null, cs.key, `COUNTIF('Cancellation'!N2:N${cMax},"*${cs.pat}*")`));
        _hRow('TOTAL CANCELLATIONS', cancelRows.length);
        _blk();

        _hRow('FLOAT KPIs', 'Value', '');
        const fdr = _dRow('Total Float Deduction', summary.totalFloat, null, null, `SUM('Issued Cases'!H2:H${iMax})`);
        fdr.getCell(2).numFmt = '#,##0';
        _dRow('Match %',        summary.matchPct, null, null);
        _dRow('Top Up Entries', topupRows.length, null, null);

        ws.eachRow(row => {
            row.eachCell({ includeEmpty:true }, cell => {
                if (!cell.fill || !cell.fill.fgColor) cell.fill = FILW;
                if (!cell.font || !cell.font.name)    cell.font = F8;
            });
        });
    })();

    return wb.xlsx.writeBuffer();
}

/* ================================================================
   LOAN INSURANCE — PAGE REGISTRATION  (v6 — DB-first flow)
   ================================================================ */

Router.register('loanins', function(panel) {
    let _data     = null;
    let _prMonths = [];   // months in selected period, e.g. ["Apr'25","May'25"]

    // ── Month helpers ──────────────────────────────────────────────
    const _MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function _ymToLabel(ym) {        // "2025-04" → "Apr'25"
        if (!ym) return '';
        const d = new Date(ym + '-01');
        return _MO[d.getMonth()] + "'" + String(d.getFullYear()).slice(-2);
    }

    function _normLbl(s) {           // "Apr 2025" or "April'25" → "Apr'25"
        if (!s) return '';
        s = String(s).trim();
        const m1 = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
        if (m1) return (m1[1].slice(0,3).charAt(0).toUpperCase()+m1[1].slice(1,3).toLowerCase())+"'"+m1[2].slice(-2);
        const m2 = s.match(/^([A-Za-z]+)'(\d{2})$/);
        if (m2) return (m2[1].slice(0,3).charAt(0).toUpperCase()+m2[1].slice(1,3).toLowerCase())+"'"+m2[2];
        return s;
    }

    function _monthsInRange(fromLbl, toLbl) {
        const parse = lbl => {
            const m = lbl.match(/([A-Za-z]+)'(\d+)/);
            if (!m) return null;
            const mo = _MO.findIndex(x => x.toLowerCase() === m[1].slice(0,3).toLowerCase());
            return mo < 0 ? null : { mo, yr: 2000 + parseInt(m[2]) };
        };
        const from = parse(fromLbl), to = parse(toLbl || fromLbl);
        if (!from || !to) return [fromLbl];
        const out = [];
        let { mo, yr } = from;
        while (yr < to.yr || (yr === to.yr && mo <= to.mo)) {
            out.push(_MO[mo] + "'" + String(yr).slice(-2));
            if (++mo > 11) { mo = 0; yr++; }
        }
        return out;
    }

    // ── Default period inputs to current month ─────────────────────
    const _now    = new Date();
    const _curYM  = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0');
    const _prevYM = (function(){
        const d = new Date(_now.getFullYear(), _now.getMonth()-1, 1);
        return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    })();

    panel.innerHTML = `
    <!-- Hero -->
    <div class="module-hero">
      <div>
        <div class="hero-label">Reconciliation</div>
        <div class="hero-title">Loan Insurance Recon</div>
        <div class="hero-sub">Go Digit LI · Float (DB) vs PR Register vs Disbursal (DB) · Health + PA per Loan ID</div>
      </div>
      <div class="hero-actions">
        <button class="btn-ghost" id="li-reset-btn">↺ Reset</button>
        <button class="btn-ghost" id="li-export-btn" style="display:none">⬇ Export Report</button>
      </div>
    </div>

    <div id="li-upload-zone">
      <div id="li-hint"></div>

      <!-- Step 1: Period -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Step 1 — Select Period</span></div>
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
            <input type="month" class="form-input" id="li-month-picker" value="${_curYM}" style="width:160px">
          </div>
          <div id="li-range-wrap" style="display:none;gap:8px;align-items:flex-end">
            <div>
              <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">From</div>
              <input type="month" class="form-input" id="li-range-start" value="${_prevYM}" style="width:150px">
            </div>
            <div>
              <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">To</div>
              <input type="month" class="form-input" id="li-range-end" value="${_curYM}" style="width:150px">
            </div>
          </div>
          <button class="btn-o" id="li-set-period-btn" style="padding:8px 20px;font-size:12px;font-weight:600">
            📅 Set Period
          </button>
        </div>
      </div>

      <!-- Step 2: Data Sources (auto from DB) -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title">Step 2 — Data Sources</span>
          <span style="font-size:11px;color:var(--muted)">Auto-loaded from database · no file upload needed</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="border:1px dashed var(--border);border-radius:8px;padding:14px">
            <div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:3px">Float Register — Go Digit LI</div>
            <div style="font-size:10px;color:var(--muted);margin-bottom:8px">Policy debit/credit entries · POLICY_NUMBER, DEBIT_AMT, CREDIT_AMT</div>
            <span id="li-float-badge" style="font-size:10px;padding:3px 10px;border-radius:10px;background:#FFF3CD;color:#8A6010">⏳ Loads on Run</span>
          </div>
          <div style="border:1px dashed var(--border);border-radius:8px;padding:14px">
            <div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:3px">Disbursal Data — HANA + Loan Status</div>
            <div style="font-size:10px;color:var(--muted);margin-bottom:8px">LI charges, disbursal dates, loan status · all months</div>
            <span id="li-disbursal-badge" style="font-size:10px;padding:3px 10px;border-radius:10px;background:#FFF3CD;color:#8A6010">⏳ Loads on Run</span>
          </div>
        </div>
      </div>

      <!-- Step 3: PR Register — dynamic per month -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title">Step 3 — PR Register</span>
          <span id="li-pr-hint-text" style="font-size:11px;color:var(--muted)">Set period above first · one file per month will appear</span>
        </div>
        <div id="li-pr-rows">
          <div style="padding:24px;text-align:center;color:var(--muted);font-size:12px;border:1px dashed var(--border);border-radius:8px">
            Select period and click <strong>📅 Set Period</strong> to generate upload sections.
          </div>
        </div>
      </div>

      <!-- Step 4: Run -->
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
      <div id="li-kpi-strip" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px"></div>
      <div class="tab-bar" id="li-tabs"></div>
      <div id="li-tab-content"></div>
    </div>
  `;

    // ── Mode toggle ─────────────────────────────────────────────────
    document.getElementById('li-mode')?.addEventListener('change', function() {
        const isRange = this.value === 'range';
        document.getElementById('li-month-wrap').style.display = isRange ? 'none' : 'block';
        document.getElementById('li-range-wrap').style.display = isRange ? 'flex'  : 'none';
    });

    // ── Set Period → generate dynamic PR file sections ───────────────
    document.getElementById('li-set-period-btn')?.addEventListener('click', _setPeriod);

    function _setPeriod() {
        const mode = document.getElementById('li-mode').value;
        let fromLabel, toLabel;
        if (mode === 'month') {
            const picker = document.getElementById('li-month-picker').value;
            if (!picker) { _hint('li-hint','danger','Select a month first.'); return; }
            fromLabel = toLabel = _ymToLabel(picker);
        } else {
            const rs = document.getElementById('li-range-start').value;
            const re = document.getElementById('li-range-end').value;
            if (!rs || !re) { _hint('li-hint','danger','Select both From and To months.'); return; }
            fromLabel = _ymToLabel(rs);
            toLabel   = _ymToLabel(re);
        }

        _prMonths = _monthsInRange(fromLabel, toLabel);
        if (!_prMonths.length)   { _hint('li-hint','danger','No months in selected range.'); return; }
        if (_prMonths.length > 12){ _hint('li-hint','danger','Range too large (max 12 months).'); return; }

        const container = document.getElementById('li-pr-rows');
        container.innerHTML = _prMonths.map(mo => `
          <div style="display:flex;align-items:center;gap:10px;padding:12px;
               border:1px dashed var(--border);border-radius:8px;margin-bottom:8px">
            <div style="flex:1">
              <div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:3px">${mo} — PR Register</div>
              <div style="font-size:10px;color:var(--muted);margin-bottom:6px">
                POLICY_NUMBER · BOOKINGID_PLANID · PRODUCT_LOB · GROSS_PREMIUM
              </div>
              <input type="file" class="li-pr-file" data-month="${mo}"
                     accept=".xlsx,.xls,.csv" style="font-size:11px;color:var(--muted)">
            </div>
          </div>`).join('');

        document.getElementById('li-pr-hint-text').textContent =
            _prMonths.length === 1
            ? `${_prMonths[0]} — 1 month`
            : `${_prMonths[0]} → ${_prMonths[_prMonths.length-1]} — ${_prMonths.length} months`;
        _hint('li-hint','','');
    }

    // ── Reset ────────────────────────────────────────────────────────
    document.getElementById('li-reset-btn')?.addEventListener('click', () => {
        _data = null; _prMonths = [];
        _showUpload('li');
        _hint('li-hint','','');
        document.getElementById('li-export-btn').style.display = 'none';
        document.getElementById('li-pr-rows').innerHTML =
            '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px;' +
            'border:1px dashed var(--border);border-radius:8px">' +
            'Select period and click <strong>📅 Set Period</strong> to generate upload sections.</div>';
        document.getElementById('li-pr-hint-text').textContent = 'Set period above first · one file per month will appear';
        _badge('li-float-badge',    '⏳ Loads on Run', '#FFF3CD', '#8A6010');
        _badge('li-disbursal-badge','⏳ Loads on Run', '#FFF3CD', '#8A6010');
    });

    // ── Export ───────────────────────────────────────────────────────
    document.getElementById('li-export-btn')?.addEventListener('click', async () => {
        if (!_data) return;
        const label = _data.summary.label || 'Recon';
        const safe  = label.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');
        const btn   = document.getElementById('li-export-btn');
        btn.textContent = '⏳ Exporting…';
        btn.disabled = true;
        try {
            const buf = await _liExportXLSX(_data, label);
            _downloadXLSX(buf, `LI_Float_Recon_${safe}.xlsx`);
        } finally {
            btn.textContent = '⬇ Export XLSX';
            btn.disabled = false;
        }
    });

    function _badge(id, text, bg, color) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        el.style.background = bg;
        el.style.color = color;
    }

    // ── Run ──────────────────────────────────────────────────────────
    document.getElementById('li-run-btn')?.addEventListener('click', _runLI);

    async function _runLI() {
        // 1. Period must be configured via Set Period
        if (!_prMonths.length) {
            _hint('li-hint','danger',
                '<strong>Set Period first.</strong> Click <strong>📅 Set Period</strong> above to generate PR upload sections.');
            return;
        }

        // 2. Collect PR files
        const prInputs = Array.from(document.querySelectorAll('#li-pr-rows .li-pr-file'));
        const prFiles  = prInputs.map(el => ({ file: el.files?.[0], month: el.dataset.month }))
                                 .filter(p => p.file);
        if (!prFiles.length) {
            _hint('li-hint','danger',
                '<strong>PR Register required.</strong> Upload at least one PR Register file.');
            return;
        }
        if (!window.XLSX) {
            _hint('li-hint','danger','SheetJS library not loaded — please refresh the page.');
            return;
        }

        // 3. Derive period metadata from _prMonths
        const mode = document.getElementById('li-mode').value;
        let periodLabel, periodStart, periodEnd;
        if (mode === 'month') {
            const picker = document.getElementById('li-month-picker').value; // "2025-04"
            const d = new Date(picker + '-01');
            periodStart = d;
            periodEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            periodLabel = _prMonths[0];
        } else {
            const rs = document.getElementById('li-range-start').value;
            const re = document.getElementById('li-range-end').value;
            periodStart = new Date(rs + '-01');
            const dEnd  = new Date(re + '-01');
            periodEnd   = new Date(dEnd.getFullYear(), dEnd.getMonth() + 1, 0);
            periodLabel = _prMonths.length === 1
                ? _prMonths[0]
                : `${_prMonths[0]} to ${_prMonths[_prMonths.length-1]}`;
        }

        _hint('li-hint','','');
        _showLoad('li');
        const setP = _progress('li-progress-label','li-progress-bar','li-progress-pct');

        try {
            // ── A: Load Float Register from DB ──────────────────────────
            setP(8, 'Loading Float Register from database…');
            let allFloatRows = [];
            try {
                const floatRes  = await API.Float.getRegister('Go_Digit_LI', null);
                const dbRecords = (floatRes && floatRes.data) ? floatRes.data : [];
                // Map camelCase DB fields → UPPER_SNAKE_CASE expected by recon engine
                allFloatRows = dbRecords.map(r => ({
                    FLOAT_TYPE:          r.floatType           || '',
                    MONTHS:              r.monthLabel          || '',
                    TRANS_DATE:          r.transDate           || '',
                    BOOKING_TYPE:        r.bookingType         || '',
                    TRANSACTION_DETAILS: r.transactionDetails  || '',
                    CREDIT_AMT:          Number(r.creditAmt   || 0),
                    DEBIT_AMT:           Number(r.debitAmt    || 0),
                    BALANCE:             Number(r.balance     || 0),
                    POLICY_NUMBER:       r.policyNumber        || '',
                    LOAN_ID:             r.loanId             || '',
                    IMD_CODE:            r.imdCode            || '',
                }));
                _badge('li-float-badge',
                    '✅ ' + allFloatRows.length.toLocaleString() + ' records from DB',
                    '#D9F0D9', '#1D6F42');
                console.log('[LI] Float from DB:', allFloatRows.length);
            } catch(e) {
                _badge('li-float-badge', '❌ DB load failed', '#FFE0E0', '#8B2121');
                throw new Error('Float Register load failed: ' + e.message);
            }

            // ── B: Filter to selected period ─────────────────────────────
            setP(20, 'Filtering float entries for period…');
            const monthSet = new Set(_prMonths.map(m => _normLbl(m)));
            const floatRows = allFloatRows.filter(r => {
                const mo = _normLbl(String(r.MONTHS || '').trim());
                if (mo) return monthSet.has(mo);
                // Fallback: TRANS_DATE date range
                const dt = new Date(r.TRANS_DATE);
                return !isNaN(dt.getTime()) && dt >= periodStart && dt <= periodEnd;
            });
            console.log(`[LI] Float period filter: ${allFloatRows.length} → ${floatRows.length}`);

            if (floatRows.length === 0) {
                const avail = [...new Set(allFloatRows.map(r=>r.MONTHS).filter(Boolean))].slice(0,8);
                _hint('li-hint','danger',
                    `<strong>No float entries found for ${periodLabel}.</strong><br>` +
                    (avail.length ? `Available months in DB: <code>${avail.join(', ')}</code><br>` : '') +
                    `Make sure float data has been uploaded for this period via Float Register → Upload.`);
                _showUpload('li'); return;
            }

            // ── C: Load Disbursal (HANA + Loan Status) from DB ──────────
            setP(32, 'Loading disbursal data from database…');
            let _dbReconData = [];
            try {
                const dbRes  = await API.Disbursal.getReconData();
                _dbReconData = (dbRes && dbRes.data) ? dbRes.data : [];
                _badge('li-disbursal-badge',
                    '✅ ' + _dbReconData.length.toLocaleString() + ' records from DB',
                    '#D9F0D9', '#1D6F42');
                console.log('[LI] Disbursal from DB:', _dbReconData.length);
            } catch(e) {
                _badge('li-disbursal-badge', '⚠️ DB unavailable — loan status may be incomplete', '#FFF3CD', '#8A6010');
                console.warn('[LI] Disbursal DB failed:', e.message);
            }

            // Map to HANA format for recon engine
            const hanaRows = _dbReconData.map(r => ({
                LOAN_APPLICATION_ID: r.loanApplicationId || '',
                LI_CHARGES:          r.liCharges || 0,
                DISBURSEMENT_DATE:   r.disbursementDate || '',
            }));

            // Build monthEntries for status lookup
            const monthEntries = [];
            if (_dbReconData.length) {
                const dbStatusRows = _dbReconData
                    .filter(r => r.loanApplicationId)
                    .map(r => _normRow({
                        LOAN_APPLICATION_ID: r.loanApplicationId,
                        LOAN_STATUS:         r.loanStatus || '',
                        DISBURSEMENT_DATE:   r.disbursementDate || '',
                    }));
                if (dbStatusRows.length) monthEntries.push({ rows: dbStatusRows, label: 'DB Records' });
            }

            // ── D: Load PR Register files ─────────────────────────────────
            setP(46, `Reading PR Register(s) — ${prFiles.length} file(s)…`);
            let prRows = [];
            for (let i = 0; i < prFiles.length; i++) {
                setP(46 + Math.round(i / Math.max(prFiles.length,1) * 22),
                    `Reading PR file: ${prFiles[i].month} (${prFiles[i].file.name})…`);
                const prWB  = await _readWB(prFiles[i].file);
                const found = _findSheet(prWB, 'POLICY');
                const rows  = found.rows.length ? found.rows : _sheetToRows(prWB, prWB.SheetNames[0], '');
                prRows = prRows.concat(rows);
                console.log(`[LI] PR ${prFiles[i].month}: ${rows.length} rows`);
            }
            if (!prRows.length) {
                _hint('li-hint','danger',
                    '<strong>PR Register(s) empty.</strong> Ensure files have POLICY_NUMBER and PRODUCT_LOB columns.');
                _showUpload('li'); return;
            }

            // ── E: Run reconciliation ─────────────────────────────────────
            setP(72, 'Running reconciliation logic…');
            const result = _liRunRecon(floatRows, allFloatRows, prRows, hanaRows, monthEntries);
            console.log('[LI] Issued:', result.issuedRows.length,
                '| Cancel:', result.cancelRows.length,
                '| TopUp:', result.topupRows.length,
                '| Queries:', result.queries.length);

            if (result.issuedRows.length === 0 && result.topupRows.length > 0) {
                const prKeys = Object.keys(prRows[0] || {});
                _hint('li-hint','danger',
                    `<strong>No Issued Cases found — ${result.topupRows.length} rows are Top Up.</strong><br>` +
                    `PR columns found: <code>${prKeys.slice(0,10).join(', ')}</code><br>` +
                    `<strong>Check:</strong> PRODUCT_LOB must contain <code>Health</code> or <code>PA</code>.`);
                _showUpload('li'); return;
            }

            result.summary.label = periodLabel;
            _data = result;

            window._lastLIResult = {
                monthLabel: periodLabel,
                total:      result.summary.total,
                match:      result.summary.match,
                matchPct:   result.summary.matchPct,
                queries:    result.summary.queries,
                totalFloat: result.summary.totalFloat,
                prMismatch: result.summary.prMismatch || 0,
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
            { label:'TOTAL LOANS',       value: summary.total.toLocaleString(),       sub:'Issued this period',   color:'var(--navy-lt)' },
            { label:'MATCH',             value: summary.match.toLocaleString(),        sub:`${summary.matchPct}%`, color:'var(--green)' },
            { label:'OPEN QUERIES',      value: summary.queries.toLocaleString(),      sub:'Need resolution',      color:'var(--red)' },
            { label:'LOAN CANCELLED',    value: summary.cancelled.toLocaleString(),    sub:'Policy to cancel',     color:'var(--navy)' },
            { label:'NOT DISBURSED',     value: summary.notDisbursed.toLocaleString(), sub:'Policy to cancel',     color:'var(--navy)' },
            { label:'TOTAL FLOAT (₹)',   value: '₹' + _inr(summary.totalFloat),       sub:'Deducted this period', color:'var(--gold)' },
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

        const prcheckCols = [
            {key:'Loan ID',                  label:'Loan ID'},
            {key:'Policy No - Health',       label:'Policy Health'},
            {key:'Debit Float (Health)',      label:'Float Debit H (₹)'},
            {key:'Policy No - PA',           label:'Policy PA'},
            {key:'Debit Float (PA)',          label:'Float Debit PA (₹)'},
            {key:'Total Deduction (Float)',   label:'Total Float Dedn'},
            {key:'Gross Premium (PR)',        label:'Gross Premium (PR)'},
            {key:'Float vs PR Check',        label:'Check', badge:true},
            {key:'LI Amount (SAP)',          label:'SAP LI Amt'},
            {key:'_FINAL_STATUS',            label:'Final Status', badge:true},
        ];

        content.innerHTML = `<div class="table-wrap" id="li-tbl-wrap"></div>`;
        if (id==='issued')   _renderTable('li-tbl-wrap', issuedRows, issuedCols);
        if (id==='queries')  _renderTable('li-tbl-wrap', queries,    issuedCols);
        if (id==='cancel')   _renderTable('li-tbl-wrap', cancelRows, cancelCols);
        if (id==='topup')    _renderTable('li-tbl-wrap', topupRows,
            [{key:'Date',label:'Date'},{key:'Type',label:'Type'},{key:'Details',label:'Details'},
                {key:'Credit',label:'Credit (₹)'},{key:'Debit',label:'Debit (₹)'}]);
        if (id==='prcheck') {
            const mismatch = (issuedRows||[]).filter(r => r['Float vs PR Check'] === 'Mismatch');
            _renderTable('li-tbl-wrap', mismatch, prcheckCols);
        }
    };
});

