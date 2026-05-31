/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/auth.js
 * Description : Authentication layer — Login page, session
 *               management, role-based access control.
 *
 *               Roles:
 *                 user  — run recon, view reports, download output
 *                 admin — everything user can do + data management,
 *                         user management, DB integration (Phase 2)
 *
 *               Credentials (hardcoded for Phase 1 — DB in Phase 2)
 *
 * Author      : Jatin Mittal
 * Email       : jatin.mittal@cars24.com
 * ================================================================
 */

const Auth = (() => {

  // ── Phase 1 credentials (replace with DB call in Phase 2) ──────
  const USERS = [
    { username: 'admin',  password: 'Admin@2024', role: 'admin',
      name: 'Jatin Mittal',     initials: 'JM', designation: 'Finance Head' },
    { username: 'user1',  password: 'User@2024',  role: 'user',
      name: 'Finance User',     initials: 'FU', designation: 'Accounts Team' },
    { username: 'recon',  password: 'Recon@2024', role: 'user',
      name: 'Recon Analyst',    initials: 'RA', designation: 'Recon Team'   },
  ];

  const SESSION_KEY = 'finrecon_session';

  // ── Pages accessible per role ────────────────────────────────────
  const ROLE_ACCESS = {
    user:  ['dashboard', 'bank', 'motor', 'loanins', 'disbursal', 'schedules', 'li-schedule', 'pocket-ins-schedule', 'float-register'],
    admin: '*',
  };

  // ── Admin-only actions (UI elements hidden from user role) ───────
  const ADMIN_ACTIONS = [
    'modify-data', 'manage-users', 'db-settings', 'export-all', 'delete-records',
  ];

  // ─────────────────────────────────────────────────────────────────
  //  SESSION
  // ─────────────────────────────────────────────────────────────────
  // Phase 1: kept as fallback if backend unreachable
  // Phase 2: remove this entirely — API.Auth.login() is the only path
  function login(username, password) {
    const u = USERS.find(
        x => x.username.toLowerCase() === username.toLowerCase() &&
            x.password === password
    );
    if (!u) return { ok: false, error: 'Invalid username or password.' };
    const session = {
      username:    u.username,
      name:        u.name,
      initials:    u.initials,
      designation: u.designation,
      role:        u.role,
      loginTime:   new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    API.Auth.logout();   // clears JWT token + reloads
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function isLoggedIn()  { return !!getSession(); }
  function isAdmin()     { return getSession()?.role === 'admin'; }
  function getRole()     { return getSession()?.role || null; }
  function getName()     { return getSession()?.name || ''; }
  function getInitials() { return getSession()?.initials || '??'; }

  function canAccess(pageId) {
    const s = getSession();
    if (!s) return false;
    // Normalize role in case of stale session
    const role    = (s.role || 'user').toLowerCase().replace('role_','');
    const allowed = ROLE_ACCESS[role] || ROLE_ACCESS['user'];
    if (allowed === '*') return true;   // admin sees all
    return Array.isArray(allowed) && allowed.includes(pageId);
  }

  function canDoAction(action) {
    return isAdmin();
  }

  // ─────────────────────────────────────────────────────────────────
  //  LOGIN PAGE
  // ─────────────────────────────────────────────────────────────────
  function showLoginPage() {
    document.body.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: #0B1F3A;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-wrap {
          width: 100%;
          min-height: 100vh;
          display: flex;
        }
        /* Left panel — branding */
        .login-left {
          flex: 1;
          background: linear-gradient(160deg, #0B1F3A 0%, #152E50 60%, #1E3F6B 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px;
          position: relative;
          overflow: hidden;
        }
        .login-left::before {
          content: '';
          position: absolute;
          width: 400px; height: 400px;
          border-radius: 50%;
          background: rgba(200,153,42,0.06);
          top: -100px; right: -100px;
        }
        .login-left::after {
          content: '';
          position: absolute;
          width: 300px; height: 300px;
          border-radius: 50%;
          background: rgba(200,153,42,0.04);
          bottom: -80px; left: -80px;
        }
        .brand-logo {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          color: #E8B84B;
          font-weight: 600;
          margin-bottom: 8px;
          position: relative;
          z-index: 1;
        }
        .brand-sub {
          font-size: 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          margin-bottom: 56px;
          position: relative;
          z-index: 1;
        }
        .brand-tagline {
          font-size: 28px;
          color: #fff;
          font-weight: 300;
          line-height: 1.4;
          max-width: 400px;
          margin-bottom: 48px;
          position: relative;
          z-index: 1;
        }
        .brand-tagline strong { color: #E8B84B; font-weight: 500; }
        .brand-features {
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
          z-index: 1;
        }
        .brand-feature {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: rgba(255,255,255,0.6);
        }
        .brand-feature-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #C8992A;
          flex-shrink: 0;
        }

        /* Right panel — login form */
        .login-right {
          width: 460px;
          flex-shrink: 0;
          background: #FAF7F0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 48px;
        }
        .login-title {
          font-family: 'Playfair Display', serif;
          font-size: 26px;
          color: #0B1F3A;
          font-weight: 500;
          margin-bottom: 6px;
        }
        .login-subtitle {
          font-size: 13px;
          color: #5A6E88;
          margin-bottom: 40px;
        }

        /* Role tabs */
        .role-tabs {
          display: flex;
          background: rgba(11,31,58,0.07);
          border-radius: 8px;
          padding: 4px;
          margin-bottom: 32px;
        }
        .role-tab {
          flex: 1;
          padding: 9px;
          border-radius: 6px;
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #5A6E88;
          transition: all 0.2s;
          user-select: none;
        }
        .role-tab.active {
          background: #0B1F3A;
          color: #E8B84B;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        /* Form */
        .form-group { margin-bottom: 20px; }
        .form-group label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #5A6E88;
          margin-bottom: 6px;
        }
        .form-group input {
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid rgba(11,31,58,0.15);
          border-radius: 8px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: #0B1F3A;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-group input:focus { border-color: #C8992A; }
        .form-group input::placeholder { color: #aab4be; }

        .login-btn {
          width: 100%;
          padding: 13px;
          background: #0B1F3A;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          margin-top: 8px;
          transition: background 0.15s, transform 0.1s;
          letter-spacing: 0.3px;
        }
        .login-btn:hover   { background: #152E50; }
        .login-btn:active  { transform: scale(0.99); }
        .login-btn.admin-btn { background: #C8992A; }
        .login-btn.admin-btn:hover { background: #b8891a; }

        .login-error {
          background: #fdeaea;
          border: 1px solid #f5c6c6;
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 12px;
          color: #8B2121;
          margin-bottom: 18px;
          display: none;
        }

        .demo-hint {
          margin-top: 28px;
          padding: 14px;
          background: rgba(11,31,58,0.05);
          border-radius: 8px;
          font-size: 11px;
          color: #5A6E88;
          line-height: 1.7;
        }
        .demo-hint strong { color: #0B1F3A; }
        .demo-row { display: flex; justify-content: space-between; }

        @media (max-width: 860px) {
          .login-left  { display: none; }
          .login-right { width: 100%; padding: 40px 28px; }
        }
      </style>

      <div class="login-wrap">

        <!-- Left: Branding -->
        <div class="login-left">
          <div class="brand-logo">FinRecon Pro</div>
          <div class="brand-sub">NBFC Finance Suite</div>
          <div class="brand-tagline">
            Smarter reconciliation.<br>
            <strong>Faster month-end close.</strong>
          </div>
          <div class="brand-features">
            <div class="brand-feature">
              <div class="brand-feature-dot"></div>
              Motor Insurance — Full L1 + L2 Reconciliation
            </div>
            <div class="brand-feature">
              <div class="brand-feature-dot"></div>
              Loan Insurance — Float vs PR vs SAP HANA
            </div>
            <div class="brand-feature">
              <div class="brand-feature-dot"></div>
              Bank Reconciliation — Multi-account
            </div>
            <div class="brand-feature">
              <div class="brand-feature-dot"></div>
              Disbursal Report — KPIs &amp; Breakdowns
            </div>
            <div class="brand-feature">
              <div class="brand-feature-dot"></div>
              Monthly Schedules — Accrual Tracking
            </div>
          </div>
        </div>

        <!-- Right: Login form -->
        <div class="login-right">
          <div class="login-title">Welcome back</div>
          <div class="login-subtitle">Sign in to your FinRecon Pro account</div>

          <!-- Role selector -->
          <div class="role-tabs">
            <div class="role-tab active" id="tab-user"  onclick="Auth._switchTab('user')">
              👤 &nbsp;User Login
            </div>
            <div class="role-tab"        id="tab-admin" onclick="Auth._switchTab('admin')">
              🛡️ &nbsp;Admin Login
            </div>
          </div>

          <!-- Error message -->
          <div class="login-error" id="login-error"></div>

          <!-- Form -->
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="login-username" placeholder="Enter username"
                   autocomplete="username" onkeydown="if(event.key==='Enter') Auth._doLogin()">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="login-password" placeholder="Enter password"
                   autocomplete="current-password" onkeydown="if(event.key==='Enter') Auth._doLogin()">
          </div>

          <button class="login-btn" id="login-btn" onclick="Auth._doLogin()">
            Sign In
          </button>

          <!-- Demo credentials hint -->
          <div class="demo-hint">
            <div class="demo-row"><span><strong>User login</strong></span><span>user1 / User@2024</span></div>
            <div class="demo-row"><span><strong>Admin login</strong></span><span>admin / Admin@2024</span></div>
          </div>
        </div>

      </div>
    `;
  }

  // ── Tab switch (User / Admin) ───────────────────────────────────
  function _switchTab(role) {
    document.getElementById('tab-user').classList.toggle('active',  role === 'user');
    document.getElementById('tab-admin').classList.toggle('active', role === 'admin');
    const btn = document.getElementById('login-btn');
    btn.className = role === 'admin' ? 'login-btn admin-btn' : 'login-btn';
    btn.dataset.role = role;
    document.getElementById('login-error').style.display = 'none';
  }

  // ── Login handler — calls Spring Boot API ───────────────────────
  async function _doLogin() {
    const username = document.getElementById('login-username')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const tabRole  = document.getElementById('tab-admin')?.classList.contains('active')
        ? 'ADMIN' : 'USER';
    const errEl    = document.getElementById('login-error');
    const btn      = document.getElementById('login-btn');

    if (!username || !password) {
      errEl.textContent = 'Please enter both username and password.';
      errEl.style.display = 'block';
      return;
    }

    // Loading state
    btn.disabled    = true;
    btn.textContent = 'Signing in…';
    errEl.style.display = 'none';

    try {
      // ── Real API call to Spring Boot ──────────────────────────
      const userData = await API.Auth.login(username, password, tabRole);

      // Store session in sessionStorage (same as before for app.js compatibility)
      const session = {
        username:    userData.username,
        name:        userData.fullName,
        initials:    userData.initials,
        designation: userData.designation,
        role:        (function(r) {
          // Normalize: 'ADMIN', 'ROLE_ADMIN', 'admin' → 'admin'
          if (!r) return 'user';
          var norm = r.toLowerCase().replace('role_','');
          return (norm === 'admin') ? 'admin' : 'user';
        })(userData.role),
        loginTime:   new Date().toISOString(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

      // Reload → app.js picks up session
      window.location.reload();

    } catch (err) {
      errEl.textContent = err.message || 'Login failed. Please try again.';
      errEl.style.display = 'block';
      document.getElementById('login-password').value = '';
      btn.disabled    = false;
      btn.textContent = tabRole === 'ADMIN' ? 'Sign In' : 'Sign In';
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  TOPBAR USER CHIP
  // ─────────────────────────────────────────────────────────────────
  function buildTopbarUser() {
    const s = getSession();
    if (!s) return '';
    const roleLabel = s.role === 'admin'
        ? '<span style="background:#C8992A;color:#fff;font-size:9px;padding:1px 6px;border-radius:8px;font-weight:600;letter-spacing:.5px;margin-left:6px">ADMIN</span>'
        : '<span style="background:rgba(11,31,58,0.12);color:#0B1F3A;font-size:9px;padding:1px 6px;border-radius:8px;font-weight:500;letter-spacing:.5px;margin-left:6px">USER</span>';
    return `
      <div style="display:flex;align-items:center;gap:8px;cursor:pointer"
           onclick="Auth._showUserMenu(this)" title="Account options">
        <div style="width:30px;height:30px;border-radius:50%;background:#0B1F3A;
                    border:2px solid #C8992A;display:flex;align-items:center;
                    justify-content:center;font-size:10px;font-weight:600;
                    color:#E8B84B;flex-shrink:0">${s.initials}</div>
        <div style="display:flex;flex-direction:column;line-height:1.2">
          <span style="font-size:12px;font-weight:500;color:#0B1F3A">${s.name}</span>
          <span style="font-size:10px;color:#5A6E88">${s.designation}</span>
        </div>
        ${roleLabel}
      </div>
    `;
  }

  function _showUserMenu(el) {
    // Remove existing menu
    document.getElementById('user-menu-popup')?.remove();
    const menu = document.createElement('div');
    menu.id = 'user-menu-popup';
    menu.style.cssText = `
      position:fixed;right:20px;top:56px;
      background:#fff;border:1px solid rgba(11,31,58,0.12);
      border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);
      z-index:999;min-width:200px;padding:6px 0;
      font-family:'DM Sans',sans-serif;
    `;
    const s = getSession();
    menu.innerHTML = `
      <div style="padding:10px 16px 8px;border-bottom:1px solid rgba(11,31,58,0.08)">
        <div style="font-size:12px;font-weight:600;color:#0B1F3A">${s.name}</div>
        <div style="font-size:10px;color:#5A6E88;margin-top:2px">${s.role.toUpperCase()} · Logged in ${_timeAgo(s.loginTime)}</div>
      </div>
      ${isAdmin() ? `
      <div onclick="Router.go('admin');document.getElementById('user-menu-popup')?.remove()"
           style="padding:9px 16px;font-size:12px;color:#0B1F3A;cursor:pointer;
                  display:flex;align-items:center;gap:8px"
           onmouseover="this.style.background='rgba(11,31,58,0.04)'"
           onmouseout="this.style.background=''"
      >🛡️ &nbsp;Admin Panel</div>` : ''}
      <div onclick="Auth.logout()"
           style="padding:9px 16px;font-size:12px;color:#B23A3A;cursor:pointer;
                  display:flex;align-items:center;gap:8px;border-top:1px solid rgba(11,31,58,0.06);margin-top:4px"
           onmouseover="this.style.background='#fdeaea'"
           onmouseout="this.style.background=''"
      >↩ &nbsp;Sign Out</div>
    `;
    document.body.appendChild(menu);
    // Close on outside click
    setTimeout(() => document.addEventListener('click', function _close(e) {
      if (!menu.contains(e.target) && !el.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', _close);
      }
    }), 10);
  }

  function _timeAgo(isoStr) {
    const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000);
    if (diff < 1)  return 'just now';
    if (diff < 60) return diff + 'm ago';
    return Math.floor(diff/60) + 'h ago';
  }

  // ─────────────────────────────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────────────────────────────
  return {
    login, logout, getSession,
    isLoggedIn, isAdmin, getRole, getName, getInitials,
    canAccess, canDoAction,
    showLoginPage, buildTopbarUser,
    _switchTab, _doLogin, _showUserMenu,
  };

})();