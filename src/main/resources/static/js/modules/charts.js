/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/charts.js
 * Description : Chart.js wrapper module. All chart renderers live
 *               here so no page module needs to touch Chart.js
 *               directly. Each method:
 *                 - accepts a canvas ID + data
 *                 - destroys any prior instance on that canvas
 *                 - creates a new Chart instance
 *                 - stores the instance for future destroy calls
 *
 *               Available renderers:
 *                 renderDisbursalTrend()   → dual bar (amount + count)
 *                 renderDisbursalBar()     → single bar (legacy/fallback)
 *                 renderAccrualTrend()     → 6-month grouped bar
 *                 renderDashboardTrend()   → dashboard mini bar
 *
 * Requires    : Chart.js 4.x loaded via CDN before this file.
 *
 * Author      : Jatin Mittal
 * Email       : jatin.mittal@cars24.com
 * Version     : 1.0.0
 * Created     : April 2024
 * ================================================================
 */

const Charts = (() => {

  /* Track instances to destroy before re-render */
  const _instances = {};

  /* ── Shared base options ── */
  function _base(extraOpts = {}) {
    return {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, autoSkip: true, maxRotation: 45, maxTicksLimit: 15 },
        },
        y: {
          grid:  { color: 'rgba(11,31,58,0.06)' },
          ticks: { font: { size: 11 } },
        },
      },
      ...extraOpts,
    };
  }

  /* ── Destroy + store helper ── */
  function _create(key, ctx, config) {
    if (_instances[key]) {
      _instances[key].destroy();
      delete _instances[key];
    }
    _instances[key] = new Chart(ctx, config);
  }

  /* ============================================================
     renderDisbursalTrend
     Dual-dataset bar chart: net disbursal amount (left axis)
     + loan count (right axis) per day.
     @param {string} canvasId
     @param {Array}  byDate   — from DisbursalParser.process().byDate
     ============================================================ */
  function renderDisbursalTrend(canvasId, byDate) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels  = byDate.map(d => d.date);
    const amounts = byDate.map(d => Math.round(d.amount / 100000));  // Lakhs
    const counts  = byDate.map(d => d.count);

    const opts = _base({
      scales: {
        x: {
          grid:  { display: false },
          ticks: { font: { size: 10 }, autoSkip: true, maxRotation: 45, maxTicksLimit: 15 },
        },
        yAmount: {
          type:     'linear',
          position: 'left',
          grid:     { color: 'rgba(11,31,58,0.06)' },
          ticks:    { font: { size: 10 }, callback: v => '₹' + v + 'L', maxTicksLimit: 5 },
          title:    { display: false },
        },
        yCount: {
          type:     'linear',
          position: 'right',
          grid:     { display: false },
          ticks:    { font: { size: 10 }, maxTicksLimit: 5 },
          title:    { display: false },
        },
      },
    });

    _create(canvasId, ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label:           'Net Disbursal (₹L)',
            data:            amounts,
            backgroundColor: '#1E3F6B',
            borderRadius:    4,
            yAxisID:         'yAmount',
          },
          {
            label:           'Loan Count',
            data:            counts,
            backgroundColor: '#C8992A',
            borderRadius:    4,
            yAxisID:         'yCount',
          },
        ],
      },
      options: opts,
    });
  }

  /* ============================================================
     renderDisbursalBar
     Single bar chart — legacy / sample data fallback.
     @param {string} canvasId
     @param {Array}  rows   — AppData.disbursalSample entries
     ============================================================ */
  function renderDisbursalBar(canvasId, rows) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = rows.map(r => r.date);
    const values = rows.map(r => Math.round(r.amount / 100000));

    const opts = _base();
    opts.scales.y.ticks.callback = v => '₹' + v + 'L';

    _create(canvasId, ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label:           'Disbursal (₹ Lakhs)',
          data:            values,
          backgroundColor: '#1E3F6B',
          borderRadius:    4,
        }],
      },
      options: opts,
    });
  }

  /* ============================================================
     renderAccrualTrend
     6-month grouped bar: Accrued vs Actualized.
     @param {string} canvasId
     ============================================================ */
  function renderAccrualTrend(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const months  = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
    const accrued = [72, 68, 81, 75, 79, 83];
    const actual  = [68, 65, 79, 72, 76, 81];

    const opts = _base();
    opts.scales.y.ticks.callback = v => '₹' + v + 'L';

    _create(canvasId, ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label:           'Accrued',
            data:            accrued,
            backgroundColor: '#1E3F6B',
            borderRadius:    3,
          },
          {
            label:           'Actualized',
            data:            actual,
            backgroundColor: '#C8992A',
            borderRadius:    3,
          },
        ],
      },
      options: opts,
    });
  }

  /* ============================================================
     renderDashboardTrend
     Dashboard mini bar from sample data.
     @param {string} canvasId
     ============================================================ */
  function renderDashboardTrend(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = AppData.disbursalSample.map(r => r.date);
    const values = AppData.disbursalSample.map(r => Math.round(r.amount / 100000));

    const opts = _base();
    opts.scales.y.ticks.callback = v => '₹' + v + 'L';

    _create(canvasId, ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label:           'Disbursals (₹L)',
          data:            values,
          backgroundColor: '#1E3F6B',
          borderRadius:    4,
        }],
      },
      options: opts,
    });
  }

  /* ── Public API ── */
  return {
    renderDisbursalTrend,
    renderDisbursalBar,
    renderAccrualTrend,
    renderDashboardTrend,
  };

})();