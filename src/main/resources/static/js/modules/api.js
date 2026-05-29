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
      res = await fetch(url, opts);
    } catch (err) {
      // Network error (backend not running, CORS, etc.)
      throw new Error('Cannot reach server. Make sure Spring Boot is running on port 8080.');
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

    // ── Loan Insurance ────────────────────────────────────────────
    async runLoanIns({ floatFile, prFiles, hanaFile, monthlyDRFiles,
                       monthLabel, reconMode, rangeStart, rangeEnd }) {
      const form = new FormData();
      form.append('floatFile', floatFile);
      prFiles.forEach(f         => form.append('prFiles',        f));
      if (hanaFile)              form.append('hanaFile',         hanaFile);
      if (monthlyDRFiles?.length)
        monthlyDRFiles.forEach(f => form.append('monthlyDRFiles', f));
      form.append('monthLabel',  monthLabel);
      form.append('reconMode',   reconMode  || 'month');
      if (rangeStart) form.append('rangeStart', rangeStart);
      if (rangeEnd)   form.append('rangeEnd',   rangeEnd);
      return upload('/recon/loan-insurance/run', form);
    },

    downloadLoanIns(reconId) {
      // Direct browser download — attach token via URL param (one-time)
      window.open(`${BASE_URL}/recon/loan-insurance/download/${reconId}
        ?token=${getToken()}`);
    },

    getLoanInsHistory: (page = 0, size = 10) =>
        get(`/recon/loan-insurance/history?page=${page}&size=${size}`),

    // ── Motor Insurance ───────────────────────────────────────────
    async runMotor({ floatFile, monthLabel, prFiles, hanaFile, monthlyDRFiles,
                     selfFile, insMasterFile, fulfilFile, dcfFile }) {
      const form = new FormData();
      form.append('floatFile',  floatFile);
      form.append('monthLabel', monthLabel);
      prFiles?.forEach(f => form.append('prFiles', f));
      if (hanaFile)       form.append('hanaFile',       hanaFile);
      if (selfFile)       form.append('selfFile',       selfFile);
      if (insMasterFile)  form.append('insMasterFile',  insMasterFile);
      if (fulfilFile)     form.append('fulfilFile',     fulfilFile);
      if (dcfFile)        form.append('dcfFile',        dcfFile);
      monthlyDRFiles?.forEach(f => form.append('monthlyDRFiles', f));
      return upload('/recon/motor/run', form);
    },

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
  const Float = {
    upload: async function(file, category, partnerCode, period) {
      const form = new FormData();
      form.append('file',        file);
      form.append('category',    category);
      form.append('partnerCode', partnerCode);
      form.append('period',      period);
      return upload('/float/upload', form);
    },
    uploadMaster: async function(file, period) {
      const form = new FormData();
      form.append('file',   file);
      form.append('period', period);
      return upload('/float/upload-master', form);
    },
    getRegister: async function(category, partner, period) {
      let q = 'category=' + category;
      if (partner) q += '&partner=' + encodeURIComponent(partner);
      if (period)  q += '&period='  + encodeURIComponent(period);
      return get('/float/register?' + q);
    },
    getPeriods: async function(category) {
      return get('/float/periods?category=' + category);
    },
    getDashboard: async function(category, period) {
      let q = 'category=' + category;
      if (period) q += '&period=' + encodeURIComponent(period);
      return get('/float/dashboard?' + q);
    },
    getPartners: async function(category) {
      return get('/float/partners?category=' + category);
    },
  };

  return {
    getToken, setToken, clearToken, hasToken,
    upload,                            // expose for direct use
    get, post, put, del,               // expose HTTP methods
    Auth, Admin, Recon, Disbursal, Float,
  };

})();