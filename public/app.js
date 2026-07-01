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
// SCREEN: Jobs List
// ══════════════════════════════════════════════

async function renderJobsList(params) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><span class="loading-icon">◈</span></div>`;
  const jobs = await apiFetch('/api/jobs');

  let filtered = jobs;
  let statusFilter = '';
  let countryFilter = '';

  function applyFilters() {
    filtered = jobs.filter(j =>
      (!statusFilter || j.status === statusFilter) &&
      (!countryFilter || j.country === countryFilter)
    );
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('jobs-tbody');
    if (!tbody) return;
    tbody.innerHTML = filtered.length
      ? filtered.map(j => `
        <tr onclick="navigate('#/jobs/${j.id}')">
          <td>${fmtDate(j.start_date)}</td>
          <td>${j.title}</td>
          <td>${j.client_name || '—'}</td>
          <td>${j.location_name || '—'}</td>
          <td>${j.country?.toUpperCase() || '—'}</td>
          <td>${statusChip(j.status)}</td>
        </tr>`).join('')
      : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px">No jobs match filters.</td></tr>`;
  }

  app.innerHTML = `
    <div class="screen-header">
      <div class="screen-header-left">
        <h1>Jobs</h1>
        <p>${jobs.length} total</p>
      </div>
      <button class="btn btn-primary" onclick="openCreateJobModal()">+ New Job</button>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:20px">
      <select id="filter-status" style="width:160px">
        <option value="">All statuses</option>
        <option>new</option><option>scoped</option><option>planned</option>
        <option>work_complete</option><option>complete</option><option>on_hold</option><option>aborted</option>
      </select>
      <select id="filter-country" style="width:160px">
        <option value="">All countries</option>
        <option value="uk">UK</option><option value="us">US</option>
        <option value="ca">Canada</option><option value="ie">Ireland</option><option value="at">Austria</option>
      </select>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Job</th><th>Client</th><th>Location</th><th>Country</th><th>Status</th></tr></thead>
        <tbody id="jobs-tbody"></tbody>
      </table>
    </div>
  `;

  document.getElementById('filter-status').addEventListener('change', e => { statusFilter = e.target.value; applyFilters(); });
  document.getElementById('filter-country').addEventListener('change', e => { countryFilter = e.target.value; applyFilters(); });
  applyFilters();
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
// SHARED JOB STATE
// ══════════════════════════════════════════════

let _currentJob = null;
let _currentJobId = null;

// ══════════════════════════════════════════════
// SCREEN: JOB DETAIL
// ══════════════════════════════════════════════

