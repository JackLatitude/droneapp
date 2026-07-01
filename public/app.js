// ══════════════════════════════════════════════
// CONFIG & AUTH
// ══════════════════════════════════════════════

const CONFIG = {
  mapboxToken: '', // Set via /api/settings — fetched on boot
};

function getAuthHeader() {
  const creds = sessionStorage.getItem('drone-ops-creds');
  if (!creds) {
    const user = prompt('Username:') || '';
    const pass = prompt('Password:') || '';
    sessionStorage.setItem('drone-ops-creds', btoa(`${user}:${pass}`));
    return `Basic ${btoa(`${user}:${pass}`)}`;
  }
  return `Basic ${creds}`;
}

// ══════════════════════════════════════════════
// API CLIENT
// ══════════════════════════════════════════════

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    sessionStorage.removeItem('drone-ops-creds');
    location.reload();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html')) return res.text();
  return res.json();
}

// ══════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ══════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════

const routes = [];

function register(pattern, handler) {
  routes.push({ pattern, handler });
}

function matchRoute(hash) {
  const path = hash.replace(/^#/, '') || '/dashboard';
  for (const route of routes) {
    const keys = [];
    const regStr = route.pattern.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
    const match = path.match(new RegExp(`^${regStr}$`));
    if (match) {
      const params = {};
      keys.forEach((k, i) => { params[k] = match[i + 1]; });
      return { handler: route.handler, params };
    }
  }
  return null;
}

function navigate(hash) {
  window.location.hash = hash;
}

function setActiveNav(path) {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', path.startsWith(`/${el.dataset.nav}`));
  });
}

async function handleRoute() {
  const hash = window.location.hash.replace('#', '') || '/dashboard';
  const matched = matchRoute(hash);
  setActiveNav(hash);
  const app = document.getElementById('app');
  if (!matched) {
    app.innerHTML = `<div class="empty-state"><p>Page not found.</p><a href="#/dashboard" class="btn btn-secondary">Dashboard</a></div>`;
    return;
  }
  try {
    await matched.handler(matched.params);
  } catch (e) {
    app.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
  }
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function riskScore(s, p) { return (s || 0) + (p || 0); }
function riskLevel(score) {
  if (score <= 5) return 'low';
  if (score <= 7) return 'medium';
  return 'high';
}
function riskLabel(score) {
  if (score <= 5) return 'LOW';
  if (score <= 7) return 'MED';
  return 'HIGH';
}
function riskPill(s, p) {
  const score = riskScore(s, p);
  const level = riskLevel(score);
  return `<span class="risk-pill risk-${level}">${riskLabel(score)} ${score}</span>`;
}
function statusChip(status) {
  return `<span class="chip chip-${status}">${status.replace('_', ' ')}</span>`;
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

function openModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

// ══════════════════════════════════════════════
// SCREEN: DASHBOARD
// ══════════════════════════════════════════════

async function renderDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><span class="loading-icon">◈</span></div>`;

  const [jobs, settings] = await Promise.all([
    apiFetch('/api/jobs'),
    apiFetch('/api/settings'),
  ]);

  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);

  const upcoming = jobs.filter(j => {
    if (!j.start_date) return false;
    const d = new Date(j.start_date);
    return d >= today && d <= in30 && j.status !== 'aborted' && j.status !== 'complete';
  }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const active = jobs.filter(j => ['new','scoped','planned','work_complete','on_hold'].includes(j.status));
  const outstanding = jobs.filter(j => j.status !== 'complete' && j.status !== 'aborted');

  // PDRA01 expiry warning
  let expiryWarning = '';
  if (settings.pdra01_expiry) {
    const expDate = new Date(settings.pdra01_expiry);
    const daysLeft = Math.ceil((expDate - today) / 86400000);
    if (daysLeft <= 90) {
      const cls = daysLeft <= 30 ? 'danger' : 'warn';
      expiryWarning = `<div class="card" style="border-color: var(--${cls}); margin-bottom: 20px;">
        <span style="color:var(--${cls})">⚠ PDRA01 expires ${fmtDate(settings.pdra01_expiry)} — ${daysLeft} days remaining</span>
      </div>`;
    }
  }

  const upcomingRows = upcoming.length
    ? upcoming.map(j => `
      <tr onclick="navigate('#/jobs/${j.id}')">
        <td>${fmtDate(j.start_date)}</td>
        <td>${j.title}</td>
        <td>${j.client_name || '—'}</td>
        <td>${j.location_name || '—'}</td>
        <td>${statusChip(j.status)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5"><div class="empty-state" style="padding:24px"><p>No upcoming jobs in the next 30 days.</p></div></td></tr>`;

  app.innerHTML = `
    <div class="screen-header">
      <div class="screen-header-left">
        <h1>Dashboard</h1>
        <p>${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <button class="btn btn-primary" onclick="openCreateJobModal()">+ New Job</button>
    </div>

    ${expiryWarning}

    <div class="card-grid card-grid-4" style="margin-bottom:28px">
      <div class="stat-card">
        <div class="stat-value">${upcoming.length}</div>
        <div class="stat-label">Upcoming (30d)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${active.length}</div>
        <div class="stat-label">Active Jobs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${jobs.filter(j=>j.status==='complete').length}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size:16px">${settings.pdra01_expiry ? fmtDate(settings.pdra01_expiry) : '—'}</div>
        <div class="stat-label">PDRA01 Expiry</div>
      </div>
    </div>

    <h2>Upcoming Jobs</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Job</th><th>Client</th><th>Location</th><th>Status</th></tr></thead>
        <tbody>${upcomingRows}</tbody>
      </table>
    </div>
  `;
}

// ══════════════════════════════════════════════
// MODAL: CREATE JOB
// ══════════════════════════════════════════════

async function openCreateJobModal(prefill = {}) {
  const clients = await apiFetch('/api/clients');
  const clientOpts = clients.map(c => `<option value="${c.id}" ${prefill.client_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

  const overlay = openModal(`
    <div class="modal-header">
      <h2>New Job</h2>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    <form id="create-job-form">
      <div class="form-group"><label>Title *</label><input name="title" required value="${prefill.title || ''}"></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label>Client</label>
          <select name="client_id"><option value="">— No client —</option>${clientOpts}</select>
        </div>
        <div class="form-group"><label>Country</label>
          <select name="country">
            <option value="uk">United Kingdom</option>
            <option value="us">United States</option>
            <option value="ca">Canada</option>
            <option value="ie">Ireland</option>
            <option value="at">Austria</option>
          </select>
        </div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label>Operation Type</label>
          <select name="operation_type">
            <option value="UK_PDRA01">UK PDRA01</option>
            <option value="UK_STS">UK STS</option>
            <option value="INTERNATIONAL">International</option>
          </select>
        </div>
        <div class="form-group"><label>Start Date</label><input type="date" name="start_date" value="${prefill.start_date || ''}"></div>
      </div>
      <div class="form-group"><label>Location Name</label><input name="location_name" value="${prefill.location_name || ''}"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
        <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Job</button>
      </div>
    </form>
  `);

  overlay.querySelector('#create-job-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      const job = await apiFetch('/api/jobs', { method: 'POST', body });
      overlay.remove();
      showToast('Job created');
      navigate(`#/jobs/${job.id}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ══════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════

register('/', renderDashboard);
register('/dashboard', renderDashboard);

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', () => {
  getAuthHeader(); // trigger auth prompt if needed
  handleRoute();
});
