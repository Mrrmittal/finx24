/**
 * FINX24 — Motor Insurance Reconciliation
 * Go Digit · ICICI Lombard · Tata AIG · Zurich Kotak · United India
 * Requires: page.recon-utils.js loaded first
 * @author  Jatin Mittal
 * @contact jatin.mittal@cars24.com | +91-8221944248
 * @company CARS24 Financial Services Pvt. Ltd. (CFSPL)
 */

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