async function renderJobDetail({ id }) {
  _currentJobId = id;
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><span class="loading-icon">◈</span></div>`;
  _currentJob = await apiFetch(`/api/jobs/${id}`);

  const TABS = [
    { key: 'overview',    label: 'Overview' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'map',         label: 'Map & Survey' },
    { key: 'risks',       label: 'Risks' },
    { key: 'method',      label: 'Method Statement' },
    { key: 'document',    label: 'Document' },
  ];

  app.innerHTML = `
    <div class="screen-header">
      <div class="screen-header-left">
        <a href="#/jobs" style="color:var(--muted);text-decoration:none;font-size:11px">← Jobs</a>
        <h1 style="margin-top:4px">${_currentJob.title}</h1>
        <p>${statusChip(_currentJob.status)} &nbsp; ${_currentJob.client_name || 'No client'} &nbsp; ${fmtDate(_currentJob.start_date)}</p>
      </div>
    </div>
    <div class="tabs">
      ${TABS.map(t => `<button class="tab-btn" data-tab="${t.key}">${t.label}</button>`).join('')}
    </div>
    <div id="tab-content"></div>
  `;

  const tabHandlers = {
    overview:    renderOverviewTab,
    permissions: renderPermissionsTab,
    map:         renderMapTab,
    risks:       renderRisksTab,
    method:      renderMethodTab,
    document:    renderDocumentTab,
  };

  const savedTab = sessionStorage.getItem(`job-tab-${id}`) || 'overview';

  async function switchTab(key) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === key));
    sessionStorage.setItem(`job-tab-${id}`, key);
    document.getElementById('tab-content').innerHTML = `<div class="loading-screen" style="min-height:200px"><span class="loading-icon">◈</span></div>`;
    await tabHandlers[key]();
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  await switchTab(savedTab);
}

async function renderOverviewTab() {
  const j = _currentJob;
  const [clients, settings] = await Promise.all([apiFetch('/api/clients'), apiFetch('/api/settings')]);
  const aircraft = await apiFetch('/api/aircraft').catch(() => []);

  const clientOpts = clients.map(c => `<option value="${c.id}" ${j.client_id===c.id?'selected':''}>${c.name}</option>`).join('');
  const aircraftOpts = aircraft.map(a => `<option value="${a.id}" ${j.aircraft_id===a.id?'selected':''}>${a.make} ${a.model}</option>`).join('');

  document.getElementById('tab-content').innerHTML = `
    <form id="overview-form">
      <div class="form-row form-row-2">
        <div class="form-group"><label>Job Title *</label><input name="title" value="${j.title || ''}" required></div>
        <div class="form-group"><label>Status</label>
          <select name="status">
            ${['new','scoped','planned','work_complete','complete','on_hold','aborted'].map(s =>
              `<option value="${s}" ${j.status===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label>Client</label>
          <select name="client_id"><option value="">— No client —</option>${clientOpts}</select>
        </div>
        <div class="form-group"><label>Operation Type</label>
          <select name="operation_type">
            <option value="UK_PDRA01" ${j.operation_type==='UK_PDRA01'?'selected':''}>UK PDRA01</option>
            <option value="UK_STS" ${j.operation_type==='UK_STS'?'selected':''}>UK STS</option>
            <option value="INTERNATIONAL" ${j.operation_type==='INTERNATIONAL'?'selected':''}>International</option>
          </select>
        </div>
      </div>
      <div class="form-row form-row-3">
        <div class="form-group"><label>Start Date</label><input type="date" name="start_date" value="${j.start_date||''}"></div>
        <div class="form-group"><label>Start Time</label><input type="time" name="start_time" value="${j.start_time||''}"></div>
        <div class="form-group"><label>End Time</label><input type="time" name="end_time" value="${j.end_time||''}"></div>
      </div>
      <div class="form-group"><label>Location Name</label><input name="location_name" value="${j.location_name||''}"></div>
      <div class="form-group"><label>Location Address</label><input name="location_address" value="${j.location_address||''}"></div>
      <div class="form-row form-row-3">
        <div class="form-group"><label>Latitude</label><input type="number" step="any" name="lat" value="${j.lat||''}"></div>
        <div class="form-group"><label>Longitude</label><input type="number" step="any" name="lng" value="${j.lng||''}"></div>
        <div class="form-group"><label>Elevation (ft)</label><input type="number" name="elevation_ft" value="${j.elevation_ft||''}"></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label>Airspace Class</label>
          <select name="airspace_class">
            ${['','A','B','C','D','E','F','G'].map(c => `<option value="${c}" ${j.airspace_class===c?'selected':''}>${c||'Unknown'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Aircraft</label>
          <select name="aircraft_id"><option value="">— Select —</option>${aircraftOpts}</select>
        </div>
      </div>
      <div class="form-group"><label>Description</label><textarea name="description" rows="3">${j.description||''}</textarea></div>
      <div class="form-group"><label>Notes</label><textarea name="notes" rows="2">${j.notes||''}</textarea></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="deleteJob('${j.id}')">Delete Job</button>
      </div>
    </form>
  `;

  document.getElementById('overview-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    // Preserve JSON fields that come from other tabs
    body.airspace_users        = _currentJob.airspace_users;
    body.area_of_operations    = _currentJob.area_of_operations;
    body.ground_risk_summary   = _currentJob.ground_risk_summary;
    body.map_static_image_url  = _currentJob.map_static_image_url;
    try {
      _currentJob = await apiFetch(`/api/jobs/${_currentJobId}`, { method: 'PUT', body });
      showToast('Saved');
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function deleteJob(id) {
  if (!confirm('Delete this job? This cannot be undone.')) return;
  try {
    await apiFetch(`/api/jobs/${id}`, { method: 'DELETE' });
    showToast('Job deleted');
    navigate('#/jobs');
  } catch (err) { showToast(err.message, 'error'); }
}

async function renderPermissionsTab() {
  let perms = await apiFetch(`/api/jobs/${_currentJobId}/permissions`);

  function renderPerms() {
    document.getElementById('perms-list').innerHTML = perms.map(p => `
      <div class="perm-item" data-id="${p.id}">
        <select class="perm-status-select" data-field="status">
          <option value="pending" ${p.status==='pending'?'selected':''}>Pending</option>
          <option value="obtained" ${p.status==='obtained'?'selected':''}>Obtained</option>
          <option value="not_required" ${p.status==='not_required'?'selected':''}>Not Required</option>
        </select>
        <div class="perm-label">
          <div>${p.label}</div>
          <div class="perm-authority">${p.authority || ''}</div>
        </div>
        <input placeholder="Contact" style="width:140px" value="${p.contact||''}" data-field="contact">
        <input type="date" style="width:130px" value="${p.deadline||''}" data-field="deadline">
        <button class="btn btn-ghost btn-sm" onclick="deletePerm('${p.id}')">✕</button>
      </div>
    `).join('');
  }

  document.getElementById('tab-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>Permissions Checklist</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="addPermItem()">+ Add Item</button>
        <button class="btn btn-primary btn-sm" onclick="savePerms()">Save All</button>
      </div>
    </div>
    <div id="perms-list"></div>
  `;
  renderPerms();

  window.savePerms = async () => {
    const items = [...document.querySelectorAll('.perm-item')].map(el => ({
      id: el.dataset.id,
      status: el.querySelector('[data-field="status"]').value,
      contact: el.querySelector('[data-field="contact"]').value,
      deadline: el.querySelector('[data-field="deadline"]').value,
      notes: '',
    }));
    try {
      perms = await apiFetch(`/api/jobs/${_currentJobId}/permissions`, { method: 'PUT', body: items });
      showToast('Permissions saved');
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.addPermItem = async () => {
    const label = prompt('Permission item label:');
    if (!label) return;
    try {
      const p = await apiFetch(`/api/jobs/${_currentJobId}/permissions`, { method: 'POST', body: { label } });
      perms.push(p);
      renderPerms();
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.deletePerm = async (permId) => {
    try {
      await apiFetch(`/api/jobs/${_currentJobId}/permissions/${permId}`, { method: 'DELETE' });
      perms = perms.filter(p => p.id !== permId);
      renderPerms();
    } catch (err) { showToast(err.message, 'error'); }
  };
}

async function renderMapTab() {
  const j = _currentJob;
  const settings = await apiFetch('/api/settings');

  document.getElementById('tab-content').innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:12px;align-items:center">
      <h2 style="margin:0">Map &amp; Survey</h2>
      <button class="btn btn-secondary btn-sm" id="btn-fetch-airspace">Fetch Airspace</button>
      <button class="btn btn-secondary btn-sm" id="btn-gen-ground-risk">Generate Ground Risk</button>
      <button class="btn btn-ghost btn-sm" id="btn-clear-polygon">Clear Polygon</button>
    </div>
    <div id="map-container"></div>
    <div style="display:flex;gap:8px;margin:12px 0">
      <span class="muted" style="font-size:11px">Draw a polygon on the map to define the area of operations.</span>
    </div>

    <div id="airspace-section" style="display:none">
      <h2>Airspace Users</h2>
      <div id="airspace-table"></div>
      <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="window.saveAirspaceUsers()">Save Airspace Users</button>
    </div>

    <div id="ground-risk-section" style="margin-top:20px">
      <h2>Ground Risk Assessment</h2>
      <textarea id="ground-risk-text" rows="8" style="width:100%">${j.ground_risk_summary || ''}</textarea>
      <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="window.saveGroundRisk()">Save Ground Risk</button>
    </div>
  `;

  // Init Mapbox
  mapboxgl.accessToken = settings.mapbox_token || '';
  const center = (j.lng && j.lat) ? [j.lng, j.lat] : [-0.1278, 51.5074];

  const map = new mapboxgl.Map({
    container: 'map-container',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center,
    zoom: j.lat ? 14 : 10,
  });

  // Draw polygon
  let drawnPolygon = j.area_of_operations || null;
  let drawingPoints = [];
  let previewLayer = false;

  function renderPolygon() {
    if (map.getSource('aop')) {
      map.getSource('aop').setData({ type: 'Feature', geometry: drawnPolygon || { type: 'Polygon', coordinates: [[]] } });
      return;
    }
    map.addSource('aop', { type: 'geojson', data: { type: 'Feature', geometry: drawnPolygon || { type: 'Polygon', coordinates: [[]] } } });
    map.addLayer({ id: 'aop-fill', type: 'fill', source: 'aop', paint: { 'fill-color': '#e8ff47', 'fill-opacity': 0.15 } });
    map.addLayer({ id: 'aop-line', type: 'line', source: 'aop', paint: { 'line-color': '#e8ff47', 'line-width': 2 } });
    previewLayer = true;
  }

  map.on('load', () => {
    if (drawnPolygon) renderPolygon();

    map.on('click', e => {
      drawingPoints.push([e.lngLat.lng, e.lngLat.lat]);
      if (drawingPoints.length >= 3) {
        drawnPolygon = { type: 'Polygon', coordinates: [[...drawingPoints, drawingPoints[0]]] };
        if (!previewLayer) renderPolygon();
        else map.getSource('aop').setData({ type: 'Feature', geometry: drawnPolygon });
      }
    });
  });

  document.getElementById('btn-clear-polygon').addEventListener('click', () => {
    drawingPoints = [];
    drawnPolygon = null;
    if (map.getSource('aop')) {
      map.getSource('aop').setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } });
    }
  });

  // Save polygon to job and generate static image URL
  async function savePolygonToJob() {
    if (!drawnPolygon) return;
    const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encodeURIComponent(JSON.stringify({ type: 'Feature', geometry: drawnPolygon, properties: {} }))})/${center[0]},${center[1]},13/800x400@2x?access_token=${mapboxgl.accessToken}`;
    _currentJob = await apiFetch(`/api/jobs/${_currentJobId}`, {
      method: 'PUT',
      body: { ..._currentJob, area_of_operations: drawnPolygon, map_static_image_url: staticUrl },
    });
    showToast('Area of operations saved');
  }

  // Fetch airspace
  let airspaceUsers = Array.isArray(j.airspace_users) ? j.airspace_users : [];

  document.getElementById('btn-fetch-airspace').addEventListener('click', async e => {
    if (!j.lat || !j.lng) { showToast('Set lat/lng in Overview tab first', 'error'); return; }
    await savePolygonToJob();
    e.target.disabled = true;
    e.target.innerHTML = '<span class="spinner"></span> Fetching…';
    try {
      const airspaceData = await apiFetch(`/api/airspace?lat=${j.lat}&lng=${j.lng}&radius_km=20`);
      const aeroRows = (airspaceData.aerodromes || []).map(a => ({
        id: a.icao || a.name, name: a.name, type: a.type || 'AERODROME',
        icao: a.icao, distance_km: a.distance_km, phone: a.phone, notified: false, notes: '', selected: true,
      }));
      const hospRows = (airspaceData.hospitals || []).map(h => ({
        id: `HOSP-${h.name}`, name: h.name, type: 'HOSPITAL',
        icao: null, distance_km: h.distance_km, phone: h.phone, notified: false, notes: '', selected: true,
      }));
      airspaceUsers = [...aeroRows, ...hospRows];
      renderAirspaceTable();
      document.getElementById('airspace-section').style.display = '';
      showToast(`Found ${airspaceUsers.length} airspace users`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { e.target.disabled = false; e.target.textContent = 'Fetch Airspace'; }
  });

  function renderAirspaceTable() {
    document.getElementById('airspace-table').innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>✓</th><th>Name</th><th>Type</th><th>ICAO</th><th>Distance</th><th>Phone</th><th>Notified</th></tr></thead>
          <tbody>${airspaceUsers.map((a, i) => `
            <tr>
              <td><input type="checkbox" ${a.selected !== false ? 'checked' : ''} onchange="window.toggleAirspaceUser(${i}, this.checked)"></td>
              <td>${a.name}</td><td>${a.type}</td><td>${a.icao || '—'}</td>
              <td>${a.distance_km != null ? a.distance_km.toFixed(1) : '—'} km</td><td>${a.phone || '—'}</td>
              <td><input type="checkbox" ${a.notified ? 'checked' : ''} onchange="window.setAirspaceNotified(${i}, this.checked)"></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  window.toggleAirspaceUser = (i, checked) => { airspaceUsers[i].selected = checked; };
  window.setAirspaceNotified = (i, checked) => { airspaceUsers[i].notified = checked; };

  window.saveAirspaceUsers = async () => {
    const selected = airspaceUsers.filter(a => a.selected !== false);
    try {
      _currentJob = await apiFetch(`/api/jobs/${_currentJobId}`, {
        method: 'PUT',
        body: { ..._currentJob, airspace_users: selected },
      });
      showToast('Airspace users saved');
    } catch (err) { showToast(err.message, 'error'); }
  };

  // Generate ground risk
  document.getElementById('btn-gen-ground-risk').addEventListener('click', async e => {
    await savePolygonToJob();
    e.target.disabled = true;
    e.target.innerHTML = '<span class="spinner"></span> Drafting…';
    try {
      const result = await apiFetch('/api/ai/ground-risk', {
        method: 'POST',
        body: {
          polygon: drawnPolygon,
          airspace_class: _currentJob.airspace_class,
          location_name: _currentJob.location_name,
          lat: _currentJob.lat,
          lng: _currentJob.lng,
        },
      });
      document.getElementById('ground-risk-text').value = result.ground_risk_summary || '';
      _currentJob.ground_risk_summary = result.ground_risk_summary;
      showToast('Ground risk drafted');
    } catch (err) { showToast(err.message, 'error'); }
    finally { e.target.disabled = false; e.target.textContent = 'Generate Ground Risk'; }
  });

  window.saveGroundRisk = async () => {
    const text = document.getElementById('ground-risk-text').value;
    try {
      _currentJob = await apiFetch(`/api/jobs/${_currentJobId}`, {
        method: 'PUT',
        body: { ..._currentJob, ground_risk_summary: text },
      });
      showToast('Ground risk saved');
    } catch (err) { showToast(err.message, 'error'); }
  };
}

function renderRisksTab() {
  document.getElementById('tab-content').innerHTML = `<div class="empty-state"><p>Risks — Coming in next task.</p></div>`;
}

function renderMethodTab() {
  document.getElementById('tab-content').innerHTML = `<div class="empty-state"><p>Method Statement — Coming in next task.</p></div>`;
}

function renderDocumentTab() {
  document.getElementById('tab-content').innerHTML = `<div class="empty-state"><p>Document — Coming in next task.</p></div>`;
}

// ══════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════

register('/', renderDashboard);
register('/dashboard', renderDashboard);
register('/jobs', renderJobsList);
register('/jobs/:id', renderJobDetail);

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', () => {
  getAuthHeader(); // trigger auth prompt if needed
  handleRoute();
});
