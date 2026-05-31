/**
 * FINX24 — Bank Reconciliation
 * Requires: page.recon-utils.js loaded first
 * @author  Jatin Mittal
 * @contact jatin.mittal@cars24.com | +91-8221944248
 * @company CARS24 Financial Services Pvt. Ltd. (CFSPL)
 */

/* ================================================================
   BANK RECONCILIATION — PAGE
   ================================================================ */
Router.register('bank', function(panel) {
    const s = AppData.bankRecon.summary;
    const entries = AppData.bankRecon.entries;

    panel.innerHTML = `
    <div class="module-hero">
      <div>
        <div class="hero-label">Reconciliation</div>
        <div class="hero-title">Bank Reconciliation</div>
        <div class="hero-sub">Ledger vs bank statement matching · open items · variance analysis</div>
      </div>
    </div>

    <!-- Summary chips -->
    <div class="chips-strip">
      <div class="stat-chip">
        <div class="chip-val">${s.ledgerTotal}</div>
        <div class="chip-lbl">Ledger Total</div>
      </div>
      <div class="stat-chip">
        <div class="chip-val">${s.bankTotal}</div>
        <div class="chip-lbl">Bank Total</div>
      </div>
      <div class="stat-chip">
        <div class="chip-val negative">${s.difference}</div>
        <div class="chip-lbl">Difference</div>
      </div>
      <div class="stat-chip">
        <div class="chip-val">${s.matched}</div>
        <div class="chip-lbl">Matched</div>
      </div>
    </div>

    <!-- Entries table -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Statement entries</span>
        <span class="card-action">Export →</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Reference</th><th>Narration</th>
              <th>Ledger (₹)</th><th>Bank (₹)</th><th>Diff (₹)</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(r => `
              <tr>
                <td>${r.date}</td>
                <td style="font-family:monospace;font-size:11px">${r.ref}</td>
                <td>${r.narration}</td>
                <td style="text-align:right">${r.ledger}</td>
                <td style="text-align:right">${r.bank}</td>
                <td style="text-align:right;font-weight:500;color:${r.diff === '—' ? 'var(--green)' : 'var(--red)'}">${r.diff}</td>
                <td>${UI.tag(r.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>${entries.length} entries</span>
        <span style="color:var(--gold);cursor:pointer">Upload statement →</span>
      </div>
    </div>

    <!-- Notice -->
    <div class="notice" style="margin-top:14px">
      <strong>Live upload coming soon</strong> — upload your ledger and bank statement Excel files to run automatic matching. Currently showing sample data.
    </div>
  `;
});