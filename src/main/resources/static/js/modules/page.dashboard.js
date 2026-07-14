/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * File    : js/modules/page.dashboard.js
 * ================================================================
 * @author  Jatin Mittal
 * @contact jatin.mittal@cars24.com | +91-8221944248
 * @company CARS24 Financial Services Pvt. Ltd. (CFSPL)
 */

Router.register('dashboard', function(panel) {

    const s    = (typeof Auth !== 'undefined') ? Auth.getSession() : null;
    const name = s ? s.name : 'Finance User';
    const role = s ? s.role : 'user';

    panel.innerHTML = `

    <!-- Welcome hero -->
    <div style="background:linear-gradient(120deg,#0B1F3A 0%,#1E3F6B 100%);
                border-radius:12px;padding:28px 32px;margin-bottom:20px;
                display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;
                    color:rgba(255,255,255,0.45);margin-bottom:6px">Welcome back</div>
        <div style="font-size:24px;font-weight:500;color:#fff;margin-bottom:4px">${name}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5)">
          ${role === 'admin'
        ? '&#x1F6E1;&#xFE0F; Admin access &nbsp;&middot;&nbsp; Full system control'
        : '&#x1F464; Finance User &nbsp;&middot;&nbsp; Reconciliation &amp; Reports'}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px">Today</div>
        <div style="font-size:15px;color:#E8B84B;font-weight:500">
          ${new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
        </div>
        <div style="margin-top:12px">
          <span style="background:#C8992A;color:#fff;font-size:10px;padding:3px 10px;
                       border-radius:20px;font-weight:500;letter-spacing:.5px">LIVE</span>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      ${[
        { page:'loanins',  icon:'&#x1F6E1;&#xFE0F;', title:'Loan Insurance',    sub:'Float vs PR vs SAP'   },
        { page:'motor',    icon:'&#x1F697;',           title:'Motor Insurance',   sub:'L1 + Full L2 Recon'  },
        { page:'bank',     icon:'&#x1F3E6;',           title:'Bank Recon',        sub:'Ledger vs Bank'      },
        { page:'disbursal',icon:'&#x1F4CA;',           title:'Disbursal Report',  sub:'KPIs & Breakdowns'   },
    ].map(c => `
        <div onclick="Router.go('${c.page}')" style="cursor:pointer;background:#fff;
             border:1px solid rgba(11,31,58,0.1);border-radius:10px;padding:18px;
             transition:box-shadow .15s;box-shadow:0 1px 4px rgba(0,0,0,0.06)"
             onmouseover="this.style.boxShadow='0 4px 16px rgba(11,31,58,0.12)'"
             onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'">
          <div style="font-size:24px;margin-bottom:8px">${c.icon}</div>
          <div style="font-size:13px;font-weight:600;color:#0B1F3A">${c.title}</div>
          <div style="font-size:11px;color:#5A6E88;margin-top:4px">${c.sub}</div>
          <div style="margin-top:10px;font-size:10px;color:#C8992A;font-weight:600">OPEN &#x2192;</div>
        </div>`).join('')}
    </div>

    <!-- Bajaj Co-Lending Card -->
    <div style="margin-bottom:20px">
      <div style="background:linear-gradient(135deg,#FFF8E1 0%,#FFFDE7 100%);
                  border:1.5px solid #E8B84B;border-radius:12px;padding:20px 24px;
                  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:12px;background:#0B1F3A;
                      display:flex;align-items:center;justify-content:center;
                      font-size:22px;flex-shrink:0">&#x1F3E6;</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="font-size:16px;font-weight:600;color:#0B1F3A">Bajaj Co-Lending</div>
              <span style="background:#FFF3CD;border:1px solid #E8B84B;color:#8A6010;
                           font-size:9px;padding:2px 8px;border-radius:20px;font-weight:600;
                           letter-spacing:.5px">COMING SOON</span>
            </div>
            <div style="font-size:12px;color:#5A6E88">
              Bajaj Finance co-lending portfolio &mdash; disbursals, collections &amp; reconciliation
            </div>
            <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap">
              ${[
        { label:'Disbursal Recon', icon:'&#x1F4CB;' },
        { label:'Collection Recon',icon:'&#x1F4B0;' },
        { label:'Outstanding',     icon:'&#x23F3;'  },
        { label:'Partner: Bajaj Finance', icon:'&#x1F91D;' },
    ].map(f => `
                <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#5A6E88">
                  <span>${f.icon}</span>
                  <span>${f.label}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <div style="font-size:11px;color:#8A6010;font-weight:500">Module under setup</div>
          <button onclick="Router.go('schedules')"
                  style="background:#0B1F3A;color:#E8B84B;border:none;border-radius:8px;
                         padding:8px 18px;font-size:12px;font-weight:500;cursor:pointer;
                         font-family:'DM Sans',sans-serif">
            View Schedule &#x2192;
          </button>
        </div>
      </div>
    </div>

    <!-- Live Recon Results -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
      <div class="card" id="dash-li-card">
        <div class="card-header">
          <span class="card-title">Loan Insurance &mdash; Last Run</span>
          <span class="card-action" onclick="Router.go('loanins')">Run New &#x2192;</span>
        </div>
        <div id="dash-li-kpis">
          <div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">
            <div style="font-size:28px;margin-bottom:8px">&#x1F4C2;</div>
            No run yet this session.<br>
            <span onclick="Router.go('loanins')"
                  style="color:var(--gold);cursor:pointer;font-weight:500">Run LI Recon &#x2192;</span>
          </div>
        </div>
      </div>
      <div class="card" id="dash-mi-card">
        <div class="card-header">
          <span class="card-title">Motor Insurance &mdash; Last Run</span>
          <span class="card-action" onclick="Router.go('motor')">Run New &#x2192;</span>
        </div>
        <div id="dash-mi-kpis">
          <div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">
            <div style="font-size:28px;margin-bottom:8px">&#x1F4C2;</div>
            No run yet this session.<br>
            <span onclick="Router.go('motor')"
                  style="color:var(--gold);cursor:pointer;font-weight:500">Run MI Recon &#x2192;</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pending + Activity -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Pending Items</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:8px;
                       background:var(--red-bg,#fdeaea);color:var(--red-text,#8B2121)">
            ${(AppData && AppData.dashboardPending) ? AppData.dashboardPending.length : 0} open
          </span>
        </div>
        <div style="display:flex;flex-direction:column;gap:0">
          ${(AppData && AppData.dashboardPending || []).map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:9px 0;border-bottom:1px solid rgba(11,31,58,0.06)">
              <div>
                <div style="font-size:12px;font-weight:500;color:#0B1F3A">${p.item}</div>
                <div style="font-size:10px;color:#5A6E88;margin-top:2px">${p.due}</div>
              </div>
              <span style="font-size:9px;padding:2px 8px;border-radius:8px;font-weight:500;white-space:nowrap;
                           background:${p.priority==='High'?'#fdeaea':'#FFF8E1'};
                           color:${p.priority==='High'?'#8B2121':'#8A6010'}">
                ${p.priority}
              </span>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Activity</span></div>
        <div style="display:flex;flex-direction:column;gap:0">
          ${(AppData && AppData.activity || []).map(a => `
            <div style="display:flex;gap:10px;align-items:flex-start;
                        padding:8px 0;border-bottom:1px solid rgba(11,31,58,0.06)">
              <div style="width:30px;height:30px;border-radius:50%;background:#FFF8E1;
                          display:flex;align-items:center;justify-content:center;
                          font-size:13px;flex-shrink:0">${a.icon || '&#x1F4CB;'}</div>
              <div>
                <div style="font-size:12px;color:#0B1F3A;font-weight:500">${a.action}</div>
                <div style="font-size:10px;color:#5A6E88;margin-top:2px">${a.time}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;

    // Refresh live KPIs if recon was run earlier this session
    _updateDashboard();

    // Load available periods from DB for live KPIs — must run after the
    // innerHTML above so #dash-period-pills / #dash-load-btn exist. Running
    // this at module load time (before login/routing) fired an authenticated
    // call with no token yet, which 401'd and triggered api.js's reload-on-401
    // handler — reloading re-ran this same unguarded call, looping forever.
    _loadDashboardPeriods();
    document.getElementById('dash-load-btn')
        ?.addEventListener('click', _loadPeriodKPIs);
});


// ── Called after each recon run to update dashboard live ──────────
// ── Load available periods for dashboard ──────────────────────────
async function _loadDashboardPeriods() {
    try {
        const res    = await API.Disbursal.getAvailableMonths();
        const months = res?.data || [];
        const pills  = document.getElementById('dash-period-pills');
        if (!pills || !months.length) { if(pills) pills.innerHTML='<span style="font-size:11px;color:var(--muted)">No data in DB</span>'; return; }
        const MO = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        pills.innerHTML = months.map(m => {
            const yr=m.yr||m.YR, mo=m.mo||m.MO;
            const last=new Date(yr,mo,0).getDate();
            const from=`${yr}-${String(mo).padStart(2,'0')}-01`;
            const to=`${yr}-${String(mo).padStart(2,'0')}-${last}`;
            const lbl=`${MO[mo]}'${String(yr).slice(-2)}`;
            return `<button class="btn-o" style="font-size:11px;padding:3px 10px"
                      data-from="${from}" data-to="${to}">${lbl}</button>`;
        }).join('');
        pills.querySelectorAll('[data-from]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('dash-period-from').value = btn.dataset.from;
                document.getElementById('dash-period-to').value   = btn.dataset.to;
                pills.querySelectorAll('[data-from]').forEach(b=>{b.style.background='';b.style.color='';});
                btn.style.background='#0B1F3A'; btn.style.color='#E8B84B';
                _loadPeriodKPIs();
            });
        });
        pills.querySelector('[data-from]')?.click();
    } catch(e) { console.warn('[Dashboard] periods:', e.message); }
}

