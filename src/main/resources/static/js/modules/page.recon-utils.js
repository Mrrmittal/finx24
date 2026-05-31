/**
 * FINX24 — Shared Reconciliation Utilities
 * Used by: page.recon-li.js and page.recon-mi.js
 * Do not register any Router pages here.
 * @author  Jatin Mittal
 * @contact jatin.mittal@cars24.com | +91-8221944248
 * @company CARS24 Financial Services Pvt. Ltd. (CFSPL)
 */

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