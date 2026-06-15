/**
 * FINX24 — Float Register
 * Period-range dashboard | Auto-load register | Bank statement
 * @author  Jatin Mittal
 * @contact jatin.mittal@cars24.com | +91-8221944248
 * @company CARS24 Financial Services Pvt. Ltd. (CFSPL)
 */
Router.register('float-register', function(panel) {

  var currentTab = 'LI';
  var _allRows   = [];

  // PR Register column config — mirrors FloatServiceImpl.PR_CFG
  var PR_GUIDE = {
    'Go_Digit_LI':            {pol:'POLICY_NUMBER',  lid:'BOOKINGID_PLANID',       label:'Loan ID'},
    'Kotak_LI':               {pol:'POLICY_NUMBER',  lid:'BOOKINGID_PLANID',       label:'Loan ID'},
    'Go_Digit_MI_GS':         {pol:'POLICY_NUMBER',  lid:'VEH_REG_NO',             label:'Car Reg No'},
    'ICICI_Lombard_MI_GS':    {pol:'POL_NUM_TXT',    lid:'MOTOR_REGISTRATION_NUM', label:'Car Reg No'},
    'Tata_AIG_MI_GS':         {pol:'policy_no',      lid:'registration_no',        label:'Car Reg No'},
    'Kotak_MI_GS':            {pol:'POLICY NO',      lid:'Registration Number',    label:'Car Reg No'},
    'Go_Digit_INSURE24':      {pol:'POLICY_NUMBER',  lid:'VEH_REG_NO',             label:'Car Reg No'},
    'Kotak_INSURE24':         {pol:'POLICY NO',      lid:'Registration Number',    label:'Car Reg No'},
    'Tata_INSURE24':          {pol:'policy_no',      lid:'registration_no',        label:'Car Reg No'},
    'ICICI_Lombard_INSURE24': {pol:'POL_NUM_TXT',    lid:'MOTOR_REGISTRATION_NUM', label:'Car Reg No'},
    'Bajaj_INSURE24':         {pol:'Policy Number',  lid:'Registration Number',    label:'Car Reg No'},
    'Go_Digit_DO':            {pol:'POLICY_NUMBER',  lid:'VEH_REG_NO',             label:'Car Reg No'},
    'Bajaj_EW':               {pol:'Policy Number',  lid:'Registration Number',    label:'Car Reg No'},
  };

  var LI_DEFAULT = [
    {code:'Go_Digit_LI',display:'Go Digit LI',gl:'8503595'},
    {code:'Kotak_LI',   display:'Kotak LI',   gl:'8503598'},
  ];
  var MI_DEFAULT = {
    'MI_GS':      [{code:'Tata_AIG_MI_GS',display:'Tata AIG',gl:'6000015'},{code:'ICICI_Lombard_MI_GS',display:'ICICI Lombard',gl:'6000005'},{code:'United_MI_GS',display:'United',gl:'6000007'},{code:'Go_Digit_MI_GS',display:'Go Digit GS',gl:'6000000'},{code:'Kotak_MI_GS',display:'Kotak GS',gl:'6000002'}],
    'MI_INSURE24':[{code:'Go_Digit_INSURE24',display:'Go Digit I24',gl:'6000030'},{code:'Kotak_INSURE24',display:'Kotak I24',gl:'6000032'},{code:'Tata_INSURE24',display:'Tata I24',gl:'6000031'},{code:'ICICI_Lombard_INSURE24',display:'ICICI I24',gl:'6000038'},{code:'Bajaj_INSURE24',display:'Bajaj I24',gl:'6000037'}],
    'MI_DO':      [{code:'Go_Digit_DO',display:'Go Digit DO',gl:'6000040'}],
    'EW':         [{code:'Bajaj_EW',display:'Bajaj EW',gl:'6000009'}],
  };

  var MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var toLabel = function(ym){ // "2025-04" → "Apr'25"
    if(!ym) return '';
    var d = new Date(ym+'-01');
    return MO[d.getMonth()]+"'"+String(d.getFullYear()).slice(-2);
  };
  var INR = function(v){
    var n=Number(v||0);
    return (n<0?'-':'')+'₹'+Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:0});
  };
  // Compare month labels chronologically e.g. "Apr'25" < "Mar'26"
  var monthOrder = function(lbl) {
    if(!lbl) return 0;
    var mo={'Jan':1,'Feb':2,'Mar':3,'Apr':4,'May':5,'Jun':6,
      'Jul':7,'Aug':8,'Sep':9,'Oct':10,'Nov':11,'Dec':12};
    var m = lbl.match(/([A-Za-z]+)'(\d+)/);
    if(!m) return 0;
    return parseInt(m[2])*100 + (mo[m[1]]||0);
  };

  panel.innerHTML =

      '<div class="module-hero"><div>' +
      '<div class="hero-label">Monthly Schedules</div>' +
      '<div class="hero-title">Float Register</div>' +
      '<div class="hero-sub">Bank statement ledger · LI Float · MI Float</div>' +
      '</div></div>' +

      // Tabs + Export + Loan ID Mapping
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">' +
      '<div style="display:flex;gap:0;border-radius:8px;overflow:hidden;border:1.5px solid rgba(11,31,58,0.15)">' +
      '<button id="tab-li" style="padding:9px 28px;font-size:13px;font-weight:600;cursor:pointer;background:#0B1F3A;color:#E8B84B;border:none">🛡️ LI Float</button>' +
      '<button id="tab-mi" style="padding:9px 28px;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:#0B1F3A;border:none">🚗 MI Float</button>' +
      '</div>' +
      '<button id="fl-export-register-btn" style="display:none;padding:9px 20px;font-size:12px;font-weight:600;' +
      'background:#0B1F3A;color:#E8B84B;border:none;border-radius:8px;cursor:pointer;' +
      'align-items:center;gap:6px">📥 Download Float Register</button>' +
      (Auth.isAdmin() ?
      '<button id="fl-map-loan-btn" style="padding:9px 20px;font-size:12px;font-weight:600;' +
      'background:#1E3F6B;color:#E8B84B;border:none;border-radius:8px;cursor:pointer;' +
      'align-items:center;gap:6px">🔗 Map Loan ID</button>' : '') +
      '</div>' +

      // Export modal
      '<div id="fl-export-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);' +
      'z-index:9999;align-items:center;justify-content:center">' +
      '<div style="background:#fff;border-radius:14px;padding:28px 32px;width:360px;' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.18)">' +
      '<div style="font-size:16px;font-weight:700;color:#0B1F3A;margin-bottom:6px" id="fl-export-modal-title">' +
      '📥 Download Float Register' +
      '</div>' +
      '<div style="font-size:12px;color:#5A6E88;margin-bottom:18px">' +
      'Select a month to generate the Float Register Excel with formula-based summary.' +
      '</div>' +
      '<div style="margin-bottom:16px">' +
      '<div style="font-size:11px;font-weight:600;color:#0B1F3A;margin-bottom:6px">Select Month</div>' +
      '<input type="month" id="fl-export-month-sel" class="form-input" style="width:100%">' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
      '<button id="fl-export-cancel-btn" style="padding:8px 20px;font-size:12px;' +
      'background:#F2F4F7;color:#0B1F3A;border:none;border-radius:7px;cursor:pointer">' +
      'Cancel' +
      '</button>' +
      '<button id="fl-export-download-btn" style="padding:8px 20px;font-size:12px;' +
      'background:#0B1F3A;color:#E8B84B;border:none;border-radius:7px;cursor:pointer;font-weight:600">' +
      '⬇ Download' +
      '</button>' +
      '</div>' +
      '<div id="fl-export-status" style="margin-top:10px;font-size:11px;color:#5A6E88"></div>' +
      '</div>' +
      '</div>' +

      // ── LOAN ID MAPPING MODAL (Admin only) ────────────────────
      (Auth.isAdmin() ?
      '<div id="fl-map-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);' +
      'z-index:9999;align-items:center;justify-content:center">' +
      '<div style="background:#fff;border-radius:14px;padding:28px 32px;width:460px;max-height:90vh;' +
      'overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,0.18)">' +
      '<div id="fl-map-modal-title" style="font-size:16px;font-weight:700;color:#0B1F3A;margin-bottom:6px">' +
      '🔗 Map Loan ID from PR Register' +
      '</div>' +
      '<div id="fl-map-modal-sub" style="font-size:12px;color:#5A6E88;margin-bottom:18px">' +
      'Upload a PR Register to map Policy No → Loan ID (LI) or Car Reg No (MI) into float records.' +
      '</div>' +
      '<div style="margin-bottom:12px">' +
      '<div style="font-size:11px;font-weight:600;color:#0B1F3A;margin-bottom:5px">Partner</div>' +
      '<select id="fl-map-partner" class="form-input" style="width:100%">' +
      '<option value="">— Select Partner —</option>' +
      '</select>' +
      '</div>' +
      '<div style="margin-bottom:12px">' +
      '<div style="font-size:11px;font-weight:600;color:#0B1F3A;margin-bottom:4px">Month <span style="font-weight:400;color:#9AA5B4">(optional — leave blank to map all months)</span></div>' +
      '<input type="month" id="fl-map-month" class="form-input" style="width:100%">' +
      '</div>' +
      '<div id="fl-map-guide" style="background:#F2F4F7;border-radius:8px;padding:10px 14px;' +
      'font-size:11px;color:#5A6E88;margin-bottom:12px;line-height:1.7">' +
      'Select a partner to see expected PR Register column names.' +
      '</div>' +
      '<div style="margin-bottom:16px">' +
      '<div style="font-size:11px;font-weight:600;color:#0B1F3A;margin-bottom:5px">PR Register File (.xlsx / .xls)</div>' +
      '<input type="file" id="fl-map-file" accept=".xlsx,.xls" style="font-size:12px;color:var(--navy);width:100%">' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
      '<button id="fl-map-cancel-btn" style="padding:8px 20px;font-size:12px;' +
      'background:#F2F4F7;color:#0B1F3A;border:none;border-radius:7px;cursor:pointer">Cancel</button>' +
      '<button id="fl-map-submit-btn" style="padding:8px 20px;font-size:12px;font-weight:600;' +
      'background:#0B1F3A;color:#E8B84B;border:none;border-radius:7px;cursor:pointer">🔗 Map Now</button>' +
      '</div>' +
      '<div id="fl-map-status" style="margin-top:12px;font-size:11px;color:#5A6E88"></div>' +
      '</div>' +
      '</div>' : '') +

      // ── UPLOAD (Admin only) ───────────────────────────────────
      (Auth.isAdmin() ? '<div class="card" style="margin-bottom:16px">' +
          '<div class="card-header">' +
          '<span class="card-title" id="fl-upload-title">Upload LI Float</span>' +
          '</div>' +
          '<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">' +
          '<div><div class="field-label">Partner</div>' +
          '<select id="fl-partner" class="form-input" style="width:220px"></select></div>' +
          '<div><div class="field-label">Period From</div>' +
          '<input type="month" id="fl-from" class="form-input" style="width:140px"></div>' +
          '<div><div class="field-label">To (optional)</div>' +
          '<input type="month" id="fl-to" class="form-input" style="width:140px"></div>' +
          '<div><div class="field-label">Float File</div>' +
          '<input type="file" id="fl-file" accept=".xlsx,.xls" style="font-size:12px;color:var(--navy)"></div>' +
          '<button class="btn-g" id="fl-upload-btn" style="padding:9px 22px">⬆ Upload</button>' +
          '</div>' +
          '<div id="fl-upload-msg" style="margin-top:10px"></div>' +
          '</div>' : '') +

      // ── DASHBOARD ─────────────────────────────────────────────
      '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-header">' +
      '<span class="card-title" id="fl-dash-title">Float Dashboard</span>' +
      '<span id="fl-dash-badge" style="font-size:11px;color:var(--muted)"></span>' +
      '</div>' +
      '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">' +
      '<div><div class="field-label">Partner</div>' +
      '<select id="fl-dash-partner" class="form-input" style="width:220px"></select></div>' +
      '<div><div class="field-label">Period From</div>' +
      '<input type="month" id="fl-dash-from" class="form-input" style="width:140px"></div>' +
      '<div><div class="field-label">Period To</div>' +
      '<input type="month" id="fl-dash-to" class="form-input" style="width:140px"></div>' +
      '<button class="btn-g" id="fl-dash-btn" style="padding:8px 20px;font-size:12px">📊 Load</button>' +
      '</div>' +
      '<div id="fl-kpi-cards" style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:16px"></div>' +
      '<div id="fl-month-table"></div>' +
      '</div>' +

      // ── REGISTER ──────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header">' +
      '<span class="card-title" id="fl-reg-title">LI Float Register</span>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<button id="fl-csv-btn" style="display:none;padding:5px 14px;font-size:11px;' +
      'background:#1D6F42;color:#fff;border:none;border-radius:6px;cursor:pointer">⬇ Export CSV</button>' +
      '<span id="fl-row-info" style="font-size:11px;color:var(--muted)"></span>' +
      '</div>' +
      '</div>' +
      '<div id="fl-table-wrap" style="overflow-x:auto;max-height:520px;overflow-y:auto">' +
      '<div style="padding:32px;text-align:center;color:var(--muted);font-size:12px">' +
      'Select partner + period in Dashboard → Load' +
      '</div>' +
      '</div>' +
      '</div>';

  // ── Events ──────────────────────────────────────────────────
  document.getElementById('tab-li').addEventListener('click', function(){ _switchTab('LI'); });
  document.getElementById('tab-mi').addEventListener('click', function(){ _switchTab('MI'); });
  document.getElementById('fl-export-register-btn').addEventListener('click', _openExportModal);
  document.getElementById('fl-export-cancel-btn').addEventListener('click', _closeExportModal);
  document.getElementById('fl-export-download-btn').addEventListener('click', _downloadRegister);
  if (Auth.isAdmin()) {
    if (document.getElementById('fl-upload-btn'))
      document.getElementById('fl-upload-btn').addEventListener('click', _upload);
    if (document.getElementById('fl-map-loan-btn'))
      document.getElementById('fl-map-loan-btn').addEventListener('click', _openMapModal);
    document.getElementById('fl-map-cancel-btn').addEventListener('click', _closeMapModal);
    document.getElementById('fl-map-submit-btn').addEventListener('click', _submitMapping);
    document.getElementById('fl-map-partner').addEventListener('change', _updateMapGuide);
  }
  document.getElementById('fl-dash-btn').addEventListener('click', _loadDashboard);
  document.getElementById('fl-csv-btn').addEventListener('click',  _exportCsv);

  // Period change → auto load dashboard
  document.getElementById('fl-dash-to').addEventListener('change', _loadDashboard);

  // Set default period = last 6 months
  (function() {
    var now   = new Date();
    var toYM  = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    var from  = new Date(now.getFullYear(), now.getMonth()-5, 1);
    var fromYM = from.getFullYear()+'-'+String(from.getMonth()+1).padStart(2,'0');
    document.getElementById('fl-dash-from').value = fromYM;
    document.getElementById('fl-dash-to').value   = toYM;
    // Admin-only upload fields
    var fFrom = document.getElementById('fl-from');
    var fTo   = document.getElementById('fl-to');
    if (fFrom) fFrom.value = fromYM;
    if (fTo)   fTo.value   = toYM;
  })();

  _switchTab('LI');

  // ── Export modal ──────────────────────────────────────────────
  // ── Export Modal (MI only — month select → all 12 partners) ──
  async function _openExportModal() {
    var titleEl = document.getElementById('fl-export-modal-title');
    if (titleEl) titleEl.textContent = '📥 Download MI Float Register';

    var sel = document.getElementById('fl-export-month-sel');
    sel.innerHTML = '<option value="">— Loading months... —</option>';

    // Load months from TATA AIG (most data) as reference for available months
    // User can also type a month manually
    try {
      var res = await API.Float.getMonths('Tata_AIG_MI_GS');
      var months = (res && res.data) ? res.data : [];
      // Also try Go Digit GS if TATA has less
      if (months.length < 3) {
        var res2 = await API.Float.getMonths('Go_Digit_MI_GS');
        if (res2 && res2.data && res2.data.length > months.length) months = res2.data;
      }
      if (months.length) {
        sel.innerHTML = '<option value="">— Select Month —</option>'
            + months.map(function(m){return '<option value="'+m+'">'+m+'</option>';}).join('');
        sel.value = months[months.length-1];  // Default: latest month
      } else {
        sel.innerHTML = '<option value="">— No data uploaded yet —</option>';
      }
    } catch(e) {
      sel.innerHTML = '<option value="">— Error loading months —</option>';
    }

    document.getElementById('fl-export-status').textContent = '';
    document.getElementById('fl-export-modal').style.display = 'flex';
  }

  function _closeExportModal() {
    document.getElementById('fl-export-modal').style.display = 'none';
  }

  async function _downloadRegister() {
    var rawMonth = document.getElementById('fl-export-month-sel').value;
    // Convert 'YYYY-MM' → "Apr'26" format
    var MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var month = rawMonth ? MO[parseInt(rawMonth.split('-')[1])-1]+"'"+String(parseInt(rawMonth.split('-')[0])%100).padStart(2,'0') : '';
    var status = document.getElementById('fl-export-status');
    if (!month) {
      status.textContent = '⚠️ Please select a month first.';
      return;
    }
    var btn = document.getElementById('fl-export-download-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Generating...';
    status.textContent = 'Fetching data for all 12 MI partners from database...';
    try {
      var base = (window.location.hostname==='localhost' || window.location.hostname==='127.0.0.1')
          ? 'http://localhost:8080/api'
          : window.location.origin + '/api';
      var token = localStorage.getItem('finx24_jwt') || '';
      var resp = await fetch(
          base + '/float/export?category=MI&month=' + encodeURIComponent(month),
          { headers: { 'Authorization': 'Bearer ' + token } }
      );
      if (!resp.ok) {
        var msg = 'Export failed: ' + resp.status;
        try { var j = await resp.json(); msg = j.message || msg; } catch(e2){}
        throw new Error(msg);
      }
      var blob = await resp.blob();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'MI_Float_Register_' + month.replace("'","") + '.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      status.textContent = '✅ Downloaded: MI_Float_Register_' + month.replace("'","") + '.xlsx';
      setTimeout(_closeExportModal, 2000);
    } catch(e) {
      status.textContent = '❌ ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '⬇ Download';
    }
  }

  function _switchTab(tab) {
    currentTab = tab;
    document.getElementById('tab-li').style.background = tab==='LI'?'#0B1F3A':'#fff';
    document.getElementById('tab-li').style.color      = tab==='LI'?'#E8B84B':'#0B1F3A';
    document.getElementById('tab-mi').style.background = tab==='MI'?'#0B1F3A':'#fff';
    document.getElementById('tab-mi').style.color      = tab==='MI'?'#E8B84B':'#0B1F3A';
    var utEl = document.getElementById('fl-upload-title'); // admin-only
    if (utEl) utEl.textContent = tab==='LI'?'Upload LI Float':'Upload MI Float';
    document.getElementById('fl-dash-title').textContent = tab==='LI'?'LI Float Dashboard (GL 13126064)':'MI Float Dashboard (GL 13126051)';
    document.getElementById('fl-reg-title').textContent  = tab==='LI'?'LI Float Register':'MI Float Register';
    var expBtn = document.getElementById('fl-export-register-btn');
    if (expBtn) expBtn.style.display = tab==='MI' ? 'flex' : 'none';
    var mapBtn = document.getElementById('fl-map-loan-btn'); // admin-only
    if (mapBtn) mapBtn.textContent = tab==='LI' ? '🔗 Map Loan ID' : '🔗 Map Car Reg No';
    _fillPartners('fl-partner',      tab);
    _fillPartners('fl-dash-partner', tab);
    if (Auth.isAdmin()) _fillMapPartners(tab);
  }

  async function _fillPartners(selId, tab) {
    var sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">— Select Partner —</option>';
    try {
      var res = await API.Float.getPartners(tab);
      var d   = (res&&res.data)?res.data:{};
      var list=[];
      if(tab==='LI'){
        var pts=d.partners||LI_DEFAULT;
        list=(Array.isArray(pts)&&pts.length&&typeof pts[0]==='object')?pts:LI_DEFAULT;
      } else {
        var segs=d.segments||MI_DEFAULT;
        for(var sg in segs)(Array.isArray(segs[sg])?segs[sg]:[]).forEach(function(p){
          list.push(typeof p==='object'?p:{code:p,display:p,gl:''});
        });
      }
      sel.innerHTML='<option value="">— Select Partner —</option>'
          +list.map(function(p){
            return '<option value="'+p.code+'">'+(p.display||p.code)+' (GL: '+p.gl+')</option>';
          }).join('');
    } catch(e){
      var fb=tab==='LI'?LI_DEFAULT:Object.values(MI_DEFAULT).flat();
      sel.innerHTML='<option value="">— Select Partner —</option>'
          +fb.map(function(p){return '<option value="'+p.code+'">'+p.display+'</option>';}).join('');
    }
  }

  // ── UPLOAD ──────────────────────────────────────────────────
  async function _upload() {
    var partner = document.getElementById('fl-partner').value;
    var fromYM  = document.getElementById('fl-from').value;
    var toYM    = document.getElementById('fl-to').value;
    var file    = document.getElementById('fl-file').files[0];
    var msg     = document.getElementById('fl-upload-msg');

    if(!partner){ msg.innerHTML=_alert('warn','Select a partner.'); return; }
    if(!fromYM) { msg.innerHTML=_alert('warn','Select Period From.'); return; }
    if(!file)   { msg.innerHTML=_alert('warn','Select float file.'); return; }

    var fLbl   = toLabel(fromYM);
    var period = toYM&&toYM!==fromYM ? fLbl+' - '+toLabel(toYM) : fLbl;

    var btn=document.getElementById('fl-upload-btn');
    btn.disabled=true; btn.textContent='⏳ Uploading…';
    try {
      var r=await API.Float.upload(file, partner, period, false);
      var d=(r&&r.data)?r.data:{};
      msg.innerHTML=_alert('success',
          '✅ '+d.inserted+' rows | <strong>'+(d.partnerCode||partner)+'</strong>'
          +' | Period: '+period+' | GL: '+(d.glAccount||''));
      document.getElementById('fl-file').value='';
      // Sync dashboard and load
      document.getElementById('fl-dash-partner').value=partner;
      if(fromYM){ document.getElementById('fl-dash-from').value=fromYM; }
      if(toYM||fromYM){ document.getElementById('fl-dash-to').value=toYM||fromYM; }
      _loadDashboard();
    } catch(e){
      msg.innerHTML=e.message&&e.message.includes('already exists')
          ?_alert('warn','⚠️ Data already exists for this date range.')
          :_alert('error','❌ '+e.message);
    } finally{ btn.disabled=false; btn.textContent='⬆ Upload'; }
  }

  // ── DASHBOARD ────────────────────────────────────────────────
  async function _loadDashboard() {
    var partner  = document.getElementById('fl-dash-partner').value;
    var fromYM   = document.getElementById('fl-dash-from').value;
    var toYM     = document.getElementById('fl-dash-to').value;
    var fromLbl  = toLabel(fromYM);
    var toLbl    = toLabel(toYM||fromYM);

    if(!partner){
      document.getElementById('fl-kpi-cards').innerHTML=
          '<div style="grid-column:1/-1">'+_alert('warn','Select a partner.')+'</div>';
      return;
    }

    var badge = document.getElementById('fl-dash-badge');
    badge.textContent = ' · '+partner
        +(fromLbl?' · '+fromLbl+(toLbl&&toLbl!==fromLbl?' → '+toLbl:''):'');

    try {
      // Get all months summary
      var res  = await API.Float.getDashboard(partner, null);
      var d    = (res&&res.data)?res.data:{};
      var summ = (d.summary||[]).sort(function(a,b){
        return monthOrder(a.monthLabel)-monthOrder(b.monthLabel);
      });


      // DB opening balance from FloatDataInitializer (before first transaction)
      var dbOpeningBal = Number(d.initialOpeningBalance||0);

      // Filter to selected period range
      var inRange = function(lbl) {
        if(!fromLbl) return true;
        var o = monthOrder(lbl);
        return o >= monthOrder(fromLbl) && o <= monthOrder(toLbl||fromLbl);
      };

      var rows = fromLbl ? summ.filter(function(r){return inRange(r.monthLabel);}) : summ;

      // Opening balance of period:
      // If months exist BEFORE period → compute running balance up to period start
      // If NO months before period → use DB opening balance (FloatDataInitializer)
      var openingBal = dbOpeningBal;
      if(fromLbl && summ.length) {
        var prevMonths = summ.filter(function(r){
          return monthOrder(r.monthLabel) < monthOrder(fromLbl);
        });
        if(prevMonths.length) {
          var runCb = dbOpeningBal;
          prevMonths.forEach(function(r){
            runCb = runCb + Number(r.topUpCredit||0) + Number(r.cancelCredit||0) - Number(r.totalDebit||0);
          });
          openingBal = runCb;
        }
      }

      var totTopUp  = rows.reduce(function(s,r){return s+Number(r.topUpCredit||0);},0);
      var totCancel = rows.reduce(function(s,r){return s+Number(r.cancelCredit||0);},0);
      var totDebit  = rows.reduce(function(s,r){return s+Number(r.totalDebit||0);},0);
      var totExp    = totDebit - totCancel;
      // Closing = Opening + Top Up + Cancellation Received - Total Debit
      var closBal   = openingBal + totTopUp + totCancel - totDebit;

      // 6 KPI cards
      var kpis=[
        {label:'Opening Balance',       value:INR(openingBal), sub:'Balance before period start', clr:'#0B1F3A'},
        {label:'Top Up (Cr)',           value:INR(totTopUp),   sub:'Manual slip / Online',        clr:'#1D6F42'},
        {label:'Cancellation Received', value:INR(totCancel),  sub:'Other credit entries',        clr:'#1E3F6B'},
        {label:'Total Debit',           value:INR(totDebit),   sub:'Withdrawals in period',       clr:'#5A2D82'},
        {label:'Expense',               value:INR(totExp),     sub:'Debit − Cancellation Rcvd',  clr:totExp<0?'#8B2121':'#C8992A'},
        {label:'Closing Balance',       value:INR(closBal),    sub:'Balance at period end',       clr:closBal<0?'#8B2121':'#C8992A'},
      ];

      var grid=document.getElementById('fl-kpi-cards');
      grid.style.gridTemplateColumns='repeat(6,1fr)';
      grid.innerHTML=kpis.map(function(k){
        return '<div style="background:#fff;border-radius:10px;padding:14px;'
            +'border:1.5px solid rgba(11,31,58,0.08);border-top:3px solid '+k.clr+';'
            +'box-shadow:0 1px 4px rgba(0,0,0,0.04)">'
            +'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#5A6E88;margin-bottom:5px">'+k.label+'</div>'
            +'<div style="font-size:16px;font-weight:700;color:#0B1F3A">'+k.value+'</div>'
            +'<div style="font-size:9px;color:#9AA5B4;margin-top:3px">'+k.sub+'</div>'
            +'</div>';
      }).join('');

      // Month-wise table — last 6 months of selected period
      var ptEl=document.getElementById('fl-month-table');
      if(summ.length){
        // Get period months, show last 6
        var periodMonths = fromLbl
            ? summ.filter(function(r){return inRange(r.monthLabel);})
            : summ;
        var tableMonths = periodMonths.slice(-6);

        // Compute running opening for first table month
        var tableStartOrder = tableMonths.length ? monthOrder(tableMonths[0].monthLabel) : 0;
        var tableOb = dbOpeningBal;
        summ.forEach(function(r){
          if(monthOrder(r.monthLabel) < tableStartOrder) {
            tableOb = tableOb + Number(r.topUpCredit||0) + Number(r.cancelCredit||0) - Number(r.totalDebit||0);
          }
        });

        var tbl='<table class="data-table" style="margin-top:4px"><thead><tr>'
            +'<th>Month</th>'
            +'<th style="text-align:right">Opening Bal</th>'
            +'<th style="text-align:right">Top Up (Cr)</th>'
            +'<th style="text-align:right">Cancel Rcvd</th>'
            +'<th style="text-align:right">Total Debit</th>'
            +'<th style="text-align:right">Expense</th>'
            +'<th style="text-align:right">Closing Bal</th>'
            +'</tr></thead><tbody>';

        var monthOb = tableOb;
        tableMonths.forEach(function(r){
          var topup  = Number(r.topUpCredit||0);
          var cancel = Number(r.cancelCredit||0);
          var debit  = Number(r.totalDebit||0);
          var cb     = monthOb + topup + cancel - debit;
          var exp    = debit - cancel;
          tbl+='<tr>'
              +'<td style="font-weight:500">'+r.monthLabel+'</td>'
              +'<td style="text-align:right">'+INR(monthOb)+'</td>'
              +'<td style="text-align:right;color:#1D6F42">'+INR(topup)+'</td>'
              +'<td style="text-align:right;color:#1E3F6B">'+INR(cancel)+'</td>'
              +'<td style="text-align:right;color:#5A2D82">'+INR(debit)+'</td>'
              +'<td style="text-align:right;color:'+(exp<0?'#8B2121':'#C8992A')+'">'+ INR(exp)+'</td>'
              +'<td style="text-align:right;font-weight:700;color:'+(cb<0?'#8B2121':'#0B1F3A')+'">'+ INR(cb)+'</td>'
              +'</tr>';
          monthOb = cb;
        });
        ptEl.innerHTML=tbl+'</tbody></table>';
      }

      // Auto-load register for the period
      if(fromLbl) _loadRegister(partner, fromLbl, toLbl);

    } catch(e){
      document.getElementById('fl-kpi-cards').innerHTML=
          '<div style="grid-column:1/-1">'+_alert('error','❌ '+e.message)+'</div>';
    }
  }

  // ── REGISTER (100 rows display, full CSV) ────────────────────
  async function _loadRegister(partner, fromLbl, toLbl) {
    var wrap = document.getElementById('fl-table-wrap');
    wrap.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted)">Loading…</div>';

    try {
      // Load month by month for the period, combine
      // For simplicity: load all and filter by monthLabel range
      var res  = await API.Float.getRegister(partner, null);
      var all  = (res&&res.data)?res.data:[];

      // Filter to period
      if(fromLbl) {
        all = all.filter(function(r){
          var o = monthOrder(r.monthLabel);
          return o >= monthOrder(fromLbl) && o <= monthOrder(toLbl||fromLbl);
        });
      }

      _allRows = all;
      var display = all.slice(0, 100);

      if(!display.length){
        wrap.innerHTML='<div style="padding:32px;text-align:center;color:var(--muted);font-size:12px">No data for this period</div>';
        document.getElementById('fl-csv-btn').style.display='none';
        document.getElementById('fl-row-info').textContent='';
        return;
      }

      var loanHdr = currentTab==='LI' ? 'Loan ID' : 'Car Reg No';
      var tbl='<table class="data-table" style="min-width:1000px;font-size:11px">'
          +'<thead><tr>'
          +'<th>Month</th><th>Trans Date</th><th>Float Type</th><th>Booking Type</th>'
          +'<th style="max-width:200px">Transaction Details</th><th>Policy No</th>'
          +'<th>'+loanHdr+'</th>'
          +'<th style="text-align:right">Credit (₹)</th>'
          +'<th style="text-align:right">Debit (₹)</th>'
          +'<th style="text-align:right">Balance (₹)</th>'
          +'</tr></thead><tbody>';

      display.forEach(function(r){
        var bal=Number(r.balance||0);
        var cr=Number(r.creditAmt||0);
        var dr=Number(r.debitAmt||0);
        var hasLoan = r.loanId && r.loanId.trim();
        tbl+='<tr>'
            +'<td style="white-space:nowrap;color:var(--muted);font-size:10px">'+(r.monthLabel||'')+'</td>'
            +'<td style="white-space:nowrap">'+(r.transDate||'')+'</td>'
            +'<td style="white-space:nowrap;font-size:10px">'+(r.floatType||'')+'</td>'
            +'<td style="white-space:nowrap">'+(r.bookingType||'')+'</td>'
            +'<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px" title="'+(r.transactionDetails||'')+'">'+(r.transactionDetails||'')+'</td>'
            +'<td style="font-size:10px">'+(r.policyNumber||'')+'</td>'
            +'<td style="font-size:10px;color:'+(hasLoan?'#0B1F3A':'#C4CADB')+'">'+(hasLoan?r.loanId:'—')+'</td>'
            +'<td style="text-align:right;color:#1D6F42;font-weight:'+(cr>0?'600':'400')+'">'+(cr>0?INR(cr):'')+'</td>'
            +'<td style="text-align:right;color:#8B2121;font-weight:'+(dr>0?'600':'400')+'">'+(dr>0?INR(dr):'')+'</td>'
            +'<td style="text-align:right;font-weight:600;color:'+(bal<0?'#8B2121':'#0B1F3A')+'">'+INR(bal)+'</td>'
            +'</tr>';
      });
      wrap.innerHTML=tbl+'</tbody></table>';

      document.getElementById('fl-csv-btn').style.display='inline-block';
      document.getElementById('fl-row-info').textContent=
          'Showing '+display.length+' of '+all.length+' rows · Full data in CSV';

    } catch(e){ wrap.innerHTML=_alert('error','❌ '+e.message); }
  }

  // ── EXPORT CSV (all rows) ─────────────────────────────────────
  function _exportCsv(){
    if(!_allRows.length) return;
    var keys=['monthLabel','transDate','floatType','bookingType',
      'transactionDetails','policyNumber','loanId',
      'creditAmt','debitAmt','balance'];
    var csv=[keys.join(',')].concat(_allRows.map(function(r){
      return keys.map(function(k){
        var v=r[k]!=null?String(r[k]):'';
        return v.includes(',')?'"'+v+'"':v;
      }).join(',');
    })).join('\n');
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    var p=document.getElementById('fl-dash-partner').value||'Float';
    a.download=p+'_Register.csv';
    a.click();
  }

  // ── LOAN ID / CAR REG NO MAPPING ─────────────────────────────
  function _fillMapPartners(tab) {
    var sel = document.getElementById('fl-map-partner');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select Partner —</option>';
    var list = tab==='LI'
      ? LI_DEFAULT
      : Object.values(MI_DEFAULT).flat().filter(function(p){ return p.code !== 'United_MI_GS'; });
    list.forEach(function(p){
      var opt = document.createElement('option');
      opt.value = p.code;
      opt.textContent = (p.display||p.code) + ' (GL: '+p.gl+')';
      sel.appendChild(opt);
    });
    // Update guide for first option if pre-selected
    _updateMapGuide();
  }

  function _updateMapGuide() {
    var partner = document.getElementById('fl-map-partner').value;
    var guideEl = document.getElementById('fl-map-guide');
    if (!guideEl) return;
    var g = PR_GUIDE[partner];
    if (g) {
      guideEl.innerHTML =
        '<strong style="color:#0B1F3A">Expected PR Register columns:</strong><br>' +
        '📋 Policy Number column: <code style="background:#E8EDF3;padding:1px 5px;border-radius:3px">' + g.pol + '</code><br>' +
        '🔑 ' + g.label + ' column: <code style="background:#E8EDF3;padding:1px 5px;border-radius:3px">' + g.lid + '</code>';
    } else {
      guideEl.textContent = 'Select a partner to see expected PR Register column names.';
    }
  }

  function _openMapModal() {
    var titleEl = document.getElementById('fl-map-modal-title');
    var subEl   = document.getElementById('fl-map-modal-sub');
    if (currentTab === 'LI') {
      if (titleEl) titleEl.textContent = '🔗 Map Loan ID from PR Register';
      if (subEl)   subEl.textContent   = 'Upload PR Register to populate Loan ID in LI float records by matching Policy No → BOOKINGID_PLANID.';
    } else {
      if (titleEl) titleEl.textContent = '🔗 Map Car Reg No from PR Register';
      if (subEl)   subEl.textContent   = 'Upload PR Register to populate Car Reg No in MI float records by matching Policy No → Vehicle Reg No. (United is excluded — its float already contains reg no.)';
    }
    _fillMapPartners(currentTab);
    // Default month = current dashboard period end
    var mVal = document.getElementById('fl-dash-to').value;
    var mapMonth = document.getElementById('fl-map-month');
    if (mapMonth && mVal) mapMonth.value = mVal;
    var fileEl = document.getElementById('fl-map-file');
    if (fileEl) fileEl.value = '';
    document.getElementById('fl-map-status').textContent = '';
    document.getElementById('fl-map-modal').style.display = 'flex';
  }

  function _closeMapModal() {
    document.getElementById('fl-map-modal').style.display = 'none';
  }

  async function _submitMapping() {
    var partner   = document.getElementById('fl-map-partner').value;
    var monthRaw  = document.getElementById('fl-map-month').value;    // "YYYY-MM" or ""
    var file      = document.getElementById('fl-map-file').files[0];
    var status    = document.getElementById('fl-map-status');
    var btn       = document.getElementById('fl-map-submit-btn');

    if (!partner) { status.innerHTML = _alert('warn','⚠️ Select a partner.'); return; }
    if (!file)    { status.innerHTML = _alert('warn','⚠️ Select a PR Register file.'); return; }

    // Convert "YYYY-MM" → "Apr'26" label if provided
    var monthLabel = '';
    if (monthRaw) {
      var parts = monthRaw.split('-');
      monthLabel = MO[parseInt(parts[1])-1] + "'" + String(parseInt(parts[0])%100).padStart(2,'0');
    }

    btn.disabled = true;
    btn.textContent = '⏳ Mapping…';
    status.innerHTML = _alert('warn','⏳ Parsing PR Register and updating float records...');

    try {
      var r = await API.Float.mapLoanId(file, partner, monthLabel||null);
      var d = (r && r.data) ? r.data : {};
      var mapCount = d.mapped   || 0;
      var notFound = d.notFound || 0;
      var prRows   = d.prRows   || 0;
      var total    = d.floatRows|| 0;
      status.innerHTML = _alert('success',
        '✅ Mapping complete for <strong>' + partner + '</strong>'
        + (monthLabel ? ' · Month: '+monthLabel : ' · All months')
        + '<br>PR Register entries: <strong>'+prRows+'</strong>'
        + ' · Float rows scanned: <strong>'+total+'</strong>'
        + ' · <span style="color:#1D6F42">Mapped: <strong>'+mapCount+'</strong></span>'
        + ' · <span style="color:#8A6010">Not found: <strong>'+notFound+'</strong></span>'
      );
      // Reload register to show updated loanId values
      if (mapCount > 0) {
        var dashPartner = document.getElementById('fl-dash-partner').value;
        if (dashPartner === partner) {
          var fromLbl = toLabel(document.getElementById('fl-dash-from').value);
          var toLbl   = toLabel(document.getElementById('fl-dash-to').value);
          _loadRegister(partner, fromLbl, toLbl);
        }
      }
    } catch(e) {
      status.innerHTML = _alert('error', '❌ ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔗 Map Now';
    }
  }

  function _alert(type,msg){
    var c={success:{bg:'#D9F0D9',br:'#a0d9a0',tx:'#1D6F42'},
          error:  {bg:'#FFE0E0',br:'#f5c6c6',tx:'#8B2121'},
          warn:   {bg:'#FFF3CD',br:'#F0C040',tx:'#8A6010'}}[type]
        ||{bg:'#FFF3CD',br:'#F0C040',tx:'#8A6010'};
    return '<div style="background:'+c.bg+';border:1px solid '+c.br+';border-radius:8px;padding:10px 14px;font-size:12px;color:'+c.tx+'">'+msg+'</div>';
  }
});