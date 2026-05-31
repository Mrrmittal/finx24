/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/page.admin.js
 * Description : Admin Panel — accessible only to admin role.
 *               Phase 1: User management, system settings display.
 *               Phase 2: Database integration, data modification.
 * ================================================================
 */

Router.register('admin', function(panel) {

  // Guard — only admin can access
  if (!Auth.isAdmin()) {
    panel.innerHTML = `
      <div class="card" style="padding:40px;text-align:center">
        <div style="font-size:32px;margin-bottom:12px">🔒</div>
        <div style="font-size:16px;font-weight:500;color:var(--navy);margin-bottom:8px">Access Restricted</div>
        <div style="font-size:13px;color:var(--muted)">Admin access required to view this page.</div>
        <button class="btn-o" style="margin-top:20px" onclick="Router.go('dashboard')">← Back to Dashboard</button>
      </div>`;
    return;
  }

  const s = Auth.getSession();

  panel.innerHTML = `
    <!-- Hero -->
    <div class="module-hero">
      <div>
        <div class="hero-label">Administration</div>
        <div class="hero-title">Admin Panel</div>
        <div class="hero-sub">User management · System settings · Database integration (Phase 2)</div>
      </div>
      <div class="hero-actions">
        <span style="font-size:11px;color:rgba(255,255,255,0.5);padding:5px 10px">
          Logged in as <strong style="color:#E8B84B">${s.name}</strong>
        </span>
      </div>
    </div>

    <!-- KPI row -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card accent-gold">
        <div class="kpi-label">Total Users</div>
        <div class="kpi-value" id="adm-user-count">3</div>
        <div class="kpi-sub">Active accounts</div>
      </div>
      <div class="kpi-card accent-green">
        <div class="kpi-label">Admin Accounts</div>
        <div class="kpi-value">1</div>
        <div class="kpi-sub">Full access</div>
      </div>
      <div class="kpi-card accent-blue">
        <div class="kpi-label">User Accounts</div>
        <div class="kpi-value">2</div>
        <div class="kpi-sub">Read + run access</div>
      </div>
      <div class="kpi-card accent-navy">
        <div class="kpi-label">Database</div>
        <div class="kpi-value" style="font-size:13px">Phase 2</div>
        <div class="kpi-sub">Not connected yet</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">

      <!-- User Management -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">User Management</span>
          <span class="card-action" id="adm-add-user-btn">＋ Add User</span>
        </div>
        <table class="data-table" id="adm-users-table">
          <thead>
            <tr>
              <th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody id="adm-users-body"></tbody>
        </table>
      </div>

      <!-- Role Permissions -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Role Permissions</span>
        </div>
        <table class="data-table">
          <thead>
            <tr><th>Feature</th><th>User</th><th>Admin</th></tr>
          </thead>
          <tbody>
            ${[
              ['Run Reconciliations',      true,  true],
              ['View Reports',             true,  true],
              ['Download Excel Output',    true,  true],
              ['Upload Source Files',      true,  true],
              ['View Dashboard',           true,  true],
              ['Modify Reconciliation Data', false, true],
              ['Manage Users',             false, true],
              ['Database Settings',        false, true],
              ['Delete Records',           false, true],
              ['Admin Panel Access',       false, true],
            ].map(([feat, user, admin]) => `
              <tr>
                <td style="font-size:11px">${feat}</td>
                <td style="text-align:center">${user
                  ? '<span style="color:var(--green);font-size:14px">✓</span>'
                  : '<span style="color:var(--muted);font-size:14px">—</span>'}</td>
                <td style="text-align:center">${admin
                  ? '<span style="color:var(--green);font-size:14px">✓</span>'
                  : '<span style="color:var(--muted);font-size:14px">—</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Database Integration (Phase 2) -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-header">
        <span class="card-title">Database Integration</span>
        <span style="font-size:11px;padding:2px 8px;border-radius:8px;background:var(--amber-bg);color:var(--amber-text);font-weight:500">Phase 2</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">
        ${[
          { icon:'🗄️', title:'Snowflake DB', desc:'Connect to CFSPL/CAPL/CSPL Snowflake accounts for persistent storage', status:'Planned' },
          { icon:'⚙️', title:'Auto Scheduler', desc:'Schedule monthly recon runs — auto-trigger on month-end close', status:'Planned' },
          { icon:'📊', title:'Multi-Bank Recon', desc:'Expand bank recon across multiple accounts with variance reporting', status:'Planned' },
        ].map(c => `
          <div style="border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-size:22px;margin-bottom:8px">${c.icon}</div>
            <div style="font-size:13px;font-weight:500;color:var(--navy);margin-bottom:4px">${c.title}</div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5">${c.desc}</div>
            <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(11,31,58,0.07);color:var(--muted)">${c.status}</span>
          </div>`).join('')}
      </div>
      <div class="notice">
        <strong>Phase 2 roadmap:</strong> Database connection settings will appear here once the backend integration is ready.
        Snowflake accounts (CFSPL, CAPL, CSPL) are already provisioned as MCP servers.
      </div>
    </div>

    <!-- System Info -->
    <div class="card">
      <div class="card-header"><span class="card-title">System Information</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px">
        ${[
          ['Application',     'FinRecon Pro v5.0'],
          ['Auth Mode',       'Phase 1 — Session-based (DB in Phase 2)'],
          ['LI Recon Engine', 'v5.0 — Float+PR+SAP+DR'],
          ['MI Recon Engine', 'v2.0 — L1+L2 Full OPS'],
          ['Browser',         navigator.userAgent.split(')')[0].split('(')[1] || 'Unknown'],
          ['Session Started', new Date(s.loginTime).toLocaleString('en-IN')],
        ].map(([k,v]) => `
          <div style="padding:8px 0;border-bottom:1px solid rgba(11,31,58,0.06)">
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px">${k}</div>
            <div style="color:var(--navy)">${v}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Add User Modal -->
    <div id="adm-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);
         z-index:9999;display:none;align-items:center;justify-content:center">
      <div style="background:#fff;border-radius:12px;padding:28px;width:420px;
                  box-shadow:0 16px 40px rgba(0,0,0,0.2)">
        <div style="font-size:16px;font-weight:600;color:var(--navy);margin-bottom:20px">Add New User</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Full Name</div>
            <input class="form-input" id="adm-new-name" placeholder="e.g. Finance Analyst" style="width:100%">
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Username</div>
            <input class="form-input" id="adm-new-user" placeholder="e.g. analyst1" style="width:100%">
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Password</div>
            <input class="form-input" type="password" id="adm-new-pass" placeholder="Min 8 chars" style="width:100%">
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Role</div>
            <select class="form-select" id="adm-new-role" style="width:100%">
              <option value="user">User — Run recon, view reports</option>
              <option value="admin">Admin — Full access</option>
            </select>
          </div>
          <div id="adm-modal-err" style="font-size:11px;color:var(--red-text);display:none"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:20px">
          <button class="btn-g" onclick="_admAddUser()" style="flex:1">Add User</button>
          <button class="btn-o" onclick="document.getElementById('adm-modal').style.display='none'" style="flex:1">Cancel</button>
        </div>
      </div>
    </div>
  `;

  // ── Render user table ───────────────────────────────────────────
  _admRenderUsers();

  document.getElementById('adm-add-user-btn')?.addEventListener('click', () => {
    document.getElementById('adm-modal').style.display = 'flex';
    document.getElementById('adm-modal-err').style.display = 'none';
  });

  function _admRenderUsers() {
    const tbody = document.getElementById('adm-users-body');
    if (!tbody) return;
    // Phase 1: static list from Auth.USERS (via session role check)
    const users = [
      { name:'Jatin Mittal',  username:'admin',  role:'admin', status:'Active' },
      { name:'Finance User',  username:'user1',  role:'user',  status:'Active' },
      { name:'Recon Analyst', username:'recon',  role:'user',  status:'Active' },
      ...(JSON.parse(sessionStorage.getItem('finrecon_added_users') || '[]')),
    ];
    document.getElementById('adm-user-count').textContent = users.length;
    tbody.innerHTML = users.map((u, i) => `
      <tr>
        <td>${u.name}</td>
        <td style="font-family:monospace;font-size:11px">${u.username}</td>
        <td>${u.role === 'admin'
          ? '<span style="background:#FFF2CC;color:#8A6010;font-size:10px;padding:2px 7px;border-radius:8px;font-weight:500">Admin</span>'
          : '<span style="background:rgba(11,31,58,0.07);color:var(--muted);font-size:10px;padding:2px 7px;border-radius:8px">User</span>'}</td>
        <td><span class="tag tag-matched">Active</span></td>
        <td>${i > 0
          ? `<span style="font-size:11px;color:var(--red-text);cursor:pointer"
                   onclick="_admDeleteUser(${i})">Remove</span>`
          : '<span style="font-size:11px;color:var(--muted)">Protected</span>'}</td>
      </tr>
    `).join('');
  }
});

// ── Global helpers called from onclick ──────────────────────────
function _admAddUser() {
  const name = document.getElementById('adm-new-name')?.value?.trim();
  const user = document.getElementById('adm-new-user')?.value?.trim();
  const pass = document.getElementById('adm-new-pass')?.value;
  const role = document.getElementById('adm-new-role')?.value;
  const err  = document.getElementById('adm-modal-err');

  if (!name || !user || !pass) {
    err.textContent = 'All fields are required.'; err.style.display = 'block'; return;
  }
  if (pass.length < 8) {
    err.textContent = 'Password must be at least 8 characters.'; err.style.display = 'block'; return;
  }
  const added = JSON.parse(sessionStorage.getItem('finrecon_added_users') || '[]');
  added.push({ name, username: user, role, status: 'Active' });
  sessionStorage.setItem('finrecon_added_users', JSON.stringify(added));
  document.getElementById('adm-modal').style.display = 'none';
  Router.go('admin');
}

function _admDeleteUser(idx) {
  const added = JSON.parse(sessionStorage.getItem('finrecon_added_users') || '[]');
  // idx is offset by 3 (3 built-in users)
  added.splice(idx - 3, 1);
  sessionStorage.setItem('finrecon_added_users', JSON.stringify(added));
  Router.go('admin');
}
