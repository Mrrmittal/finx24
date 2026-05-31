/**
 * FINX24 — Pocket Insurance Schedule
 * Pricing: ₹2,360 (incl GST 18%) | Base: ₹2,000 | Assurekit: ₹450 | Net: ₹1,550
 * GL: 13126048 Dr (Accrual) / 31120427 Cr (Commission Income)
 * @author  Jatin Mittal
 * @contact jatin.mittal@cars24.com | +91-8221944248
 * @company CARS24 Financial Services Pvt. Ltd. (CFSPL)
 */
Router.register('pocket-ins-schedule', function(panel) {

  panel.innerHTML = `

    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
      <span onclick="Router.go('schedules')"
            style="font-size:12px;color:var(--muted);cursor:pointer;text-decoration:underline">
        Monthly Schedules
      </span>
      <span style="color:var(--muted)">›</span>
      <span style="font-size:12px;font-weight:500;color:var(--navy)">
        Pocket Insurance Schedule
      </span>
    </div>

    <!-- Hero -->
    <div style="background:linear-gradient(120deg,#0B1F3A,#1E3F6B);border-radius:12px;
                padding:22px 28px;margin-bottom:20px;display:flex;
                align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;
                    color:rgba(255,255,255,0.45);margin-bottom:4px">Monthly Schedule</div>
        <div style="font-size:20px;font-weight:500;color:#fff">
          🏥 Pocket Insurance — Assurekit
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">
          3-sheet Excel: Accrual Entry · Active Cases · Sub Cancellation
        </div>
      </div>
      <span style="font-size:10px;padding:4px 14px;border-radius:20px;
                   background:rgba(200,153,42,0.25);color:#E8B84B;font-weight:600">
        ADMIN + USER
      </span>
    </div>

    <!-- Form Card -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span class="card-title">Schedule Parameters</span>
      </div>

      <div>
        <div style="font-size:11px;font-weight:600;color:var(--muted);
                    text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">
          Select Period
        </div>
        <div id="pi-month-pills"
             style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          <span style="font-size:11px;color:var(--muted)">Loading months…</span>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div>
            <div class="field-label">From</div>
            <input type="date" class="form-input" id="pi-from" style="width:145px">
          </div>
          <div>
            <div class="field-label">To</div>
            <input type="date" class="form-input" id="pi-to" style="width:145px">
          </div>
          <div>
            <div class="field-label">Month Label</div>
            <input type="text" class="form-input" id="pi-label"
                   placeholder="Apr'26" style="width:85px">
          </div>
        </div>
      </div>

      <div style="margin-top:20px;display:flex;gap:12px">
        <button class="btn-g" id="pi-generate-btn"
                style="padding:11px 32px;font-size:14px">
          📋 Generate PI Schedule
        </button>
        <button class="btn-o" id="pi-export-btn"
                style="padding:11px 28px;font-size:14px;display:none">
          ⬇ Export Schedule
        </button>
      </div>

      <!-- Progress -->
      <div id="pi-progress" style="display:none;margin-top:12px">
        <div style="background:#f0f0f0;border-radius:6px;height:6px;overflow:hidden">
          <div id="pi-progress-bar"
               style="width:0%;height:100%;background:#C8992A;transition:width .4s">
          </div>
        </div>
        <div id="pi-progress-msg"
             style="font-size:11px;color:var(--muted);margin-top:6px">
          Generating…
        </div>
      </div>
      <div id="pi-result" style="margin-top:10px"></div>
    </div>

    <!-- Dashboard (shown after generate) -->
    <div id="pi-dashboard" style="display:none">

      <div style="display:flex;align-items:center;justify-content:space-between;
                  margin-bottom:16px">
        <div>
          <div style="font-size:16px;font-weight:600;color:#0B1F3A">
            📊 Pocket Insurance Dashboard
          </div>
          <div id="pi-dash-period"
               style="font-size:11px;color:var(--muted);margin-top:2px">
          </div>
        </div>
        <span style="font-size:10px;padding:4px 12px;border-radius:20px;
                     background:rgba(29,111,66,0.12);color:#1D6F42;font-weight:600">
          ✓ SCHEDULE GENERATED
        </span>
      </div>

      <!-- KPI Cards (5) -->
      <div id="pi-kpi-grid"
           style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;
                  margin-bottom:16px">
      </div>

      <!-- Accrual + Channel -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div class="card">
          <div class="card-header">
            <span class="card-title">📒 Accrual Summary</span>
          </div>
          <div id="pi-accrual-summary"></div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">📡 By Channel</span>
          </div>
          <div id="pi-channel-table"></div>
        </div>
      </div>

    </div>
  `;

  // Wire
  _loadMonths();
  document.getElementById('pi-generate-btn').addEventListener('click', _generate);
  document.getElementById('pi-export-btn').addEventListener('click', _export);

  var _lastParams = null;
  var _lastBlob   = null;

  // ================================================================
  async function _loadMonths() {
    try {
      var res    = await API.Disbursal.getAvailableMonths();
      var months = (res && res.data) ? res.data : [];
      var pills  = document.getElementById('pi-month-pills');
      if (!pills || !months.length) return;
      var MO = ['','Jan','Feb','Mar','Apr','May','Jun',
        'Jul','Aug','Sep','Oct','Nov','Dec'];
      pills.innerHTML = months.map(function(m) {
        var yr   = m.yr || m.YR;
        var mo   = m.mo || m.MO;
        var last = new Date(yr, mo, 0).getDate();
        var from = yr + '-' + String(mo).padStart(2,'0') + '-01';
        var to   = yr + '-' + String(mo).padStart(2,'0') + '-' + last;
        var lbl  = (MO[mo] || mo) + "'" + String(yr).slice(-2);
        return '<button class="btn-o pill-btn" data-from="' + from +
            '" data-to="' + to + '" data-label="' + lbl +
            '" style="font-size:11px;padding:4px 12px">' + lbl + '</button>';
      }).join('');

      pills.querySelectorAll('.pill-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          pills.querySelectorAll('.pill-btn').forEach(function(b) {
            b.style.background=''; b.style.color=''; b.style.borderColor='';
          });
          this.style.background  = '#0B1F3A';
          this.style.color       = '#E8B84B';
          this.style.borderColor = '#0B1F3A';
          document.getElementById('pi-from').value  = this.dataset.from;
          document.getElementById('pi-to').value    = this.dataset.to;
          document.getElementById('pi-label').value = this.dataset.label;
        });
      });
      var last = pills.querySelectorAll('.pill-btn');
      if (last.length) last[last.length-1].click();
    } catch(e) { console.warn('[PI] months:', e.message); }
  }

  // ================================================================
  async function _generate() {
    var from  = document.getElementById('pi-from').value;
    var to    = document.getElementById('pi-to').value;
    var label = (document.getElementById('pi-label').value || '').trim();

    if (!from || !to) { _msg('warn', 'Please select period dates.'); return; }
    if (!label)       { _msg('warn', "Enter month label e.g. Apr'26."); return; }

    var btn  = document.getElementById('pi-generate-btn');
    var prog = document.getElementById('pi-progress');
    var bar  = document.getElementById('pi-progress-bar');
    var msg  = document.getElementById('pi-progress-msg');

    btn.disabled = true; btn.textContent = '⏳ Generating…';
    prog.style.display = 'block';
    bar.style.width = '20%'; msg.textContent = 'Fetching pocket insurance data from database…';

    try {
      var token = API.getToken();
      var base  = (window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')
          ? 'http://localhost:8080/api' : window.location.origin+'/api';

      bar.style.width = '50%'; msg.textContent = 'Calculating accrual and cancellations…';

      // POST to generate endpoint — returns Excel file
      var form = new FormData();
      form.append('from',       from);
      form.append('to',         to);
      form.append('monthLabel', label);

      var res = await fetch(base + '/schedules/pocket-insurance/generate',
          { method:'POST', body:form,
            headers: token ? {'Authorization':'Bearer '+token} : {} });

      bar.style.width = '85%'; msg.textContent = 'Building Excel in background…';

      if (!res.ok) {
        var err = await res.json().catch(function(){ return {}; });
        throw new Error(err.message || 'Server error ('+res.status+')');
      }

      var blob = await res.blob();
      // Store blob for export (don't auto-download)
      _lastBlob  = blob;
      _lastParams = {from, to, label, token, base};
      document.getElementById('pi-export-btn').style.display = 'inline-block';

      bar.style.width = '100%'; msg.textContent = 'Done!';
      _msg('success',
          '✅ Dashboard ready — <strong>'+label+'</strong> · '+from+' → '+to
          + ' &nbsp;·&nbsp; Click <strong>Export Schedule</strong> to download Excel.');

      await _loadDashboard(from, to, label, token, base);

    } catch(e) {
      bar.style.width = '0%';
      _msg('error', '❌ '+e.message);
    } finally {
      btn.disabled = false; btn.textContent = '📋 Generate PI Schedule';
    }
  }

  // ── Re-export (same data) ─────────────────────────────────────
  function _export() {
    if (!_lastBlob || !_lastParams) {
      _msg('warn', '⚠️ Generate the schedule first, then export.');
      return;
    }
    var url = URL.createObjectURL(_lastBlob);
    var a   = document.createElement('a');
    a.href  = url;
    a.download = 'Pocket_Insurance_Schedule_'
        + _lastParams.label.replace("'","_") + '.xlsx';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ================================================================
  async function _loadDashboard(from, to, label, token, base) {
    try {
      // Fetch preview data from backend
      var q = 'from='+from+'&to='+to+'&monthLabel='+encodeURIComponent(label);
      var previewRes = await fetch(base + '/schedules/pocket-insurance/preview?' + q,
          { headers: token ? {'Authorization':'Bearer '+token} : {} });
      var d = await previewRes.json();
      d = d.data || d;

      var dash = document.getElementById('pi-dashboard');
      if (dash) dash.style.display = 'block';

      var periodEl = document.getElementById('pi-dash-period');
      if (periodEl) periodEl.textContent = label + '  ·  ' + from + ' → ' + to;

      var inr = function(v) {
        return '₹' + Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      };

      var activeCount = Number(d.activeCount || 0);
      var cancelCount = Number(d.cancelCount || 0);
      var activeComm  = activeCount * 1550;
      var cancelComm  = cancelCount * 1550;
      var netAccrual  = activeComm - cancelComm;
      var activePocket = activeCount * 2360;
      var cancelPocket = cancelCount * 2360;

      // ── KPI Cards ──────────────────────────────────────────────
      // PI Collection = sum of POCKET_INSURANCE_CHARGE on active cases (2360 each)
      var piCollection = activeCount * 2360;
      // PI Cancellation = sum of POCKET_INSURANCE_CHARGE for old month cancellations
      var piCancel     = cancelCount * 2360;
      // Lead Commission % = 1550 / 2360 × 100
      var leadCommPct  = ((1550 / 2360) * 100).toFixed(2) + '%';

      var kpis = [
        { label:'Active PI Cases',         value: activeCount.toLocaleString(),
          sub:'POCKET_INSURANCE_CHARGE > 0',       clr:'#1D6F42' },
        { label:'PI Collection',           value: inr(piCollection),
          sub:'Active Cases × ₹2,360',             clr:'#1D6F42' },
        { label:'PI Cancellation',         value: inr(piCancel),
          sub:'Old Month Cancel × ₹2,360',         clr:'#8B2121' },
        { label:'Net Accrual Commission',  value: inr(netAccrual),
          sub:'(Active − Cancel) × ₹1,550',        clr: netAccrual<0?'#8B2121':'#C8992A' },
        { label:'Lead Commission %',       value: leadCommPct,
          sub:'₹1,550 ÷ ₹2,360 × 100',            clr:'#5A2D82' },
        { label:'Sub-Cancel Cases',        value: cancelCount.toLocaleString(),
          sub:'Prev month cancellations reversed', clr:'#8B2121' },
        { label:'Top-Up Commission',       value: inr(activeComm),
          sub:'Active × ₹1,550 net',               clr:'#1E3F6B' },
        { label:'Cancel Commission',       value: inr(cancelComm),
          sub:'Cancel × ₹1,550 (reversed)',        clr:'#8B2121' },
      ];

      var grid = document.getElementById('pi-kpi-grid');
      if (grid) {
        grid.innerHTML = kpis.map(function(k) {
          return '<div style="background:#fff;border-radius:8px;padding:12px 14px;'
              + 'border:1.5px solid rgba(11,31,58,0.08);'
              + 'border-top:2px solid '+k.clr+';'
              + 'box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
              + '<div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.7px;'
              +   'color:#5A6E88;margin-bottom:4px">'+k.label+'</div>'
              + '<div style="font-size:16px;font-weight:600;color:#0B1F3A">'+k.value+'</div>'
              + '<div style="font-size:8.5px;color:#9AA5B4;margin-top:3px">'+k.sub+'</div>'
              + '</div>';
        }).join('');
      }

      // ── Accrual Summary ────────────────────────────────────────
      var accEl = document.getElementById('pi-accrual-summary');
      if (accEl) {
        var rows = [
          { name:'Accrued — Active Cases',
            count: activeCount, comm: inr(activeComm), clr:'#1D6F42' },
          { name:'Subsequent Cancellation (Reversal)',
            count: cancelCount, comm: inr(cancelComm), clr:'#8B2121' },
          { name:'Net Commission',
            count: activeCount - cancelCount,
            comm: inr(netAccrual), clr:'#C8992A' },
        ];
        var tbl = '<table class="data-table"><thead><tr>'
            + '<th>Particulars</th><th style="text-align:right">Cases</th>'
            + '<th style="text-align:right">Commission</th>'
            + '</tr></thead><tbody>';
        rows.forEach(function(r) {
          tbl += '<tr>'
              + '<td style="font-weight:500;color:'+r.clr+'">'+r.name+'</td>'
              + '<td style="text-align:right">'+Number(r.count).toLocaleString()+'</td>'
              + '<td style="text-align:right;font-weight:600;color:'+r.clr+'">'+r.comm+'</td>'
              + '</tr>';
        });
        tbl += '</tbody></table>'
            // GL Entry box
            + '<div style="margin-top:10px;padding:10px;background:rgba(11,31,58,0.04);'
            + 'border-radius:8px;font-size:11px">'
            + '<div style="font-weight:600;color:#0B1F3A;margin-bottom:5px">GL Entry</div>'
            + '<div style="display:flex;justify-content:space-between;padding:2px 0">'
            + '<span>DR 13126048 — Accrual Pocket Insurance</span>'
            + '<span style="font-weight:600">'+inr(netAccrual)+'</span></div>'
            + '<div style="display:flex;justify-content:space-between;padding:2px 0;'
            + 'border-top:1px solid rgba(11,31,58,0.08)">'
            + '<span>CR 31120427 — Insurance Commission GL</span>'
            + '<span style="font-weight:600">'+inr(netAccrual)+'</span></div>'
            + '</div>';
        accEl.innerHTML = tbl;
      }

      // ── Channel Table ──────────────────────────────────────────
      var chEl = document.getElementById('pi-channel-table');
      if (chEl && d.byChannel) {
        var chHtml = '<table class="data-table"><thead><tr>'
            + '<th>Channel</th>'
            + '<th style="text-align:right">Active</th>'
            + '<th style="text-align:right">Commission</th>'
            + '<th style="text-align:right">Cancel</th>'
            + '<th style="text-align:right">Net</th>'
            + '</tr></thead><tbody>';
        Object.entries(d.byChannel).forEach(function(entry) {
          var ch = entry[0], v = entry[1];
          var act = v.active||0, can = v.cancel||0;
          var net = (act - can) * 1550;
          chHtml += '<tr>'
              + '<td style="font-weight:500">'+ch+'</td>'
              + '<td style="text-align:right">'+act+'</td>'
              + '<td style="text-align:right;color:#1D6F42">'+inr(act*1550)+'</td>'
              + '<td style="text-align:right;color:#8B2121">'+can+'</td>'
              + '<td style="text-align:right;font-weight:600;color:'+(net<0?'#8B2121':'#0B1F3A')+'">'+inr(net)+'</td>'
              + '</tr>';
        });
        chEl.innerHTML = chHtml + '</tbody></table>';
      }

      setTimeout(function() {
        document.getElementById('pi-dashboard').scrollIntoView({behavior:'smooth'});
      }, 150);

    } catch(e) {
      console.warn('[PI] dashboard failed:', e.message);
    }
  }

  function _msg(type, html) {
    var el = document.getElementById('pi-result');
    if (!el) return;
    var c = {
      success:{bg:'#D9F0D9',br:'#a0d9a0',tx:'#1D6F42'},
      error:  {bg:'#FFE0E0',br:'#f5c6c6',tx:'#8B2121'},
      warn:   {bg:'#FFF3CD',br:'#F0C040',tx:'#8A6010'},
    }[type] || {bg:'#FFF3CD',br:'#F0C040',tx:'#8A6010'};
    el.innerHTML = '<div style="background:'+c.bg+';border:1px solid '+c.br+';'
        + 'border-radius:8px;padding:10px 14px;font-size:12px;color:'+c.tx+'">'
        + html + '</div>';
  }

});