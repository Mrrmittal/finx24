/**
 * ================================================================
 * FinX24 — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/api.js
 * Description : Central API service — all backend calls go here.
 *               - Auto-attaches JWT token to every request
 *               - Handles 401 (token expired → redirect to login)
 *               - Consistent error handling
 *               - Base URL config for dev vs prod
 *
 * Author      : Jatin Mittal | jatin.mittal@cars24.com
 * ================================================================
 */

const API = (() => {

  // ── Config ─────────────────────────────────────────────────────
  // Auto-detect: relative path when served from Spring Boot,
  // absolute when using Live Server
  const BASE_URL = window.location.port === '8080'
      ? '/api'                          // served from Spring Boot → relative
      : 'http://localhost:8080/api';    // Live Server → absolute
  const TOKEN_KEY  = 'finx24_jwt';

  // ── Token helpers ───────────────────────────────────────────────
  function getToken()        { return localStorage.getItem(TOKEN_KEY); }
  function setToken(token)   { localStorage.setItem(TOKEN_KEY, token); }
  function clearToken()      { localStorage.removeItem(TOKEN_KEY); }
  function hasToken()        { return !!getToken(); }

  // ── Build headers ───────────────────────────────────────────────
  function _headers(isMultipart = false) {
    const h = {};
    // Only attach Authorization if token exists — never send "Bearer null"
    const token = getToken();
    if (token) h['Authorization'] = 'Bearer ' + token;
    if (!isMultipart) h['Content-Type'] = 'application/json';
    return h;
  }

  // ── Core fetch wrapper ──────────────────────────────────────────
  async function _fetch(method, path, body = null, isMultipart = false) {
    const url  = BASE_URL + path;
    const opts = {
      method,
      headers: _headers(isMultipart),
    };
    if (body) opts.body = isMultipart ? body : JSON.stringify(body);

    let res;
    try {
      // For file uploads add AbortController with 5 min timeout
      const isUpload = isMultipart && method === 'POST';
      if (isUpload) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5 * 60 * 1000); // 5 min
        opts.signal = ctrl.signal;
        try {
          res = await fetch(url, opts);
        } finally {
          clearTimeout(timer);
        }
      } else {
        res = await fetch(url, opts);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Upload timed out (>5 min). Try uploading a smaller date range.');
      }
      // Log actual error for debugging
      console.error('[API] Fetch error:', err.name, err.message, 'URL:', url);
      throw new Error(
          err.message && err.message !== 'Failed to fetch'
              ? err.message
              : 'Cannot reach server. Check: (1) Spring Boot running on 8080 (2) Browser console for errors'
      );
    }

    // 401 → token expired or invalid → re-login
    if (res.status === 401) {
      clearToken();
      window.location.reload();
      return;
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = json?.message || `Server error (${res.status})`;
      throw new Error(msg);
    }
    return json;   // { success, data, message, timestamp }
  }

  // ── HTTP methods ────────────────────────────────────────────────
  const get    = (path)         => _fetch('GET',    path);
  const post   = (path, body)   => _fetch('POST',   path, body);
  const put    = (path, body)   => _fetch('PUT',    path, body);
  const del    = (path)         => _fetch('DELETE', path);
  const upload = (path, form)   => _fetch('POST',   path, form, true);

  // ================================================================
  //  AUTH ENDPOINTS
  // ================================================================
  const Auth = {

    async login(username, password, expectedRole) {
      const res = await post('/auth/login', { username, password, expectedRole });
      setToken(res.data.token);
      return res.data;   // { token, username, fullName, initials, designation, role }
    },

    async logout() {
      try { await post('/auth/logout'); } catch (_) {}
      clearToken();
      window.location.reload();
    },
  };

  // ================================================================
  //  ADMIN ENDPOINTS
  // ================================================================
  const Admin = {
    listUsers:      ()              => get('/admin/users'),
    createUser:     (data)          => post('/admin/users', data),
    deactivateUser: (id)            => del(`/admin/users/${id}`),
    systemInfo:     ()              => get('/admin/system'),
  };

  // ================================================================
  //  RECON ENDPOINTS
  // ================================================================
  const Recon = {

    // ── NOTE ──────────────────────────────────────────────────────
    // LI and MI recon logic runs 100% client-side (page.recon-li.js,
    // page.recon-mi.js). Files are processed via SheetJS in the browser.
    // DB data (SAP HANA equivalent + Loan Status) via:
    //   API.Disbursal.getReconData()  →  GET /disbursal/recon-data
    //
    // These endpoints are kept for future backend migration if needed.
    // ─────────────────────────────────────────────────────────────

    // ── Loan Insurance (future use) ───────────────────────────────
    getLoanInsHistory: (page = 0, size = 10) =>
        get(`/recon/loan-insurance/history?page=${page}&size=${size}`),

    // ── Motor Insurance (future use) ─────────────────────────────
    // placeholder

    // ── Bank Recon ────────────────────────────────────────────────
    async runBank({ ledgerFile, bankFile }) {
      const form = new FormData();
      form.append('ledgerFile', ledgerFile);
      form.append('bankFile',   bankFile);
      return upload('/recon/bank/run', form);
    },
  };

  // ================================================================
  //  DISBURSAL ENDPOINTS
  // ================================================================
  const Disbursal = {

    // Admin: upload Excel to database
    async uploadReport(file) {
      const form = new FormData();
      form.append('file', file);
      return upload('/disbursal/upload', form);
    },

    // User: get dashboard for period
    getDashboard: (from, to) =>
        get(`/disbursal/dashboard?from=${from}&to=${to}`),

    // User: get available months for calendar
    getAvailableMonths: () =>
        get('/disbursal/available-months'),

    // LI Recon: get all records from DB (replaces SAP HANA + Monthly DR uploads)
    getReconData: () =>
        get('/disbursal/recon-data'),

    // User: export Excel (opens download)
    exportExcel(from, to) {
      const token = getToken();
      window.open(`${BASE_URL}/disbursal/export?from=${from}&to=${to}` +
          (token ? `&token=${token}` : ''), '_blank');
    },

    // Legacy browser-side run (SheetJS)
    async run({ file, sheet }) {
      const form = new FormData();
      form.append('file', file);
      if (sheet !== undefined) form.append('sheet', sheet);
      return upload('/disbursal/run', form);
    },

    download: (reportId) =>
        window.open(`${BASE_URL}/disbursal/download/${reportId}?token=${getToken()}`),
  };

  // ── Public API ──────────────────────────────────────────────────

  // ── Float Register API ──────────────────────────────────────────
  const PocketInsurance = {
    preview: async function(from, to, label) {
      var q = 'from='+from+'&to='+to+'&monthLabel='+encodeURIComponent(label);
      return get('/schedules/pocket-insurance/preview?'+q);
    },
  };

  const Float = {
    upload: async function(file, partnerCode, period, overwrite) {
      const form = new FormData();
      form.append('file',        file);
      form.append('partnerCode', partnerCode);
      form.append('period',      period);
      if (overwrite) form.append('overwrite', 'true');
      return upload('/float/upload', form);
    },
    uploadMaster: async function(file, period, overwrite) {
      const form = new FormData();
      form.append('file',   file);
      form.append('period', period);
      if (overwrite) form.append('overwrite', 'true');
      return upload('/float/upload-master', form);
    },
    getRegister: async function(partnerCode, month) {
      var q = 'partnerCode=' + encodeURIComponent(partnerCode);
      if (month) q += '&month=' + encodeURIComponent(month);
      return get('/float/register?' + q);
    },
    getPeriods: async function(category) {
      return get('/float/periods?category=' + category);
    },
    getDashboard: async function(partnerCode, month) {
      var q = 'partnerCode=' + encodeURIComponent(partnerCode);
      if (month) q += '&month=' + encodeURIComponent(month);
      return get('/float/dashboard?' + q);
    },
    exportRegister: function(month) {
      // Returns download URL for MI Float Register Excel
      var base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? 'http://localhost:8080/api'
          : window.location.origin + '/api';
      return base + '/float/export?month=' + encodeURIComponent(month)
          + '&token=' + encodeURIComponent(localStorage.getItem('finx24_token') || '');
    },
    getPartners: async function(category) {
      return get('/float/partners?category=' + category);
    },
    getMonths: async function(partnerCode) {
      return get('/float/months?partnerCode=' + encodeURIComponent(partnerCode));
    },
    mapLoanId: async function(file, partnerCode, monthLabel) {
      const form = new FormData();
      form.append('file',        file);
      form.append('partnerCode', partnerCode);
      if (monthLabel) form.append('monthLabel', monthLabel);
      return upload('/float/map-loan-id', form);
    },
  };

  return {
    getToken, setToken, clearToken, hasToken,
    upload,                            // expose for direct use
    get, post, put, del,               // expose HTTP methods
    Auth, Admin, Recon, Disbursal, Float,
  };

})();