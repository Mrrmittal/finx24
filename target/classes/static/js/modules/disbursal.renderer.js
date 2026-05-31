/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/disbursal.renderer.js
 * Description : Pure UI renderer for the disbursal report.
 *               Receives a processed dataset and builds:
 *                 - Summary banner (cancel counts)
 *                 - 9 KPI cards (Net count, Active, Net Disbursal,
 *                   Avg Loan, LI, MI, Cars24, Bajaj, PMax)
 *                 - Daily trend chart (ACTIVE rows only)
 *                 - Breakdown tabs: Channel, HPA Status, Insurance Plan
 *                 - Charge group summary
 *                 - Paginated full data table with filter + export
 *
 * Author      : Jatin Mittal
 * Email       : jatin.mittal@cars24.com
 * Version     : 2.0.0
 * Updated     : April 2024
 * ================================================================
 */

const DisbursalRenderer = (() => {

  const C        = DisbursalConstants;
  const PAGE_SIZE = 50;

  let _dataset     = null;
  let _currentPage = 1;
  let _activeTab   = 'channel';
  let _filter      = { status:'ALL', search:'' };

  /* ============================================================
     MAIN RENDER
     ============================================================ */
  function render(container, dataset) {
    _dataset     = dataset;
    _currentPage = 1;
    _activeTab   = 'channel';
    _filter      = { status:'ALL', search:'' };

    container.innerHTML = `
      ${_renderBanner(dataset)}
      ${_renderKPIGrid(dataset.summary)}
      ${_renderTrendCard()}
      ${_renderBreakdownSection()}
      ${_renderChargesCard(dataset.chargeBreakdown)}
      ${_renderTableSection()}
    `;

    _attachTabListeners();
    _attachFilterListeners();
    _attachPaginationListeners();

    /* Charts need canvas in DOM */
    setTimeout(() => {
      Charts.renderDisbursalTrend('dis-trend-chart', dataset.byDate);
      _renderBreakdownTab(_activeTab);
    }, 80);
  }

  /* ============================================================
     BANNER
     ============================================================ */
  function _renderBanner({ summary, period }) {
    const parts = [];
    if (summary.same_month_cancel_count > 0)
      parts.push(`<strong>${summary.same_month_cancel_count}</strong> same-month cancel(s) fully excluded`);
    if (summary.old_month_cancel_count > 0)
      parts.push(`<strong>${summary.old_month_cancel_count}</strong> old-month cancel(s) deducted as negative`);

    const periodStr = period
      ? `Period: ${_fmtPeriod(period)}`
      : '';

    if (!parts.length && !periodStr) return '';
    return `
      <div class="notice" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;padding:7px 12px;font-size:11px;margin-bottom:10px;">
        <span>${parts.join(' &nbsp;·&nbsp; ') || 'All loans active — no cancellations detected'}</span>
        ${periodStr ? `<span style="font-weight:500;color:var(--navy);">${periodStr}</span>` : ''}
      </div>
    `;
  }

  /* ============================================================
     KPI GRID — 9 cards in 3×3, compact
     ============================================================ */
  function _renderKPIGrid(s) {
    const cards = [
      { label:'Net Loan Count',  value: s.net_count.toLocaleString('en-IN'),              sub:`${s.active_count} active · ${s.old_month_cancel_count} old-cancel`, accent:'accent-gold'  },
      { label:'Active Loans',    value: s.active_count.toLocaleString('en-IN'),            sub:'Disbursed in period',             accent:'accent-green' },
      { label:'Net Disbursal',   value: UI.inrShort(s.net_disbursal),                     sub:'After cancel deductions',         accent:'accent-blue'  },
      { label:'Avg Loan Amount', value: UI.inrShort(s.avg_loan),                          sub:'Per net active loan',             accent:'accent-navy'  },
      { label:'LI Charges (Net)',value: UI.inrShort(s.li_charges),                        sub:'Loan insurance',                  accent:'accent-teal'  },
      { label:'MI Charges (Net)',value: UI.inrShort(s.mi_charges),                        sub:'Motor insurance',                 accent:'accent-teal'  },
      { label:'Cars24 Cases',    value: s.cars24_count.toLocaleString('en-IN'),            sub:'HPA — Cars24',              accent:'accent-navy'  },
      { label:'Bajaj Cases',     value: s.bajaj_count.toLocaleString('en-IN'),             sub:'Via Bajaj channel',               accent:'accent-gold'  },
      { label:'PMax Cases',      value: Math.max(s.pmax_count,0).toLocaleString('en-IN'),  sub:'Other channels',                  accent:'accent-slate' },
    ];
    return `
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:10px;">
        ${cards.map(c => `
          <div class="kpi-card ${c.accent}"
               style="padding:8px 10px;">
            <div class="kpi-label" style="font-size:9px;margin-bottom:3px;letter-spacing:0.7px;">${c.label}</div>
            <div class="kpi-value" style="font-size:15px;margin-bottom:2px;line-height:1.2;">${c.value}</div>
            <div class="kpi-sub"   style="font-size:9px;">${c.sub}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ============================================================
     TREND CHART — compact, active rows only, no slider
     ============================================================ */
  function _renderTrendCard() {
    return `
      <div class="card mb-12">
        <div class="card-header" style="margin-bottom:6px;">
          <span class="card-title">Daily disbursal trend — active loans only</span>
          <div class="flex gap-8" style="font-size:10px;color:var(--muted);">
            <span style="display:flex;align-items:center;gap:3px;">
              <span style="width:8px;height:8px;border-radius:2px;background:#1E3F6B;display:inline-block;"></span>Amt (₹L)
            </span>
            <span style="display:flex;align-items:center;gap:3px;">
              <span style="width:8px;height:8px;border-radius:2px;background:#C8992A;display:inline-block;"></span>Count
            </span>
          </div>
        </div>
        <div style="position:relative;width:100%;height:120px;">
          <canvas id="dis-trend-chart" role="img"
            aria-label="Daily disbursal trend — active loans only">
            Daily active loan disbursal data.
          </canvas>
        </div>
      </div>
    `;
  }

  /* ============================================================
     BREAKDOWN TABS — Channel / HPA Status / Insurance Plan
     ============================================================ */
  function _renderBreakdownSection() {
    const tabs = [
      { key:'channel',      label:'Channel-wise' },
      { key:'hpa',          label:'HPA Status-wise' },
      { key:'insuranceplan',label:'Insurance Plan-wise' },
    ];
    return `
      <div class="card mb-12" style="padding:12px 14px;">
        <div class="card-header" style="margin-bottom:8px;">
          <span class="card-title">Breakdown analysis</span>
        </div>
        <div class="tab-bar" id="breakdown-tabs">
          ${tabs.map(t => `
            <div class="tab-item ${t.key === _activeTab ? 'active':''}" data-tab="${t.key}">
              ${t.label}
            </div>
          `).join('')}
        </div>
        <div id="breakdown-content"></div>
      </div>
    `;
  }

  function _renderBreakdownTab(tabKey) {
    const dataMap = {
      channel:       _dataset.byChannel,
      hpa:           _dataset.byHPA,
      insuranceplan: _dataset.byInsurancePlan,
    };
    const dimLabel = {
      channel:'Channel', hpa:'HPA Status', insuranceplan:'Insurance Plan',
    };
    const rows  = dataMap[tabKey] || [];
    const max   = rows[0]?.netDisbursal || 1;

    const tbody = rows.slice(0,30).map(r => `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td>${r.count.toLocaleString('en-IN')}</td>
        <td>${UI.inrShort(r.carFinance)}</td>
        <td>${UI.inrShort(r.netDisbursal)}</td>
        <td style="min-width:100px;">
          <div class="progress-wrap">
            <div class="progress-fill medium" style="width:${_pct(r.netDisbursal,max)}%"></div>
          </div>
        </td>
      </tr>
    `).join('');

    document.getElementById('breakdown-content').innerHTML = `
      <div class="table-wrap" style="border-top-left-radius:0;border-top-right-radius:0;border-top:none;">
        <table class="data-table">
          <thead>
            <tr>
              <th>${dimLabel[tabKey]}</th>
              <th>Loans</th>
              <th>Car Finance</th>
              <th>Net Disbursal</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>${tbody || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">No data</td></tr>'}</tbody>
        </table>
        <div class="table-footer">
          <span>Showing ${Math.min(rows.length,30)} of ${rows.length} groups</span>
        </div>
      </div>
    `;
  }

  function _attachTabListeners() {
    document.querySelectorAll('#breakdown-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#breakdown-tabs .tab-item').forEach(t=>t.classList.remove('active'));
        el.classList.add('active');
        _activeTab = el.dataset.tab;
        _renderBreakdownTab(_activeTab);
      });
    });
  }

  /* ============================================================
     CHARGES CARD
     ============================================================ */
  function _renderChargesCard(chargeBreakdown) {
    const rows = Object.entries(chargeBreakdown).map(([gk, grp]) => `
      <tr>
        <td><strong>${grp.label}</strong></td>
        <td>${UI.inrShort(grp.total)}</td>
        <td style="color:var(--muted);font-size:11px;">${Object.keys(grp.columns).length} columns</td>
        <td>
          <span class="tag tag-matched" style="cursor:pointer;"
            onclick="DisbursalRenderer.toggleChargeDetail('${gk}')">
            View
          </span>
        </td>
      </tr>
    `).join('');

    return `
      <div class="card mb-12" style="padding:12px 14px;">
        <div class="card-header" style="margin-bottom:8px;">
          <span class="card-title">Charge group summary</span>
          <span style="font-size:11px;color:var(--muted);">Net of active + old-month cancels</span>
        </div>
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="data-table">
            <thead><tr><th>Group</th><th>Net Total (₹)</th><th>Columns</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div id="charge-detail-panel" style="display:none;"></div>
      </div>
    `;
  }

  function toggleChargeDetail(groupKey) {
    const panel = document.getElementById('charge-detail-panel');
    const grp   = _dataset?.chargeBreakdown?.[groupKey];
    if (!panel || !grp) return;

    if (panel.dataset.open === groupKey) {
      panel.style.display = 'none';
      panel.dataset.open  = '';
      return;
    }

    const detailRows = Object.entries(grp.columns)
      .filter(([,v]) => v !== 0)
      .sort(([,a],[,b]) => Math.abs(b) - Math.abs(a))
      .map(([col, val]) => `
        <tr>
          <td style="padding-left:24px;color:var(--muted);">${col}</td>
          <td class="${val < 0 ? 'diff-neg':''}">${UI.inr(val)}</td>
        </tr>
      `).join('');

    panel.innerHTML = `
      <div style="background:var(--cream);border-top:1px solid var(--border);padding:6px 0;">
        <table class="data-table">
          <thead><tr><th style="padding-left:24px;">Column</th><th>Amount (₹)</th></tr></thead>
          <tbody>${detailRows || '<tr><td colspan="2" style="color:var(--muted);padding:12px;">All zero for this period</td></tr>'}</tbody>
        </table>
      </div>
    `;
    panel.style.display = 'block';
    panel.dataset.open  = groupKey;
  }

  /* ============================================================
     MAIN TABLE
     ============================================================ */
  function _renderTableSection() {
    return `
      <div class="card" style="padding:12px 14px;">
        <div class="card-header" style="margin-bottom:8px;">
          <span class="card-title">Loan-wise detail</span>
          <span style="font-size:11px;color:var(--muted);" id="dis-table-count">—</span>
        </div>
        <div class="filter-bar" style="margin-bottom:8px;">
          <select class="form-select" id="dis-status-filter">
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active only</option>
            <option value="OLD_MONTH_CANCEL">Old Month Cancel</option>
            <option value="SAME_MONTH_CANCEL">Same Month Cancel</option>
          </select>
          <input class="form-input" id="dis-search-input"
                 placeholder="Search loan ID / customer / city…"
                 style="width:240px;">
          <div class="spacer"></div>
          <button class="btn-o" style="font-size:11px;"
            onclick="DisbursalRenderer.exportTable()">
            Export Net Report
          </button>
        </div>
        <div class="table-wrap">
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  ${C.SUMMARY_TABLE_COLS.map(c =>
                    `<th style="min-width:${c.width};">${c.label}</th>`
                  ).join('')}
                </tr>
              </thead>
              <tbody id="dis-main-tbody"></tbody>
            </table>
          </div>
          <div class="table-footer">
            <span id="dis-pagination-info">—</span>
            <div class="flex gap-8">
              <button class="btn-o" style="font-size:11px;padding:4px 10px;" id="dis-prev-btn">← Prev</button>
              <button class="btn-o" style="font-size:11px;padding:4px 10px;" id="dis-next-btn">Next →</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function _renderTablePage() {
    const filtered = _getFilteredRows();
    const start    = (_currentPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);
    const total    = filtered.length;
    const pages    = Math.ceil(total / PAGE_SIZE);

    const tbody = document.getElementById('dis-main-tbody');
    const info  = document.getElementById('dis-pagination-info');
    const count = document.getElementById('dis-table-count');
    if (!tbody) return;

    tbody.innerHTML = pageRows.map(row => {
      const isCancelled = row._STATUS === C.LOAN_STATUS.OLD_MONTH_CANCEL;
      const rowStyle    = isCancelled ? 'background:rgba(178,58,58,0.04);' : '';
      return `
        <tr style="${rowStyle}">
          ${C.SUMMARY_TABLE_COLS.map(col => {
            if (col.key === '_STATUS_LABEL') {
              return `<td>${_statusTag(row._STATUS)}</td>`;
            }
            if (col.key === 'INSURANCE_PLAN') {
              const v = String(row[col.key] || '').trim();
              const disp = (!v || v.toLowerCase()==='nan') ? 'Standalone' : v;
              return `<td>${disp}</td>`;
            }
            const val = row[col.key] ?? '—';
            const num = parseFloat(String(val).replace(/,/g,''));
            const cls = (!isNaN(num) && num < 0) ? 'diff-neg' : '';
            return `<td class="${cls}">${val || '—'}</td>`;
          }).join('')}
        </tr>
      `;
    }).join('') || `
      <tr><td colspan="${C.SUMMARY_TABLE_COLS.length}"
        style="text-align:center;color:var(--muted);padding:24px;">
        No records match the current filter.
      </td></tr>
    `;

    if (info) info.textContent = total
      ? `Showing ${start+1}–${Math.min(start+PAGE_SIZE, total)} of ${total.toLocaleString('en-IN')}`
      : '0 records';
    if (count) count.textContent = `${total.toLocaleString('en-IN')} records`;

    const prev = document.getElementById('dis-prev-btn');
    const next = document.getElementById('dis-next-btn');
    if (prev) prev.disabled = _currentPage <= 1;
    if (next) next.disabled = _currentPage >= pages;
  }

  function _getFilteredRows() {
    if (!_dataset) return [];
    let rows = _dataset.allRows;
    if (_filter.status !== 'ALL')
      rows = rows.filter(r => r._STATUS === _filter.status);
    if (_filter.search) {
      const q = _filter.search.toLowerCase();
      rows = rows.filter(r =>
        String(r['LOAN_APPLICATION_ID']         || '').toLowerCase().includes(q) ||
        String(r['CUSTOMER_NAME_01']             || '').toLowerCase().includes(q) ||
        String(r['CITY']                         || '').toLowerCase().includes(q) ||
        String(r['VEHICLE_REGISTRATION_NUMBER']  || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }

  function _attachFilterListeners() {
    const sel   = document.getElementById('dis-status-filter');
    const input = document.getElementById('dis-search-input');
    sel?.addEventListener('change', () => {
      _filter.status = sel.value; _currentPage = 1; _renderTablePage();
    });
    let debounce;
    input?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        _filter.search = input.value.trim(); _currentPage = 1; _renderTablePage();
      }, 300);
    });
    _renderTablePage();
  }

  function _attachPaginationListeners() {
    document.getElementById('dis-prev-btn')?.addEventListener('click', () => {
      if (_currentPage > 1) { _currentPage--; _renderTablePage(); }
    });
    document.getElementById('dis-next-btn')?.addEventListener('click', () => {
      const pages = Math.ceil(_getFilteredRows().length / PAGE_SIZE);
      if (_currentPage < pages) { _currentPage++; _renderTablePage(); }
    });
  }

  /* ================================================================
     EXPORT — Full multi-sheet Excel workbook
     Sheet 1: Net Report (Active + Old-cancel negated) — ALL columns
     Sheet 2: Same Month Cancelled — ALL columns
     Sheet 3: Net Summary KPIs
     ================================================================ */
  function exportTable() {
    if (!_dataset) return;

    /* ── Collect all column keys from actual data ── */
    const allRows   = _dataset.allRows;
    if (!allRows.length) return;

    /* Get every column that exists in the data (full set) */
    const allKeys = _getAllDataKeys(allRows);

    /* ── Sheet 1: Net Report — Active + Old-cancel (negated) ── */
    const netRows = [..._dataset.active, ..._dataset.oldNegated];
    const sheet1  = _buildSheet(netRows, allKeys);

    /* ── Sheet 2: Same Month Cancelled ── */
    const sheet2 = _buildSheet(_dataset.sameCancel, allKeys);

    /* ── Sheet 3: Summary KPIs ── */
    const s = _dataset.summary;
    const summaryData = [
      ['Metric', 'Value'],
      ['Net Loan Count',                   s.net_count],
      ['Active Loans',                     s.active_count],
      ['Same Month Cancelled (Excluded)',   s.same_month_cancel_count],
      ['Old Month Cancelled (Negated)',     s.old_month_cancel_count],
      ['Net Disbursal Amount (₹)',          s.net_disbursal],
      ['Car Finance Amount (₹)',            s.car_finance_amount],
      ['LI Charges (₹)',                   s.li_charges],
      ['MI Charges (₹)',                   s.mi_charges],
      ['Cars24 Cases (HPA)',               s.cars24_count],
      ['Bajaj Cases (HPA)',                s.bajaj_count],
      ['PMax Cases (HPA — Others)',         s.pmax_count],
      ['Avg Loan Amount (₹)',              s.avg_loan],
      ['Avg Tenure (Months)',              s.avg_tenure],
      ['Avg Interest Rate (%)',            s.avg_interest],
    ];
    const sheet3 = XLSX.utils.aoa_to_sheet(summaryData);

    /* ── Build workbook ── */
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet1, 'Net Report');
    XLSX.utils.book_append_sheet(wb, sheet2, 'Same Month Cancelled');
    XLSX.utils.book_append_sheet(wb, sheet3, 'Summary KPIs');

    /* ── Write and download ── */
    const date = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `disbursal_net_report_${date}.xlsx`);
  }

  /* Build a SheetJS worksheet from an array of row objects */
  function _buildSheet(rows, keys) {
    if (!rows.length) {
      return XLSX.utils.aoa_to_sheet([keys, ['No records']]);
    }
    /* Header row */
    const data = [keys];
    rows.forEach(row => {
      data.push(keys.map(k => {
        if (k === '_STATUS_LABEL') return row._STATUS_LABEL || '';
        if (k === 'INSURANCE_PLAN') {
          const v = String(row[k] || '').trim();
          return (!v || v.toLowerCase() === 'nan') ? 'Standalone' : v;
        }
        const val = row[k];
        /* Return numeric for numeric columns — Excel will format as number */
        if (typeof val === 'number') return val;
        return val ?? '';
      }));
    });
    return XLSX.utils.aoa_to_sheet(data);
  }

  /* Collect all unique column keys across all rows */
  function _getAllDataKeys(rows) {
    const keySet = new Set();
    /* First add the known summary cols in order */
    C.SUMMARY_TABLE_COLS.forEach(c => keySet.add(c.key));
    /* Then add any remaining cols from actual data */
    rows.forEach(row => {
      Object.keys(row).forEach(k => {
        if (!k.startsWith('_')) keySet.add(k);
      });
    });
    /* Add status label at end */
    keySet.add('_STATUS_LABEL');
    return Array.from(keySet);
  }

  /* ── Helpers ── */
  function _pct(val, max) {
    if (!max) return 0;
    return Math.min(100, Math.round(Math.abs(val) / Math.abs(max) * 100));
  }
  function _statusTag(status) {
    const map = {
      [C.LOAN_STATUS.ACTIVE]:            '<span class="tag tag-matched">Active</span>',
      [C.LOAN_STATUS.OLD_MONTH_CANCEL]:  '<span class="tag tag-open">Old Month Cancel</span>',
      [C.LOAN_STATUS.SAME_MONTH_CANCEL]: '<span class="tag tag-draft">Same Month Cancel</span>',
    };
    return map[status] || '<span class="tag tag-draft">Unknown</span>';
  }
  function _fmtPeriod(period) {
    const opts = { month:'short', year:'numeric' };
    const from = period.from.toLocaleDateString('en-IN', opts);
    const to   = period.to.toLocaleDateString('en-IN', opts);
    return from === to ? from : `${from} – ${to}`;
  }

  return { render, toggleChargeDetail, exportTable };

})();