async function _loadPeriodKPIs() {
    const from = document.getElementById('dash-period-from')?.value;
    const to   = document.getElementById('dash-period-to')?.value;
    if (!from || !to) return;
    const btn  = document.getElementById('dash-load-btn');
    if (btn) { btn.textContent='⏳'; btn.disabled=true; }
    try {
        const res = await API.Disbursal.getDashboard(from, to);
        const d   = res?.data; if (!d) return;
        const inr = v => '₹' + Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
        const grid = document.getElementById('dash-live-kpis');
        if (!grid) return;
        grid.style.display = 'grid';
        grid.innerHTML = [
            { label:'Net Loans',        value:(d.netLoanCount||0).toLocaleString(), clr:'#C8992A' },
            { label:'Active',           value:(d.activeLoans||0).toLocaleString(),  clr:'#1D6F42' },
            { label:'Net Disbursal',    value:inr(d.netDisbursalAmount),            clr:'#1E3F6B' },
            { label:'LI (Net)',         value:inr(d.liCharges),                     clr:'#1E3F6B' },
            { label:'MI (Net)',         value:inr(d.miCharges),                     clr:'#1E3F6B' },
            { label:'Old Cancel',       value:(d.oldMonthCancellations||0).toLocaleString(), clr:'#8B2121' },
        ].map(k=>`
      <div style="background:rgba(11,31,58,0.03);border-radius:8px;padding:10px 12px;
                  border-top:2px solid ${k.clr}">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;
                    color:#5A6E88;margin-bottom:3px">${k.label}</div>
        <div style="font-size:15px;font-weight:600;color:#0B1F3A">${k.value}</div>
      </div>`).join('');
    } catch(e) { console.warn('[Dashboard] KPI load:', e.message); }
    finally { if (btn) { btn.textContent='Load'; btn.disabled=false; } }
}

