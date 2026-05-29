/**
 * FinRecon Pro — Disbursal Report Page
 * ADMIN : Upload Excel → DB + Dashboard + Export
 * USER  : Period picker + Dashboard + Export
 */

Router.register('disbursal', function(panel) {

  var isAdmin = typeof Auth !== 'undefined' && Auth.isAdmin();

  // ================================================================
  //  HTML TEMPLATE
  // ================================================================
  panel.innerHTML =
      '<div class="module-hero">' +
      '<div>' +
      '<div class="hero-label">Analysis</div>' +
      '<div class="hero-title">Disbursal Report</div>' +
      '<div class="hero-sub">' +
      (isAdmin
          ? 'Upload data to database &nbsp;·&nbsp; View dashboard &nbsp;·&nbsp; Export'
          : 'Select period &nbsp;·&nbsp; View KPI dashboard &nbsp;·&nbsp; Export') +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-header">' +
      '<span class="card-title">Period Selection</span>' +
      '<span style="font-size:11px;color:var(--muted)" id="disb-db-status">Loading…</span>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">' +
      '<div>' +
      '<div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">From</div>' +
      '<input type="date" class="form-input" id="disb-from" style="width:150px">' +
      '</div>' +
      '<div>' +
      '<div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">To</div>' +
      '<input type="date" class="form-input" id="disb-to" style="width:150px">' +
      '</div>' +
      '<button class="btn-g" id="disb-load-btn" style="padding:9px 24px">📊 Load Dashboard</button>' +
      '<button class="btn-o" id="disb-export-btn" style="padding:9px 24px;display:none">⬇ Export Excel</button>' +
      '</div>' +
      '<div id="disb-month-pills" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px"></div>' +
      '</div>' +

      (isAdmin ?
          '<div class="card" style="margin-bottom:16px">' +
          '<div class="card-header">' +
          '<span class="card-title">🛡️ Upload Disbursal Report</span>' +
          '<span style="font-size:11px;color:var(--muted)">Admin only · UPSERT by Loan ID</span>' +
          '</div>' +
          '<div style="border:2px dashed rgba(200,153,42,0.4);border-radius:8px;padding:16px;background:rgba(200,153,42,0.02)">' +
          '<div style="font-size:12px;color:var(--navy);margin-bottom:10px">' +
          'Select one or multiple disbursal report Excel files. Existing Loan IDs will be updated (UPSERT).' +
          '</div>' +
          '<input type="file" id="disb-upload-input" accept=".xlsx,.xls" multiple style="font-size:12px;color:var(--muted);margin-bottom:8px"><br>' +
          '<div id="disb-file-list" style="font-size:10px;color:var(--muted);margin-bottom:8px;min-height:14px"></div>' +
          '<button class="btn-g" id="disb-upload-btn" style="padding:8px 20px">⬆ Upload Files</button>' +
          '<div id="disb-upload-progress" style="margin-top:10px;display:none">' +
          '<div style="background:#f0f0f0;border-radius:4px;height:6px;overflow:hidden">' +
          '<div id="disb-upload-bar" style="width:0%;height:100%;background:#C8992A;transition:width .3s"></div>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:4px" id="disb-upload-msg">Uploading…</div>' +
          '</div>' +
          '<div id="disb-upload-result" style="margin-top:10px"></div>' +
          '</div>' +
          '</div>'
          : '') +

      '<div id="disb-hint" style="display:none;margin-bottom:12px"></div>' +

      '<div id="disb-dashboard" style="display:none">' +
      '<div id="disb-kpi-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">' +
      '<div class="card"><div class="card-header"><span class="card-title">By Segment</span></div><div id="disb-segment-table"></div></div>' +
      '<div class="card"><div class="card-header"><span class="card-title">By Channel</span></div><div id="disb-channel-table"></div></div>' +
      '</div>' +
      '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-header"><span class="card-title">By Loan Book</span><span style="font-size:10px;color:var(--muted)">HPA Status based</span></div>' +
      '<div id="disb-loanbook-cards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:4px 0"></div>' +
      '<div style="margin-top:12px"><div id="disb-loanbook-table"></div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">' +
      '<div class="card"><div class="card-header"><span class="card-title">Top Cities</span></div><div id="disb-city-table"></div></div>' +
      '<div class="card"><div class="card-header"><span class="card-title">Cancellation Summary</span></div><div id="disb-cancel-summary"></div></div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card-header"><span class="card-title">Daily Disbursal Trend</span></div>' +
      '<div class="chart-area"><canvas id="disb-trend-chart" height="120"></canvas></div>' +
      '</div>' +
      '</div>';

  // ================================================================
  //  WIRE EVENTS
  // ================================================================
  _loadAvailableMonths();

  document.getElementById('disb-load-btn')
      .addEventListener('click', _loadDashboard);

  document.getElementById('disb-export-btn')
      .addEventListener('click', _exportExcel);

  if (isAdmin) {
    document.getElementById('disb-upload-input')
        .addEventListener('change', function() {
          var files = Array.from(this.files || []);
          var el = document.getElementById('disb-file-list');
          if (el) {
            el.innerHTML = files.map(function(f) {
              return '<span style="margin-right:10px">📄 ' + f.name + '</span>';
            }).join('');
          }
        });

    document.getElementById('disb-upload-btn')
        .addEventListener('click', _uploadFile);
  }

  // ================================================================
  //  LOAD AVAILABLE MONTHS
  // ================================================================
  async function _loadAvailableMonths() {
    try {
      var res    = await API.Disbursal.getAvailableMonths();
      var months = (res && res.data) ? res.data : [];
      var status = document.getElementById('disb-db-status');
      var pills  = document.getElementById('disb-month-pills');

      if (!months.length) {
        if (status) status.textContent = isAdmin ? 'No data in DB — upload a file' : 'No data available';
        return;
      }
      if (status) status.textContent = months.length + ' month(s) in database';

      var MO = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var html = '';
      months.forEach(function(m) {
        var yr      = m.yr || m.YR;
        var mo      = m.mo || m.MO;
        var last    = new Date(yr, mo, 0).getDate();
        var from    = yr + '-' + String(mo).padStart(2,'0') + '-01';
        var to      = yr + '-' + String(mo).padStart(2,'0') + '-' + last;
        var label   = (MO[mo] || mo) + "'" + String(yr).slice(-2);
        html += '<button class="btn-o" style="font-size:11px;padding:4px 12px"'
            + ' data-from="' + from + '" data-to="' + to + '">' + label + '</button>';
      });
      pills.innerHTML = html;

      pills.querySelectorAll('[data-from]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          document.getElementById('disb-from').value = this.dataset.from;
          document.getElementById('disb-to').value   = this.dataset.to;
          pills.querySelectorAll('[data-from]').forEach(function(b) {
            b.style.background = ''; b.style.color = '';
          });
          this.style.background = '#0B1F3A';
          this.style.color = '#E8B84B';
        });
      });

      // Auto-select latest
      var first = pills.querySelector('[data-from]');
      if (first) first.click();

    } catch(e) {
      var s = document.getElementById('disb-db-status');
      if (s) s.textContent = 'Could not reach backend';
    }
  }

  // ================================================================
  //  LOAD DASHBOARD
  // ================================================================
  async function _loadDashboard() {
    var from = document.getElementById('disb-from').value;
    var to   = document.getElementById('disb-to').value;
    if (!from || !to) { _hint('danger', 'Please select a date range.'); return; }

    var btn = document.getElementById('disb-load-btn');
    btn.textContent = '⏳ Loading…'; btn.disabled = true;

    try {
      var res = await API.Disbursal.getDashboard(from, to);
      var d   = res.data;
      _renderDashboard(d, from, to);
      document.getElementById('disb-export-btn').style.display = 'inline-block';
      _hint('', '');
    } catch(e) {
      _hint('danger', e.message);
    } finally {
      btn.textContent = '📊 Load Dashboard'; btn.disabled = false;
    }
  }

  // ================================================================
  //  RENDER DASHBOARD
  // ================================================================
  function _renderDashboard(d, from, to) {
    document.getElementById('disb-dashboard').style.display = 'block';

    var inr = function(v) {
      return '₹' + Number(v || 0).toLocaleString('en-IN', {maximumFractionDigits:0});
    };

    // KPI Cards
    var avgVal = Number(d.avgLoanPerLead||0);
    var avgStr = avgVal >= 10000000 ? (avgVal/10000000).toFixed(2) + ' Cr'
        : avgVal >= 100000  ? (avgVal/100000).toFixed(2)   + ' L'
            : inr(avgVal);

    var kpis = [
      { label:'Net Loan Count',           value: Number(d.netLoanCount||0).toLocaleString(),  sub:'Active − Old Month Cancel',  accent:'accent-gold'  },
      { label:'Active Loans',             value: Number(d.activeLoans||0).toLocaleString(),   sub:'Disbursed in period',        accent:'accent-green' },
      { label:'Net Disbursal Amount',     value: inr(d.netDisbursalAmount),                   sub:'Active − Old Cancel',        accent:'accent-blue'  },
      { label:'LI Charges (Net)',         value: inr(d.liCharges),                            sub:'Active − Old Cancel',        accent:'accent-teal'  },
      { label:'MI Charges (Net)',         value: inr(d.miCharges),                            sub:'Active − Old Cancel',        accent:'accent-teal'  },
      { label:'Same Period Cancels',      value: Number(d.sameMonthCancellations||0).toLocaleString(), sub:'Disb & cancel in same period', accent:'accent-amber' },
      { label:'Old Month Cancels',        value: Number(d.oldMonthCancellations||0).toLocaleString(),  sub:'Cancel in period, disb before', accent:'accent-red' },
      { label:'Avg Loan / Lead',          value: avgStr,                                       sub:'Net Disbursal ÷ Net Loans',  accent:'accent-navy'  },
    ];
    var kpiHtml = '';
    kpis.forEach(function(k) {
      kpiHtml += '<div class="kpi-card ' + k.accent + '">'
          + '<div class="kpi-label">' + k.label + '</div>'
          + '<div class="kpi-value">' + k.value + '</div>'
          + '<div style="font-size:9px;opacity:.65;margin-top:3px">' + k.sub + '</div>'
          + '</div>';
    });
    document.getElementById('disb-kpi-grid').innerHTML = kpiHtml;

    // Breakdown table helper
    function makeTable(rows, col1, col2, col3) {
      if (!rows || !rows.length) return '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">No data</div>';
      var h = '<table class="data-table"><thead><tr>'
          + '<th>' + col1 + '</th>'
          + '<th style="text-align:right">' + col2 + '</th>'
          + '<th style="text-align:right">' + col3 + '</th>'
          + '</tr></thead><tbody>';
      rows.forEach(function(r) {
        h += '<tr>'
            + '<td>' + (r.key || r.KEY || '–') + '</td>'
            + '<td style="text-align:right">' + Number(r.count || r.COUNT || 0).toLocaleString() + '</td>'
            + '<td style="text-align:right">₹' + Number(r.amount || r.AMOUNT || 0).toLocaleString('en-IN', {maximumFractionDigits:0}) + '</td>'
            + '</tr>';
      });
      return h + '</tbody></table>';
    }

    var segEl = document.getElementById('disb-segment-table');
    var chEl  = document.getElementById('disb-channel-table');
    if (segEl) segEl.innerHTML = makeTable(d.bySegment, 'Segment', 'Loans', 'Net Amount');
    if (chEl)  chEl.innerHTML  = makeTable(d.byChannel, 'Channel', 'Loans', 'Net Amount');

    // Loan Book cards — CARS24, Bajaj Colending, PMax
    var lbCards = document.getElementById('disb-loanbook-cards');
    var lbTable = document.getElementById('disb-loanbook-table');
    if (lbCards && d.byLoanBook && d.byLoanBook.length) {
      var bookColors = { 'CARS24 Book':'#C8992A', 'Bajaj Colending':'#1E3F6B', 'PMax Book':'#1D6F42' };
      var totalLoans = d.byLoanBook.reduce(function(sum,b){ return sum + Number(b.count||b.COUNT||0); }, 0);
      var totalAmt   = d.byLoanBook.reduce(function(sum,b){ return sum + Number(b.amount||b.AMOUNT||0); }, 0);

      var lbHtml = '';
      d.byLoanBook.forEach(function(b) {
        var bname  = b.key   || b.KEY   || '';
        var bcount = Number(b.count  || b.COUNT  || 0);
        var bamt   = Number(b.amount || b.AMOUNT || 0);
        var bclr   = bookColors[bname] || '#0B1F3A';
        var pct    = totalLoans > 0 ? ((bcount / totalLoans) * 100).toFixed(1) : '0.0';
        var amtPct = totalAmt   > 0 ? ((bamt   / totalAmt)   * 100).toFixed(1) : '0.0';

        lbHtml += '<div style="border-radius:10px;padding:16px;background:#fff;'
            + 'border:1.5px solid rgba(11,31,58,0.08);border-top:3px solid ' + bclr + ';'
            + 'box-shadow:0 1px 4px rgba(0,0,0,0.04)">'
            + '<div style="font-size:11px;font-weight:600;color:' + bclr + ';margin-bottom:10px">' + bname + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
            + '<div>'
            + '<div style="font-size:18px;font-weight:600;color:#0B1F3A">' + bcount.toLocaleString() + '</div>'
            + '<div style="font-size:9px;color:var(--muted);margin-top:2px">Total Loans</div>'
            + '<div style="font-size:10px;font-weight:500;color:' + bclr + '">' + pct + '% of portfolio</div>'
            + '</div>'
            + '<div>'
            + '<div style="font-size:18px;font-weight:600;color:#0B1F3A">' + inr(bamt) + '</div>'
            + '<div style="font-size:9px;color:var(--muted);margin-top:2px">Net Amount</div>'
            + '<div style="font-size:10px;font-weight:500;color:' + bclr + '">' + amtPct + '% of total</div>'
            + '</div>'
            + '</div>'
            // Progress bar
            + '<div style="margin-top:10px;background:rgba(11,31,58,0.06);border-radius:4px;height:4px">'
            + '<div style="width:' + amtPct + '%;height:100%;background:' + bclr + ';border-radius:4px;transition:width .4s"></div>'
            + '</div>'
            + '</div>';
      });
      lbCards.innerHTML = lbHtml;
      if (lbTable) lbTable.innerHTML = makeTable(d.byLoanBook, 'Loan Book', 'Loans', 'Net Amount');
    }

    // Top 10 cities
    var cityEl = document.getElementById('disb-city-table');
    if (cityEl && d.topCities && d.topCities.length) {
      var top10   = d.topCities.slice(0, 10);
      var hasMore = d.topCities.length > 10;
      var ch = makeTable(top10, 'City', 'Loans', 'Net Amount');
      if (hasMore) {
        ch += '<div style="margin-top:8px;text-align:right">'
            + '<button id="disb-cities-export-btn" class="btn-o" style="font-size:11px;padding:4px 12px">'
            + '⬇ Export All ' + d.topCities.length + ' Cities</button></div>';
      }
      cityEl.innerHTML = ch;
      if (hasMore) {
        document.getElementById('disb-cities-export-btn')
            .addEventListener('click', function() { _exportCities(d.topCities); });
      }
    }

    // Cancellation summary
    var cEl = document.getElementById('disb-cancel-summary');
    if (cEl) {
      var items = [
        { label:'Same Month Cancellations', value: String(d.sameMonthCancellations || 0),  desc:'Disbursed & cancelled same period → 0 impact', color:'var(--amber)' },
        { label:'Old Month Cancellations',  value: String(d.oldMonthCancellations || 0),   desc:'Cancelled in period, disbursed earlier → –ve', color:'var(--red)'   },
        { label:'Amount Deducted (–)',       value: inr(d.cancelledAmount),                  desc:'Net deduction from old month cancellations',   color:'var(--red)'   },
      ];
      var cHtml = '<div style="display:flex;flex-direction:column;gap:10px;padding:8px 0">';
      items.forEach(function(r) {
        cHtml += '<div style="padding:10px 12px;border-radius:8px;background:rgba(11,31,58,0.04);border-left:3px solid ' + r.color + '">'
            + '<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
            + '<span style="font-size:12px;font-weight:500;color:var(--navy)">' + r.label + '</span>'
            + '<span style="font-size:14px;font-weight:600;color:' + r.color + '">' + r.value + '</span>'
            + '</div>'
            + '<div style="font-size:10px;color:var(--muted)">' + r.desc + '</div>'
            + '</div>';
      });
      cEl.innerHTML = cHtml + '</div>';
    }

    // Daily trend chart
    if (d.dailyTrend && d.dailyTrend.length && typeof Charts !== 'undefined') {
      setTimeout(function() {
        Charts.renderDisbursalTrend('disb-trend-chart', d.dailyTrend.map(function(t) {
          return { date: t.date || t.DATE || t.dt, amount: t.amount || t.AMOUNT || 0, count: t.count || t.COUNT || 0 };
        }));
      }, 80);
    }

    window._lastDisbResult = d;
  }

  // ================================================================
  //  EXPORT EXCEL
  // ================================================================
  function _exportExcel() {
    var from = document.getElementById('disb-from').value;
    var to   = document.getElementById('disb-to').value;
    if (!from || !to) { _hint('danger', 'Select a period first.'); return; }
    API.Disbursal.exportExcel(from, to);
  }

  // ================================================================
  //  EXPORT CITIES CSV
  // ================================================================
  function _exportCities(cities) {
    if (!cities || !cities.length) return;
    var rows = [['City','Loans','Net Amount (INR)']];
    cities.forEach(function(r) {
      rows.push([r.key || r.KEY || '', r.count || r.COUNT || 0, r.amount || r.AMOUNT || 0]);
    });
    var csv  = rows.map(function(r) { return r.join(','); }).join('\n');
    var blob = new Blob([csv], { type:'text/csv' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'Cities_Breakdown.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ================================================================
  //  UPLOAD FILE(S) — Admin only
  // ================================================================
  async function _uploadFile() {
    var files = Array.from(document.getElementById('disb-upload-input').files || []);
    if (!files.length) { _hint('danger', 'Please select at least one file.'); return; }

    var btn      = document.getElementById('disb-upload-btn');
    var progWrap = document.getElementById('disb-upload-progress');
    var progBar  = document.getElementById('disb-upload-bar');
    var progMsg  = document.getElementById('disb-upload-msg');
    var result   = document.getElementById('disb-upload-result');

    btn.disabled = true;
    progWrap.style.display = 'block';
    result.innerHTML = '';

    var results = [];

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      progBar.style.width = Math.round((i / files.length) * 85) + '%';
      progMsg.textContent = '[' + (i+1) + '/' + files.length + '] Processing ' + file.name + '…';
      btn.textContent     = '⏳ ' + (i+1) + '/' + files.length + ' uploading…';
      try {
        var res = await API.Disbursal.uploadReport(file);
        var d   = res && res.data ? res.data : {};
        results.push({ ok:true, name:file.name, d:d });
      } catch(e) {
        results.push({ ok:false, name:file.name, error:e.message });
      }
    }

    progBar.style.width = '100%';
    progMsg.textContent = 'Done! ' + files.length + ' file(s) processed.';
    btn.disabled = false;
    btn.textContent = '⬆ Upload Files';

    var rHtml = '';
    results.forEach(function(r) {
      if (r.ok) {
        rHtml += '<div style="background:#D9F0D9;border:1px solid #a0d9a0;border-radius:8px;padding:10px 12px;margin-bottom:6px">'
            + '<div style="font-size:12px;font-weight:600;color:#1D6F42;margin-bottom:6px">✅ ' + r.name + '</div>'
            + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:11px">'
            + '<div><strong>' + (r.d.totalRows || 0) + '</strong><br>Total</div>'
            + '<div><strong>' + (r.d.insertedRows || 0) + '</strong><br>Inserted</div>'
            + '<div><strong>' + (r.d.updatedRows || 0) + '</strong><br>Updated</div>'
            + '<div><strong>' + (r.d.cancelledRows || 0) + '</strong><br>Cancelled</div>'
            + '</div></div>';
      } else {
        rHtml += '<div style="background:#FFE0E0;border:1px solid #f5c6c6;border-radius:8px;padding:10px 12px;margin-bottom:6px;font-size:12px;color:#8B2121">'
            + '❌ ' + r.name + ' — ' + r.error + '</div>';
      }
    });
    result.innerHTML = rHtml;

    document.getElementById('disb-upload-input').value = '';
    var listEl = document.getElementById('disb-file-list');
    if (listEl) listEl.innerHTML = '';

    await _loadAvailableMonths();
  }

  // ================================================================
  //  HINT HELPER
  // ================================================================
  function _hint(type, msg) {
    var el = document.getElementById('disb-hint');
    if (!el) return;
    if (!type || !msg) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.className = type === 'danger' ? 'notice-danger' : 'notice';
    el.textContent = msg;
  }

});