/**
 * ================================================================
 * FINX24 — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/sidebar.js
 * Description : Builds the sidebar entirely from a JS config array
 *               (NAV_CONFIG). Generates logo block, grouped nav
 *               sections with inline SVG icons, and the user footer.
 *               Call Sidebar.build() once on app init. Adding a new
 *               nav item only requires editing NAV_CONFIG — no HTML
 *               changes needed.
 *
 * Author      : Jatin Mittal
 * Email       : jatin.mittal@cars24.com
 * Version     : 1.0.0
 * Created     : April 2024
 * ================================================================
 */

const Sidebar = (() => {

  const NAV_CONFIG = [
    {
      section: 'Overview',
      items: [
        { id:'dashboard', label:'Dashboard', icon:iconDashboard() },
      ],
    },
    {
      section: 'Reconciliation',
      items: [
        { id:'bank',     label:'Bank Recon',        icon:iconBank() },
        { id:'motor',    label:'Motor Insurance',   icon:iconCar() },
        { id:'loanins',  label:'Loan Insurance',    icon:iconLock() },
      ],
    },
    {
      section: 'Analysis',
      items: [
        { id:'disbursal', label:'Disbursal Report', icon:iconChart() },
      ],
    },
    {
      section: 'Schedules',
      items: [
        { id:'schedules', label:'Monthly Schedules', icon:iconCalendar() },
      ],
    },
  ];

  function build() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = `
      ${logoHTML()}
      ${NAV_CONFIG.map(sectionHTML).join('')}
      ${footerHTML()}
    `;

    /* Attach click handlers */
    sidebar.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => Router.go(el.dataset.page));
    });
  }

  /* ── HTML builders ── */

  function logoHTML() {
    return `
      <div class="sidebar-logo">
        <div class="org">FINX24</div>
        <div class="sub">NBFC Finance Suite</div>
      </div>
    `;
  }

  function sectionHTML({ section, items }) {
    return `
      <div class="sidebar-section">
        <div class="sidebar-section-label">${section}</div>
        ${items.map(itemHTML).join('')}
      </div>
    `;
  }

  function itemHTML({ id, label, icon }) {
    return `
      <div class="nav-item" data-page="${id}">
        ${icon}
        ${label}
      </div>
    `;
  }

  function footerHTML() {
    // Read real session from Auth if available
    const s    = (typeof Auth !== 'undefined') ? Auth.getSession() : null;
    const ini  = s ? s.initials    : 'FA';
    const name = s ? s.name        : 'Finance Admin';
    const role = s ? s.designation : 'Accounts Team';
    return `
      <div class="sidebar-footer">
        <div class="flex items-center gap-8">
          <div class="user-avatar" style="background:#0B1F3A;border:2px solid #C8992A;
               color:#E8B84B;cursor:pointer" onclick="Auth._showUserMenu(this)">
            ${ini}
          </div>
          <div onclick="Auth._showUserMenu(this)" style="cursor:pointer">
            <div class="user-info">${name}</div>
            <div class="user-role">${role}</div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── SVG Icons ── */
  function svgWrap(inner) {
    return `<svg width="15" height="15" viewBox="0 0 16 16" fill="none">${inner}</svg>`;
  }

  function iconDashboard() {
    return svgWrap(`
      <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.8"/>
    `);
  }
  function iconBank() {
    return svgWrap(`
      <rect x="1" y="5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
      <path d="M4 5V4a4 4 0 0 1 8 0v1" stroke="currentColor" stroke-width="1.2"/>
    `);
  }
  function iconCar() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">'
        + '<path d="M5 17H3a2 2 0 01-2-2v-4l2.5-6h13l2.5 6v4a2 2 0 01-2 2h-2"/>'
        + '<circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>'
        + '</svg>';
  }

  function iconShield() {
    return svgWrap(`
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/>
      <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    `);
  }
  function iconLock() {
    return svgWrap(`
      <path d="M8 1L2 4v4c0 3.31 2.69 6 6 7 3.31-1 6-3.69 6-7V4L8 1z" stroke="currentColor" stroke-width="1.2"/>
    `);
  }
  function iconChart() {
    return svgWrap(`
      <path d="M1 13l4-5 3 2 3-4 4-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    `);
  }
  function iconCalendar() {
    return svgWrap(`
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
      <path d="M5 1v3M11 1v3M1.5 7h13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M4.5 10.5h3M4.5 12.5h5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
    `);
  }

  return { build };
})();