function _updateDashboard() {
    const li     = window._lastLIResult;
    const mi     = window._lastMIResult;
    const liKpis = document.getElementById('dash-li-kpis');
    const miKpis = document.getElementById('dash-mi-kpis');

    if (li && liKpis) {
        liKpis.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:4px 0';
        liKpis.innerHTML = [
            { label:'PERIOD',      value: li.monthLabel },
            { label:'TOTAL',       value: li.total.toLocaleString(),                            color:'#1E3F6B' },
            { label:'MATCHED',     value: `${li.match} (${li.matchPct}%)`,                     color:'#1D6F42' },
            { label:'QUERIES',     value: li.queries.toLocaleString(),                          color:'#C0392B' },
            { label:'FLOAT',       value: '&#x20B9;' + Number(li.totalFloat).toLocaleString('en-IN'), color:'#C8992A' },
            { label:'PR MISMATCH', value: li.prMismatch.toLocaleString(),                       color:'#C0392B' },
        ].map(k => `
      <div style="flex:1;min-width:90px;border-top:3px solid ${k.color||'#1E3F6B'};
                  background:#fff;border-radius:6px;padding:8px;
                  box-shadow:0 1px 4px rgba(0,0,0,0.06)">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;
                    color:#5A6E88;margin-bottom:3px">${k.label}</div>
        <div style="font-size:15px;font-weight:500;color:#0B1F3A">${k.value}</div>
      </div>`).join('');
    }

    if (mi && miKpis) {
        miKpis.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:4px 0';
        miKpis.innerHTML = [
            { label:'PERIOD',   value: mi.monthLabel },
            { label:'TOTAL',    value: mi.total.toLocaleString(),   color:'#1E3F6B' },
            { label:'ISSUED',   value: mi.issued.toLocaleString(),  color:'#1D6F42' },
            { label:'QUERIES',  value: mi.queries.toLocaleString(), color:'#C0392B' },
            { label:'PARTNERS', value: String(mi.partners),         color:'#C8992A' },
        ].map(k => `
      <div style="flex:1;min-width:90px;border-top:3px solid ${k.color||'#1E3F6B'};
                  background:#fff;border-radius:6px;padding:8px;
                  box-shadow:0 1px 4px rgba(0,0,0,0.06)">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;
                    color:#5A6E88;margin-bottom:3px">${k.label}</div>
        <div style="font-size:15px;font-weight:500;color:#0B1F3A">${k.value}</div>
      </div>`).join('');
    }
}