/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/app.js
 * Version     : 2.0.0 — Auth layer added
 * ================================================================
 */

/* ── UI helpers (global) ─────────────────────────────────────── */
const UI = {
  tag(status, label) {
    const map = {
      matched: { cls:'tag-matched', text:'Matched' },
      open:    { cls:'tag-open',    text:'Open'    },
      partial: { cls:'tag-partial', text:'Partial' },
      pending: { cls:'tag-pending', text:'Pending' },
      cleared: { cls:'tag-cleared', text:'Cleared' },
      draft:   { cls:'tag-draft',   text:'Draft'   },
    };
    const entry = map[status?.toLowerCase()] || map.draft;
    return `<span class="tag ${entry.cls}">${label || entry.text}</span>`;
  },
  inr(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  },
  inrShort(n) {
    if (n >= 10000000) return '₹' + (n/10000000).toFixed(2) + ' Cr';
    if (n >= 100000)   return '₹' + (n/100000).toFixed(2) + ' L';
    return UI.inr(n);
  },
};

function exportCurrent() {
  alert('Export coming soon — will generate Excel/PDF for the active module.');
}
function newEntry() {
  alert('New entry form coming soon.');
}

/* ── App init ────────────────────────────────────────────────── */
(function init() {

  // ── 1. Auth check — show login page if not logged in ──────────
  // Also clear stale sessions from before auth was added
  // (sessions without JWT token are invalid)
  if (!API.hasToken()) {
    // Clear any old sessionStorage-only sessions
    sessionStorage.removeItem('finrecon_session');
  }
  if (!Auth.isLoggedIn()) {
    Auth.showLoginPage();
    return;
  }


  // ── Apply role-based body class (content area color) ──────────
  const _sess = Auth.getSession();
  if (_sess) {
    document.body.classList.remove('role-admin', 'role-user');
    document.body.classList.add(_sess.role === 'admin' ? 'role-admin' : 'role-user');
  }

  // ── 2. Role-guard Router.go ────────────────────────────────────
  // Wrap Router.go so users cannot navigate to pages they can't access
  const _origGo = Router.go.bind(Router);
  Router.go = function(pageId) {
    if (!Auth.canAccess(pageId)) {
      console.warn('[Auth] Access denied:', pageId);
      return;
    }
    _origGo(pageId);
  };

  // ── 3. Date in topbar ──────────────────────────────────────────
  const dateEl = document.getElementById('date-b');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday:'short', day:'numeric', month:'short', year:'numeric',
    });
  }

  // ── 4. User chip in topbar ────────────────────────────────────
  const tbRight = document.querySelector('.tb-right');
  if (tbRight) {
    const chip = document.createElement('div');
    chip.innerHTML = Auth.buildTopbarUser();
    // Insert before Export button
    tbRight.insertBefore(chip, tbRight.firstChild);
  }

  // ── 5. Build sidebar (admin gets extra item) ──────────────────
  Sidebar.build();

  // If admin — add Admin Panel nav item dynamically
  if (Auth.isAdmin()) {
    const sidebar = document.getElementById('sidebar');
    const adminSection = document.createElement('div');
    adminSection.className = 'sidebar-section';
    adminSection.innerHTML = `
      <div class="sidebar-section-label">Administration</div>
      <div class="nav-item" data-page="admin">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L2 4v4c0 3.31 2.69 6 6 7 3.31-1 6-3.69 6-7V4L8 1z"
                stroke="currentColor" stroke-width="1.2"/>
          <path d="M5.5 8l1.5 1.5 3-3" stroke="currentColor" stroke-width="1.2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Admin Panel
      </div>
    `;
    // Insert before sidebar-footer
    const footer = sidebar.querySelector('.sidebar-footer');
    sidebar.insertBefore(adminSection, footer);
    // Wire click
    adminSection.querySelector('.nav-item').addEventListener('click', () => Router.go('admin'));
  }

  // ── 6. Navigate to dashboard ───────────────────────────────────
  _origGo('dashboard');

})();