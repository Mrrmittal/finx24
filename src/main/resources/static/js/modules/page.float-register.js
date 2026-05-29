/**
 * FinRecon Pro — Float Register Page
 * LI Float: Go Digit (8503595), Kotak (8503598) → GL 13126064
 * MI Float: 4 segments × multiple partners → GL 13126051
 */

Router.register('float-register', function(panel) {

  var currentTab    = 'LI';
  var liPartners    = {};  // fetched from backend
  var miSegments    = {};

  // ── LI Partners config (fallback if API not loaded) ─────────
  var LI_PARTNERS_DEFAULT = {
    'Go_Digit_LI': '8503595',
    'Kotak_LI':    '8503598',
  };
  var MI_SEGMENTS_DEFAULT = {
    'MI_GS':       ['Tata_AIG_MI_GS','ICICI_Lombard_MI_GS','Kotak_MI_GS','United_MI_GS','Go_Digit_MI_GS'],
    'MI_INSURE24': ['Tata_INSURE24','ICICI_Lombard_INSURE24','Kotak_INSURE24','Go_Digit_INSURE24','Bajaj_INSURE24'],
    'MI_DO':       ['Go_Digit_DO'],
    'EW':          ['Bajaj_EW'],
  };

  panel.innerHTML =

      '<div class="module-hero">' +
      '<div>' +
      '<div class="hero-label">Monthly Schedules</div>' +
      '<div class="hero-title">Float Register</div>' +
      '<div class="hero-sub">Loan Insurance Float · Motor Insurance Float · Period-wise ledger</div>' +
      '</div>' +
      '</div>' +

      // Tab bar
      '<div style="display:flex;gap:0;margin-bottom:16px;border-radius:8px;' +
      'overflow:hidden;border:1.5px solid rgba(11,31,58,0.15);width:fit-content">' +
      '<button id="tab-li" style="padding:9px 28px;font-size:13px;font-weight:600;' +
      'cursor:pointer;background:#0B1F3A;color:#E8B84B;border:none">' +
      '🛡️ LI Float</button>' +
      '<button id="tab-mi" style="padding:9px 28px;font-size:13px;font-weight:600;' +
      'cursor:pointer;background:#fff;color:#0B1F3A;border:none">' +
      '🚗 MI Float</button>' +
      '</div>' +

      // Upload card
      '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-header">' +
      '<span class="card-title" id="fl-upload-title">Upload LI Float</span>' +
      '<span style="font-size:10px;color:var(--muted)">Overwrites existing data for partner + period</span>' +
      '</div>' +
      '<div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">' +
      '<div>' +
      '<div class="field-label">Partner / Book</div>' +
      '<select id="fl-partner" class="form-input" style="width:200px"></select>' +
      '</div>' +
      '<div style="display:flex;gap:10px">' +
      '<div><div class="field-label">Period From</div>' +
      '<input type="month" class="form-input" id="fl-period-from" style="width:140px"></div>' +
      '<div><div class="field-label">To (optional)</div>' +
      '<input type="month" class="form-input" id="fl-period-to" style="width:140px"></div></div>' +
      '<div>' +
      '<div class="field-label">Float File</div>' +
      '<input type="file" id="fl-file" accept=".xlsx,.xls"' +
      ' style="font-size:12px;color:var(--navy)">' +
      '</div>' +
      '<button class="btn-g" id="fl-upload-btn" style="padding:9px 22px">⬆ Upload</button>' +
      '</div>' +
      '<div id="fl-upload-result" style="margin-top:10px"></div>' +
      '</div>' +

      // Dashboard KPIs
      '<div id="fl-dashboard" style="display:none;margin-bottom:16px">' +
      '<div class="card-header" style="margin-bottom:12px">' +
      '<span class="card-title" id="fl-dash-title">Float Dashboard</span>' +
      '<span id="fl-dash-period" style="font-size:11px;color:var(--muted)"></span>' +
      '</div>' +
      '<div id="fl-kpi-cards"' +
      ' style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">' +
      '</div>' +
      '<div id="fl-partner-table-wrap">' +
      '<div class="card">' +
      '<div class="card-header"><span class="card-title">By Partner</span></div>' +
      '<div id="fl-partner-table"></div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Register table
      '<div class="card">' +
      '<div class="card-header">' +
      '<span class="card-title" id="fl-register-title">Float Register</span>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<select id="fl-period-select" class="form-input"' +
      ' style="width:160px;font-size:11px;padding:4px 8px">' +
      '<option value="">All Periods</option>' +
      '</select>' +
      '<select id="fl-partner-select" class="form-input"' +
      ' style="width:180px;font-size:11px;padding:4px 8px">' +
      '<option value="">All Partners</option>' +
      '</select>' +
      '<button class="btn-g" id="fl-load-btn"' +
      ' style="font-size:11px;padding:5px 16px">Load</button>' +
      '<button class="btn-o" id="fl-export-btn"' +
      ' style="font-size:11px;padding:5px 16px;display:none">⬇ CSV</button>' +
      '</div>' +
      '</div>' +
      '<div id="fl-table-wrap"' +
      ' style="overflow-x:auto;max-height:520px;overflow-y:auto">' +
      '<div style="padding:32px;text-align:center;color:var(--muted);font-size:12px">' +
      'Select period/partner and click Load' +
      '</div>' +
      '</div>' +
      '</div>';

  // ── Wire tabs ────────────────────────────────────────────────
  document.getElementById('tab-li').addEventListener('click', function() { _switchTab('LI'); });
  document.getElementById('tab-mi').addEventListener('click', function() { _switchTab('MI'); });
  document.getElementById('fl-upload-btn').addEventListener('click', _upload);
  document.getElementById('fl-load-btn').addEventListener('click', _loadRegister);
  document.getElementById('fl-export-btn').addEventListener('click', _exportCsv);

  // Init
  _switchTab('LI');

  // ================================================================
  function _switchTab(tab) {
    currentTab = tab;
    // Tab styles
    document.getElementById('tab-li').style.background = tab==='LI' ? '#0B1F3A' : '#fff';
    document.getElementById('tab-li').style.color      = tab==='LI' ? '#E8B84B' : '#0B1F3A';
    document.getElementById('tab-mi').style.background = tab==='MI' ? '#0B1F3A' : '#fff';
    document.getElementById('tab-mi').style.color      = tab==='MI' ? '#E8B84B' : '#0B1F3A';
    // Labels
    document.getElementById('fl-upload-title').textContent =
        tab==='LI' ? 'Upload LI Float (Go Digit / Kotak)' : 'Upload MI Float';
    document.getElementById('fl-register-title').textContent =
        tab==='LI' ? 'LI Float Register' : 'MI Float Register';
    document.getElementById('fl-dash-title').textContent =
        tab==='LI' ? 'LI Float Dashboard (GL 13126064)' : 'MI Float Dashboard (GL 13126051)';
    _loadPartners();
    _loadPeriods();
  }

  // ================================================================
  async function _loadPartners() {
    try {
      var res = await API.Float.getPartners(currentTab);
      var d   = res && res.data ? res.data : {};
      var sel = document.getElementById('fl-partner');
      var sel2= document.getElementById('fl-partner-select');

      if (currentTab === 'LI') {
        // Backend returns partners as [{code, display, gl}] or fallback to string keys
        var partners = d.partners || [];
        var opts = '';
        if (partners.length && typeof partners[0] === 'object') {
          // New format: [{code, display, gl}]
          opts = partners.map(function(p) {
            return '<option value="'+p.code+'">'+p.display+' (GL: '+p.gl+')</option>';
          }).join('');
        } else {
          // Fallback: string array
          var glMap = d.glMap || LI_PARTNERS_DEFAULT;
          opts = Object.keys(LI_PARTNERS_DEFAULT).map(function(k) {
            return '<option value="'+k+'">'+k+' (GL: '+(glMap[k]||'–')+')</option>';
          }).join('');
        }
        sel.innerHTML  = opts;
        sel2.innerHTML = '<option value="">All Partners</option>' + opts;

      } else {
        // MI: segments is {MI_GS: [{code, display, gl}], ...}
        var segments = d.segments || MI_SEGMENTS_DEFAULT;
        var opts2 = '';
        for (var seg in segments) {
          var pList = segments[seg] || [];
          pList.forEach(function(p) {
            if (typeof p === 'object') {
              opts2 += '<option value="'+p.code+'">['+seg+'] '+p.display+' (GL: '+p.gl+')</option>';
            } else {
              // Fallback: p is a string (partner code)
              opts2 += '<option value="'+p+'">['+seg+'] '+p+'</option>';
            }
          });
        }
        sel.innerHTML  = opts2;
        sel2.innerHTML = '<option value="">All Partners</option>' + opts2;
      }
    } catch(e) {
      console.warn('[Float] partners:', e.message);
    }
  }

  // ================================================================
  async function _loadPeriods() {
    try {
      var res     = await API.Float.getPeriods(currentTab);
      var periods = (res && res.data) ? res.data : [];
      var sel     = document.getElementById('fl-period-select');
      sel.innerHTML = '<option value="">All Periods</option>'
          + periods.map(function(p) {
            return '<option value="'+p+'">'+p+'</option>';
          }).join('');
      if (periods.length) sel.value = periods[periods.length-1];
    } catch(e) { console.warn('[Float] periods:', e.message); }
  }

  // ================================================================
  async function _upload() {
    var partner = document.getElementById('fl-partner').value;
    // Build period label from month pickers
    var fromM = document.getElementById('fl-period-from').value;
    var toM   = document.getElementById('fl-period-to').value;
    var period = '';
    if (fromM) {
      var MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var fd = new Date(fromM + '-01');
      var fLbl = MO[fd.getMonth()] + "'" + String(fd.getFullYear()).slice(-2);
      if (toM && toM !== fromM) {
        var td2 = new Date(toM + '-01');
        period = fLbl + ' - ' + MO[td2.getMonth()] + "'" + String(td2.getFullYear()).slice(-2);
      } else { period = fLbl; }
    }
    var file    = document.getElementById('fl-file').files[0];
    var res     = document.getElementById('fl-upload-result');

    if (!partner) { res.innerHTML = _alert('warn','Select a partner.'); return; }
    if (!period)  { res.innerHTML = _alert('warn',"Enter period label e.g. Apr'26"); return; }
    if (!file)    { res.innerHTML = _alert('warn','Select a float file.'); return; }

    var btn = document.getElementById('fl-upload-btn');
    btn.disabled = true; btn.textContent = '⏳ Uploading…';

    try {
      var r = await API.Float.upload(file, currentTab, partner, period);
      var d = r && r.data ? r.data : {};
      res.innerHTML = _alert('success',
          '✅ '+d.inserted+' rows uploaded for <strong>'+partner+'</strong>' +
          ' | Period: '+period+' | GL: '+d.glAccount);
      document.getElementById('fl-file').value = '';
      await _loadPeriods();
      await _loadDashboard(period);
    } catch(e) {
      res.innerHTML = _alert('error','❌ '+e.message);
    } finally {
      btn.disabled = false; btn.textContent = '⬆ Upload';
    }
  }

  // ================================================================
  async function _loadDashboard(monthFilter) {
    var selMonth = monthFilter || document.getElementById('fl-period-select').value;
    var partner  = document.getElementById('fl-partner-select').value ||
        (document.getElementById('fl-partner') &&
            document.getElementById('fl-partner').value) || '';
    if (!partner) return;

    try {
      var res = await API.Float.getDashboard(partner, selMonth || null);
      var d   = res && res.data ? res.data : {};
      var dash = document.getElementById('fl-dashboard');
      if (dash) dash.style.display = 'block';

      var gl      = d.glAccount  || '';
      var parentGl= d.parentGl   || '';
      var summary = d.summary    || [];

      var periodEl = document.getElementById('fl-dash-period');
      if (periodEl) periodEl.textContent =
          partner + (gl ? '  ·  GL: '+gl : '') +
          (selMonth ? '  ·  ' + selMonth : '  ·  All Months');

      var inr = function(v) {
        var n = Number(v||0);
        var sign = n < 0 ? '-' : '';
        return sign + '₹' + Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:0});
      };

      // KPI cards from latest month in summary
      var latest  = summary.length ? summary[summary.length-1] : {};
      var totCr   = summary.reduce(function(s,r){ return s+Number(r.totalCredit||0); }, 0);
      var totDr   = summary.reduce(function(s,r){ return s+Number(r.totalDebit||0); }, 0);
      var closBal = Number(latest.closingBal || 0);

      var grid = document.getElementById('fl-kpi-cards');
      if (grid) {
        var kpis = [
          { label:'GL Account',       value: gl,           sub:'Parent GL: '+parentGl, clr:'#0B1F3A' },
          { label:'Total Credit',     value: inr(totCr),   sub:'All months total',     clr:'#1D6F42' },
          { label:'Total Debit',      value: inr(totDr),   sub:'All months total',     clr:'#1E3F6B' },
          { label:'Closing Balance',  value: inr(closBal), sub:'Latest month balance', clr: closBal < 0 ? '#8B2121' : '#C8992A' },
        ];
        grid.innerHTML = kpis.map(function(k) {
          return '<div style="background:#fff;border-radius:10px;padding:14px;'
              + 'border:1.5px solid rgba(11,31,58,0.08);border-top:3px solid '+k.clr+';'
              + 'box-shadow:0 1px 4px rgba(0,0,0,0.04)">'
              + '<div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;'
              +   'color:#5A6E88;margin-bottom:5px">'+k.label+'</div>'
              + '<div style="font-size:18px;font-weight:600;color:#0B1F3A">'+k.value+'</div>'
              + '<div style="font-size:9px;color:#9AA5B4;margin-top:3px">'+k.sub+'</div>'
              + '</div>';
        }).join('');
      }

      // Month-wise summary table
      var ptEl = document.getElementById('fl-partner-table');
      if (ptEl && summary.length) {
        var tbl = '<table class="data-table"><thead><tr>'
            + '<th>Month</th>'
            + '<th style="text-align:right">Total Credit</th>'
            + '<th style="text-align:right">Total Debit</th>'
            + '<th style="text-align:right">Closing Balance</th>'
            + '</tr></thead><tbody>';
        summary.forEach(function(r) {
          var bal = Number(r.closingBal||0);
          tbl += '<tr>'
              + '<td style="font-weight:500">'+r.monthLabel+'</td>'
              + '<td style="text-align:right;color:#1D6F42">'+inr(r.totalCredit)+'</td>'
              + '<td style="text-align:right;color:#1E3F6B">'+inr(r.totalDebit)+'</td>'
              + '<td style="text-align:right;font-weight:600;color:'+(bal<0?'#8B2121':'#0B1F3A')+'">'+inr(bal)+'</td>'
              + '</tr>';
        });
        ptEl.innerHTML = tbl + '</tbody></table>';
      }
    } catch(e) {
      console.warn('[Float] dashboard error:', e.message);
    }
  }

  // ================================================================
  var _lastRows = [];

  async function _loadRegister() {
    var period  = document.getElementById('fl-period-select').value;
    var partner = document.getElementById('fl-partner-select').value;
    var wrap    = document.getElementById('fl-table-wrap');
    wrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">Loading…</div>';

    try {
      var res  = await API.Float.getRegister(currentTab, partner, period);
      _lastRows = (res && res.data) ? res.data : [];

      if (!_lastRows.length) {
        wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:12px">No data</div>';
        return;
      }

      var inr = function(v) {
        return v != null ? '₹'+Number(v).toLocaleString('en-IN',{maximumFractionDigits:2}) : '';
      };

      var headers = ['Period','Partner','GL','Months','Float Type','Acct Mgr',
        'IMD Code','Trans Date','Booking Type','Details',
        'Credit','Debit','Expense','Balance','Policy No'];
      var keys    = ['periodLabel','partnerCode','glAccount','monthsCol','floatType',
        'accountManager','imdCode','transDate','bookingType','transactionDetails',
        'creditAmt','debitAmt','expense','balance','policyNumber'];
      var numKeys = new Set(['creditAmt','debitAmt','expense','balance']);

      var tbl = '<table class="data-table" style="min-width:1400px;font-size:11px">'
          + '<thead><tr>'
          + headers.map(function(h){ return '<th style="white-space:nowrap">'+h+'</th>'; }).join('')
          + '</tr></thead><tbody>';

      _lastRows.forEach(function(r) {
        tbl += '<tr>';
        keys.forEach(function(k) {
          var v = r[k];
          if (numKeys.has(k)) {
            var color = k==='expense' ? 'color:#8B2121' :
                k==='creditAmt' ? 'color:#1D6F42' :
                    k==='debitAmt'  ? 'color:#1E3F6B' : '';
            tbl += '<td style="text-align:right;white-space:nowrap;'+color+'">'
                + (v!=null ? inr(v) : '') + '</td>';
          } else {
            tbl += '<td style="white-space:nowrap">'+(v||'')+'</td>';
          }
        });
        tbl += '</tr>';
      });

      wrap.innerHTML = tbl + '</tbody></table>';
      document.getElementById('fl-export-btn').style.display = 'inline-block';

      // Load dashboard for selected period
      if (period) await _loadDashboard(period);

    } catch(e) {
      wrap.innerHTML = _alert('error','❌ '+e.message);
    }
  }

  // ================================================================
  function _exportCsv() {
    if (!_lastRows.length) return;
    var keys = ['periodLabel','partnerCode','glAccount','monthsCol','floatType',
      'accountManager','imdCode','transDate','bookingType','transactionDetails',
      'creditAmt','debitAmt','expense','balance','policyNumber'];
    var csv = [keys.join(',')]
        .concat(_lastRows.map(function(r) {
          return keys.map(function(k) {
            var v = r[k] != null ? String(r[k]) : '';
            return v.includes(',') ? '"'+v+'"' : v;
          }).join(',');
        })).join('\n');
    var blob = new Blob([csv], {type:'text/csv'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url;
    a.download = currentTab + '_Float_Register.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function _alert(type, msg) {
    var c = {
      success:{bg:'#D9F0D9',br:'#a0d9a0',tx:'#1D6F42'},
      error:  {bg:'#FFE0E0',br:'#f5c6c6',tx:'#8B2121'},
      warn:   {bg:'#FFF3CD',br:'#F0C040',tx:'#8A6010'},
    }[type] || {bg:'#FFF3CD',br:'#F0C040',tx:'#8A6010'};
    return '<div style="background:'+c.bg+';border:1px solid '+c.br+';'
        + 'border-radius:8px;padding:10px 14px;font-size:12px;color:'+c.tx+'">'
        + msg + '</div>';
  }

});