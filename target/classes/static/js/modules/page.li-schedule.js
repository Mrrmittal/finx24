/**
 * FinRecon Pro — Loan Insurance Schedule Page
 */

Router.register('li-schedule', function(panel) {

    panel.innerHTML = `

    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
      <span onclick="Router.go('schedules')"
            style="font-size:12px;color:var(--muted);cursor:pointer;text-decoration:underline">
        Monthly Schedules
      </span>
      <span style="color:var(--muted)">›</span>
      <span style="font-size:12px;font-weight:500;color:var(--navy)">
        Loan Insurance Schedule
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
          🛡️ Loan Insurance — Go Digit
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">
          4-sheet Excel: Accrual Entry · Go_Digit Float · Active Cases · Cancellations
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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">

        <!-- Period -->
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">
            Step 1 — Select Period
          </div>
          <div id="li-month-pills"
               style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
            <span style="font-size:11px;color:var(--muted)">Loading months…</span>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div>
              <div class="field-label">From</div>
              <input type="date" class="form-input" id="li-from" style="width:145px">
            </div>
            <div>
              <div class="field-label">To</div>
              <input type="date" class="form-input" id="li-to" style="width:145px">
            </div>
            <div>
              <div class="field-label">Month Label</div>
              <input type="text" class="form-input" id="li-label"
                     placeholder="Apr'26" style="width:85px">
            </div>
          </div>
        </div>

        <!-- Float Upload -->
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">
            Step 2 — Go Digit Float File
          </div>
          <input type="file" id="li-float-file" accept=".xlsx,.xls"
                 style="font-size:12px;color:var(--navy);margin-bottom:8px">
          <div style="font-size:10px;color:var(--muted);line-height:1.6">
            Columns: FLOAT_TYPE · ACCOUNT_MANAGER · IMD_CODE · TRANS_DATE ·
            BOOKING_TYPE · TRANSACTION_DETAILS · CREDIT_AMT · DEBIT_AMT ·
            BALANCE · POLICY_NUMBER · RECEIPT_NO
          </div>
        </div>
      </div>

      <div style="margin-top:20px">
        <button class="btn-g" id="li-generate-btn"
                style="padding:11px 32px;font-size:14px">
          📋 Generate LI Schedule
        </button>
        <button class="btn-o" id="li-export-btn"
                style="padding:11px 28px;font-size:14px;display:none;margin-left:12px">
          ⬇ Export Schedule
        </button>
      </div>

      <!-- Progress -->
      <div id="li-progress" style="display:none;margin-top:12px">
        <div style="background:#f0f0f0;border-radius:6px;height:6px;overflow:hidden">
          <div id="li-progress-bar"
               style="width:0%;height:100%;background:#C8992A;transition:width .4s">
          </div>
        </div>
        <div id="li-progress-msg"
             style="font-size:11px;color:var(--muted);margin-top:6px">
          Generating…
        </div>
      </div>
      <div id="li-result" style="margin-top:10px"></div>
    </div>

    <!-- Dashboard (shown after generate) -->
    <div id="li-dashboard" style="display:none">

      <div style="display:flex;align-items:center;justify-content:space-between;
                  margin-bottom:16px">
        <div>
          <div style="font-size:16px;font-weight:600;color:#0B1F3A">
            📊 LI Schedule Dashboard
          </div>
          <div id="li-dash-period"
               style="font-size:11px;color:var(--muted);margin-top:2px">
          </div>
        </div>
        <span style="font-size:10px;padding:4px 12px;border-radius:20px;
                     background:rgba(29,111,66,0.12);color:#1D6F42;font-weight:600">
          ✓ SCHEDULE GENERATED
        </span>
      </div>

      <!-- KPI Cards (6) -->
      <div id="li-kpi-grid"
           style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;
                  margin-bottom:16px">
      </div>

      <!-- Accrual + Dealer -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div class="card">
          <div class="card-header">
            <span class="card-title">📒 Accrual Summary</span>
          </div>
          <div id="li-accrual-summary"></div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">🏪 By Segment</span>
          </div>
          <div id="li-dealer-table"></div>
        </div>
      </div>

      <!-- Channel -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📡 By Channel</span>
        </div>
        <div id="li-channel-table"></div>
      </div>

    </div>
  `;

    var _lastBlob  = null;
    var _lastLabel = null;

    // Wire
    _loadMonths();
    document.getElementById('li-generate-btn')
        .addEventListener('click', _generate);
    document.getElementById('li-export-btn')
        .addEventListener('click', function() {
            if (!_lastBlob) { return; }
            var url = URL.createObjectURL(_lastBlob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'LI_Schedule_' + (_lastLabel||'').replace("'","_") + '.xlsx';
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
        });

    // ================================================================
    async function _loadMonths() {
        try {
            var res    = await API.Disbursal.getAvailableMonths();
            var months = (res && res.data) ? res.data : [];
            var pills  = document.getElementById('li-month-pills');
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
                    document.getElementById('li-from').value  = this.dataset.from;
                    document.getElementById('li-to').value    = this.dataset.to;
                    document.getElementById('li-label').value = this.dataset.label;
                });
            });
            var first = pills.querySelector('.pill-btn');
            if (first) first.click();
        } catch(e) { console.warn('[LI] months:', e.message); }
    }

    // ================================================================
    async function _generate() {
        var from  = document.getElementById('li-from').value;
        var to    = document.getElementById('li-to').value;
        var label = (document.getElementById('li-label').value || '').trim();
        var file  = document.getElementById('li-float-file').files[0];

        if (!from || !to)  { _msg('warn', 'Please select period dates.');       return; }
        if (!label)        { _msg('warn', "Enter month label e.g. Apr'26.");     return; }
        if (!file)         { _msg('warn', 'Please upload Go Digit float file.'); return; }

        var btn  = document.getElementById('li-generate-btn');
        var prog = document.getElementById('li-progress');
        var bar  = document.getElementById('li-progress-bar');
        var msg  = document.getElementById('li-progress-msg');

        btn.disabled = true; btn.textContent = '⏳ Generating…';
        prog.style.display = 'block';
        bar.style.width = '20%'; msg.textContent = 'Fetching data from database…';

        try {
            var form = new FormData();
            form.append('from',       from);
            form.append('to',         to);
            form.append('monthLabel', label);
            form.append('floatFile',  file);

            bar.style.width = '55%'; msg.textContent = 'Building Excel sheets…';

            var token = API.getToken();
            var res = await fetch(
                'http://localhost:8080/api/schedules/loan-insurance/generate',
                { method:'POST', body:form,
                    headers: token ? {'Authorization':'Bearer '+token} : {} }
            );

            bar.style.width = '85%'; msg.textContent = 'Preparing download…';

            if (!res.ok) {
                var err = await res.json().catch(function(){ return {}; });
                throw new Error(err.message || 'Server error ('+res.status+')');
            }

            // Store blob — no auto-download, user clicks Export
            var blob = await res.blob();
            _lastBlob   = blob;
            _lastLabel  = label;

            bar.style.width = '100%'; msg.textContent = 'Done!';
            _msg('success',
                '✅ Dashboard ready — <strong>'+label+'</strong> · '+from+' → '+to
                + ' &nbsp;·&nbsp; Click <strong>Export Schedule</strong> to download Excel.');

            // Show export button
            var exportBtn = document.getElementById('li-export-btn');
            if (exportBtn) exportBtn.style.display = 'inline-block';

            await _loadDashboard(from, to, label, token);

        } catch(e) {
            bar.style.width = '0%';
            _msg('error', '❌ '+e.message);
        } finally {
            btn.disabled = false; btn.textContent = '📋 Generate LI Schedule';
        }
    }

    // ================================================================
    async function _loadDashboard(from, to, label, token) {
        try {
            // Fetch disbursal dashboard + total expense in parallel
            var [dashRes, expRes] = await Promise.all([
                API.Disbursal.getDashboard(from, to),
                fetch('http://localhost:8080/api/schedules/loan-insurance/last-expense',
                    { headers: token ? {'Authorization':'Bearer '+token} : {} })
                    .then(function(r){ return r.json(); }).catch(function(){ return {}; })
            ]);

            var d = dashRes && dashRes.data ? dashRes.data : null;
            if (!d) return;

            var totalExpense = Number(expRes.totalExpense || 0);

            var dash = document.getElementById('li-dashboard');
            if (dash) { dash.style.display = 'block'; }

            var periodEl = document.getElementById('li-dash-period');
            if (periodEl)
                periodEl.textContent = label + '  ·  ' + from + ' → ' + to;

            var inr = function(v) {
                return '₹' + Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
            };
            var pct = function(v) {
                return Number(v||0).toFixed(2) + '%';
            };

            // ── LI Calculations ───────────────────────────────────────
            var liNet         = Number(d.liCharges || 0);
            var liCount       = Number(d.liChargesLoanCount || d.activeLoans || 0);
            var liNetDisbursal= Number(d.liNetDisbursalAmount || 0);
            var avgLiLead     = liCount > 0 ? liNet / liCount : 0;
            var commNet     = Math.round(Math.round(liNet / 1.18) * 0.82);
            var commActive  = Math.round(
                Math.round((liNet + Math.abs(Number(d.cancelledAmount||0))) / 1.18) * 0.82
            );
            var commCancel  = Math.round(
                Math.round(Math.abs(Number(d.cancelledAmount||0)) / 1.18) * 0.82
            );

            // ── KPI Cards ────────────────────────────────────────────
            var kpis = [
                {
                    label: 'LI Charges Loan Count',
                    value: Number(liCount).toLocaleString(),
                    sub:   'Loans with LI_CHARGES > 0',
                    clr:   '#1D6F42'
                },
                {
                    label: 'LI Charges (Net)',
                    value: inr(liNet),
                    sub:   'Active − Old Month Cancel',
                    clr:   '#1E3F6B'
                },
                {
                    label: 'Total Expense',
                    value: inr(Math.abs(totalExpense)),
                    sub:   'From Go Digit Float (Rebooking)',
                    clr:   '#8B2121'
                },
                {
                    label: 'Net Commission @82%',
                    value: inr(commNet),
                    sub:   'LI excl GST × 82%',
                    clr:   '#C8992A'
                },
                {
                    label: 'Avg LI / Lead',
                    value: inr(avgLiLead),
                    sub:   'LI Net ÷ LI Charges Count',
                    clr:   '#0B1F3A'
                },
                {
                    label: 'LI Charges % per Loan',
                    value: pct(liNetDisbursal > 0 ? (liNet / liNetDisbursal) * 100 : 0),
                    sub:   'LI Charges (Net) ÷ Disbursal of LI Loans × 100',
                    clr:   '#1E3F6B'
                },
            ];

            var grid = document.getElementById('li-kpi-grid');
            if (grid) {
                grid.innerHTML = kpis.map(function(k) {
                    return '<div style="background:#fff;border-radius:10px;padding:16px;'
                        + 'border:1.5px solid rgba(11,31,58,0.08);'
                        + 'border-top:3px solid '+k.clr+';'
                        + 'box-shadow:0 1px 4px rgba(0,0,0,0.05)">'
                        + '<div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;'
                        +   'color:#5A6E88;margin-bottom:6px">'+k.label+'</div>'
                        + '<div style="font-size:20px;font-weight:600;color:#0B1F3A">'+k.value+'</div>'
                        + '<div style="font-size:9px;color:#9AA5B4;margin-top:4px">'+k.sub+'</div>'
                        + '</div>';
                }).join('');
            }

            // ── Accrual Summary ────────────────────────────────────────
            var accEl = document.getElementById('li-accrual-summary');
            if (accEl) {
                var rows = [
                    { name:'Accrued — LI with Protek',
                        count: d.activeLoans||0,            comm: inr(commActive), clr:'#1D6F42' },
                    { name:'Subsequent Cancellation',
                        count: d.oldMonthCancellations||0,  comm: inr(commCancel), clr:'#8B2121' },
                    { name:'Net Commission',
                        count: (d.activeLoans||0)-(d.oldMonthCancellations||0),
                        comm: inr(commNet), clr:'#C8992A' },
                ];
                var tbl = '<table class="data-table"><thead><tr>'
                    + '<th>Particulars</th><th style="text-align:right">Count</th>'
                    + '<th style="text-align:right">Commission @82%</th>'
                    + '</tr></thead><tbody>';
                rows.forEach(function(r) {
                    tbl += '<tr>'
                        + '<td style="font-weight:500;color:'+r.clr+'">'+r.name+'</td>'
                        + '<td style="text-align:right">'+Number(r.count).toLocaleString()+'</td>'
                        + '<td style="text-align:right;font-weight:600;color:'+r.clr+'">'+r.comm+'</td>'
                        + '</tr>';
                });
                tbl += '</tbody></table>'
                    + '<div style="margin-top:10px;padding:10px;background:rgba(11,31,58,0.04);'
                    + 'border-radius:8px;font-size:11px">'
                    + '<div style="font-weight:600;color:#0B1F3A;margin-bottom:5px">GL Entry</div>'
                    + '<div style="display:flex;justify-content:space-between;padding:2px 0">'
                    + '<span>DR 13126048 — Accrued A/c</span>'
                    + '<span style="font-weight:600">'+inr(commNet)+'</span></div>'
                    + '<div style="display:flex;justify-content:space-between;padding:2px 0;'
                    + 'border-top:1px solid rgba(11,31,58,0.08)">'
                    + '<span>CR 31120427 — Commission</span>'
                    + '<span style="font-weight:600">'+inr(commNet)+'</span></div>'
                    + '</div>';
                accEl.innerHTML = tbl;
            }

            // ── Segment (Dealer/UCB) ───────────────────────────────────
            var dealerEl = document.getElementById('li-dealer-table');
            if (dealerEl && d.bySegment && d.bySegment.length) {
                var dHtml = '<table class="data-table"><thead><tr>'
                    + '<th>Segment</th><th style="text-align:right">Loans</th>'
                    + '<th style="text-align:right">Net Amount</th>'
                    + '</tr></thead><tbody>';
                d.bySegment.forEach(function(r) {
                    dHtml += '<tr>'
                        + '<td>'+(r.key||'–')+'</td>'
                        + '<td style="text-align:right">'
                        + Number(r.count||0).toLocaleString()+'</td>'
                        + '<td style="text-align:right">₹'
                        + Number(r.amount||0).toLocaleString('en-IN',{maximumFractionDigits:0})
                        + '</td></tr>';
                });
                dealerEl.innerHTML = dHtml + '</tbody></table>';
            }

            // ── Channel ───────────────────────────────────────────────
            var chEl = document.getElementById('li-channel-table');
            if (chEl && d.byChannel && d.byChannel.length) {
                var chHtml = '<table class="data-table"><thead><tr>'
                    + '<th>Channel</th><th style="text-align:right">Loans</th>'
                    + '<th style="text-align:right">Net Amount</th>'
                    + '</tr></thead><tbody>';
                d.byChannel.forEach(function(r) {
                    chHtml += '<tr>'
                        + '<td>'+(r.key||'–')+'</td>'
                        + '<td style="text-align:right">'
                        + Number(r.count||0).toLocaleString()+'</td>'
                        + '<td style="text-align:right">₹'
                        + Number(r.amount||0).toLocaleString('en-IN',{maximumFractionDigits:0})
                        + '</td></tr>';
                });
                chEl.innerHTML = chHtml + '</tbody></table>';
            }

            setTimeout(function() {
                document.getElementById('li-dashboard')
                    .scrollIntoView({behavior:'smooth'});
            }, 150);

        } catch(e) {
            console.warn('[LI] dashboard failed:', e.message);
        }
    }

    function _msg(type, html) {
        var el = document.getElementById('li-result');
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