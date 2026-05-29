/**
 * ================================================================
 * FinRecon Pro — Monthly Schedules (Card Grid)
 * ================================================================
 * Cards grid — clicking Loan Insurance → Router.go('li-schedule')
 * Other cards: Coming Soon (disabled)
 * ================================================================
 */

Router.register('schedules', function(panel) {

  // Route map: card id → page id
  window._goSchedule = function(id) {
    var routes = {
      'loan-ins-schedule': 'li-schedule',
      'float-register':    'float-register',
    };
    Router.go(routes[id] || id);
  };


  const cards = [
    { id:'loan-ins-schedule', icon:'🛡️', name:'Loan Insurance',
      sub:'Go Digit', desc:'Active + Cancellation + Accrual + Float',
      badge:'Live', badgeClr:'#1D6F42', badgeBg:'#D9F0D9',
      accent:'#C8992A', ready:true },
    { id:'motor-schedule',    icon:'🚗', name:'Motor Insurance',
      sub:'Schedule', desc:'Premium collection & remittance register',
      badge:'Soon', badgeClr:'#8A6010', badgeBg:'#FFF3CD',
      accent:'#1E3F6B', ready:false },
    { id:'rto-schedule',      icon:'🚦', name:'RTO Schedule',
      sub:'Schedule', desc:'RTO charges reconciliation & register',
      badge:'Soon', badgeClr:'#8A6010', badgeBg:'#FFF3CD',
      accent:'#1E3F6B', ready:false },
    { id:'pocket-schedule',   icon:'💳', name:'Pocket Insurance',
      sub:'Schedule', desc:'Pocket insurance premium register',
      badge:'Soon', badgeClr:'#8A6010', badgeBg:'#FFF3CD',
      accent:'#1E3F6B', ready:false },
    { id:'partmax-schedule',  icon:'📋', name:'Partner Max',
      sub:'Schedule', desc:'PMax charges & reconciliation',
      badge:'Soon', badgeClr:'#8A6010', badgeBg:'#FFF3CD',
      accent:'#1E3F6B', ready:false },
    { id:'float-register',    icon:'📊', name:'Float Register',
      sub:'LI + MI', desc:'Go Digit LI Float & Motor Insurance Float Register',
      badge:'Live', badgeClr:'#1D6F42', badgeBg:'#D9F0D9',
      accent:'#0B1F3A', ready:true },
    { id:'bajaj-colending',   icon:'🏦', name:'Bajaj Co-Lending',
      sub:'Schedule', desc:'Co-lending disbursals & collections',
      badge:'Soon', badgeClr:'#8A6010', badgeBg:'#FFF3CD',
      accent:'#1E3F6B', ready:false },
    { id:'accrual-actual',    icon:'📒', name:'Accrual vs Actual',
      sub:'Reconciliation', desc:'Month-end accrual reconciliation',
      badge:'Soon', badgeClr:'#8A6010', badgeBg:'#FFF3CD',
      accent:'#1E3F6B', ready:false },
  ];

  panel.innerHTML = `
    <div class="module-hero">
      <div>
        <div class="hero-label">Schedules</div>
        <div class="hero-title">Monthly Schedules</div>
        <div class="hero-sub">Select a schedule to prepare for the month</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
      ${cards.map(c => `
        <div
          data-card-id="${c.id}" data-ready="${c.ready}"
          style="
            background:#fff;
            border-radius:12px;
            padding:20px;
            border:1.5px solid ${c.ready ? 'rgba(200,153,42,0.35)' : 'rgba(11,31,58,0.08)'};
            cursor:${c.ready ? 'pointer' : 'default'};
            opacity:${c.ready ? 1 : 0.6};
            position:relative;
            overflow:hidden;
            box-shadow:${c.ready
      ? '0 2px 12px rgba(200,153,42,0.12)'
      : '0 1px 4px rgba(0,0,0,0.05)'};
            transition:all .18s"
          ${c.ready ? `
          onmouseover="this.style.transform='translateY(-2px)';
                       this.style.boxShadow='0 6px 20px rgba(200,153,42,0.2)'"
          onmouseout="this.style.transform='';
                      this.style.boxShadow='0 2px 12px rgba(200,153,42,0.12)'"` : ''}>

          <!-- Accent bar top -->
          <div style="position:absolute;top:0;left:0;right:0;height:3px;
                      background:${c.ready ? c.accent : 'rgba(11,31,58,0.08)'}"></div>

          <!-- Icon + Badge -->
          <div style="display:flex;justify-content:space-between;
                      align-items:flex-start;margin-bottom:14px">
            <div style="width:44px;height:44px;border-radius:10px;
                        background:${c.ready ? 'rgba(200,153,42,0.1)' : 'rgba(11,31,58,0.05)'};
                        display:flex;align-items:center;justify-content:center;font-size:22px">
              ${c.icon}
            </div>
            <span style="font-size:9px;padding:3px 8px;border-radius:20px;
                         font-weight:600;letter-spacing:.3px;
                         background:${c.badgeBg};color:${c.badgeClr}">
              ${c.badge}
            </span>
          </div>

          <!-- Name -->
          <div style="font-size:13px;font-weight:600;color:#0B1F3A;
                      margin-bottom:2px">${c.name}</div>
          <div style="font-size:10px;font-weight:500;color:${c.accent};
                      margin-bottom:6px">${c.sub}</div>
          <div style="font-size:10px;color:#5A6E88;line-height:1.5">
            ${c.desc}
          </div>

          <!-- CTA -->
          ${c.ready ? `
          <div style="margin-top:14px;display:flex;align-items:center;gap:4px">
            <div style="width:6px;height:6px;border-radius:50%;background:#C8992A;
                        animation:pulse 1.5s infinite"></div>
            <span style="font-size:10px;font-weight:600;color:#C8992A">
              OPEN SCHEDULE
            </span>
          </div>` : `
          <div style="margin-top:14px;font-size:10px;color:#9AA5B4">
            Under development
          </div>`}
        </div>`).join('')}
    </div>

    <style>
      @keyframes pulse {
        0%,100% { opacity:1; }
        50%      { opacity:.3; }
      }
    </style>
  `;

  // ── Wire card clicks ──────────────────────────────────────────
  var routes = {
    'loan-ins-schedule': 'li-schedule',
    'float-register':    'float-register',
  };
  panel.querySelectorAll('[data-card-id]').forEach(function(el) {
    if (el.dataset.ready !== 'true') return;
    var id = el.dataset.cardId;
    el.addEventListener('click', function() {
      Router.go(routes[id] || id);
    });
  });

});