/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/router.js
 * Description : Client-side page router. Page modules register a
 *               render function via Router.register(id, fn). Calling
 *               Router.go(id) clears #content, calls the render fn,
 *               updates the topbar title and syncs the sidebar
 *               active state. No hash/history API — pure DOM swap.
 *
 * Author      : Jatin Mittal
 * Email       : jatin.mittal@cars24.com
 * Version     : 1.0.0
 * Created     : April 2024
 * ================================================================
 */

const Router = (() => {

  const PAGE_TITLES = {
    'dashboard':    'Dashboard',
    'bank':         'Bank Reconciliation',
    'motor':        'Motor Insurance Recon',
    'loanins':      'Loan Insurance Recon',
    'disbursal':    'Disbursal Report',
    'schedules':    'Monthly Schedules',
  };

  /* Registry: pages register their render function here */
  const _pages = {};

  /* Current active page */
  let _current = null;

  /** Register a page renderer */
  function register(id, renderFn) {
    _pages[id] = renderFn;
  }

  /** Navigate to a page by id */
  function go(pageId) {
    const content = document.getElementById('content');
    if (!content) return;

    /* Render the page into #content */
    if (_pages[pageId]) {
      content.innerHTML = '';
      const panel = document.createElement('div');
      panel.className = 'panel active';
      panel.id = 'panel-' + pageId;
      content.appendChild(panel);
      _pages[pageId](panel);
    }

    /* Update topbar title */
    const title = document.getElementById('tb-title');
    if (title) title.textContent = PAGE_TITLES[pageId] || pageId;

    /* Update sidebar active state */
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNav) activeNav.classList.add('active');

    _current = pageId;
  }

  /** Get current page id */
  function current() { return _current; }

  return { register, go, current };
})();