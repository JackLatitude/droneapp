# Drone Ops — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the vanilla JS single-page frontend for the drone ops app — dark-theme dashboard, client management, job detail with 6-tab interface, Mapbox integration, and document generation flow.

**Architecture:** Hash-router SPA (`#/jobs`, `#/jobs/:id`, `#/clients`, etc.) rendered entirely by `public/app.js`. No framework, no bundler. All API calls go to `/api/*` with HTTP Basic Auth injected globally. Mapbox GL JS loaded via CDN.

**Tech Stack:** Vanilla JS (ES2022 modules via `<script type="module">`), CSS custom properties, Mapbox GL JS (CDN), Google Fonts (DM Mono + Syne)

## Global Constraints

- No JS framework, no build step — browser-native ES modules only
- Dark theme: bg `#0e0e0f`, surface `#181819`, surface-high `#222224`, accent `#e8ff47`, text `#f0f0f0`, muted `#6b6b6b`
- Typography: Syne (headings), DM Mono (data/labels/UI), system-ui fallback
- All API calls must include `Authorization: Basic <b64>` header — stored in `sessionStorage` after first load
- Toast notifications for all save/error states — no page reloads for form saves
- Desktop-first: minimum supported width 1024px; no mobile layout needed
- AI draft buttons show a loading state (spinner + "Drafting…") and disable during call
- Mapbox GL JS: `https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js` (CDN)
- Document tab opens generated HTML in a new tab via `window.open()`
- Hash router: `window.location.hash` for navigation, `hashchange` event for routing

## Design System

```
Palette:
  --bg:           #0e0e0f   (page background)
  --surface:      #181819   (card/panel background)
  --surface-high: #222224   (input, table row hover)
  --border:       #2a2a2c   (subtle dividers)
  --accent:       #e8ff47   (CTA, active state, key data)
  --accent-dim:   #b5c930   (hover state of accent)
  --text:         #f0f0f0   (primary text)
  --muted:        #6b6b6b   (secondary text, placeholders)
  --danger:       #ff4444   (errors, high risk)
  --warn:         #ffb347   (medium risk)
  --ok:           #4caf79   (low risk, success)

Typography:
  --font-ui:   'DM Mono', monospace      (all UI labels, data, nav)
  --font-head: 'Syne', sans-serif        (screen titles only)

Signature element: Risk score pill — a small pill badge that fills 
solid green/amber/red with a 4px left border that "bleeds" into the 
table row, making the risk level immediately scannable.

Sizing:
  --sidebar-w: 220px
  --content-max: 1200px
  --radius: 4px
  --radius-lg: 8px
```

## File Map

```
public/
├── index.html      # SPA shell: sidebar nav, #app mount point, Mapbox + font CDN links
├── style.css       # Design system: CSS vars, reset, sidebar, layout, components
└── app.js          # Router + all screen modules (one object per screen, init() + render())
```

`app.js` is structured as a single file with clearly separated sections:

```
// ── CONFIG & AUTH
// ── API CLIENT (apiFetch wrapper)
// ── ROUTER
// ── TOAST
// ── SCREEN: Dashboard
// ── SCREEN: Jobs List
// ── SCREEN: Job Detail (Overview, Permissions, Map & Survey, Risks, Method Statement, Document tabs)
// ── SCREEN: Clients
// ── SCREEN: Countries
// ── SCREEN: Settings
// ── BOOT
```

---

## Task 11: SPA Shell + Design System

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js` (skeleton only — router + auth + toast)

**Interfaces:**
- Produces: `apiFetch(path, options)` — authenticated fetch wrapper, throws on non-2xx
- Produces: `showToast(message, type)` — type: `'success'` | `'error'`
- Produces: `navigate(hash)` — sets `window.location.hash`, triggers routing
- Produces: `router` object — `register(pattern, handler)`, `start()`

- [ ] **Step 1: Write `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Drone Ops</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700&display=swap" rel="stylesheet">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>

<nav id="sidebar">
  <div class="sidebar-logo">
    <span class="logo-mark">◈</span>
    <span class="logo-text">DRONE OPS</span>
  </div>
  <ul class="nav-links">
    <li><a href="#/dashboard" data-nav="dashboard">Dashboard</a></li>
    <li><a href="#/jobs" data-nav="jobs">Jobs</a></li>
    <li><a href="#/clients" data-nav="clients">Clients</a></li>
    <li><a href="#/countries" data-nav="countries">Countries</a></li>
    <li><a href="#/settings" data-nav="settings">Settings</a></li>
  </ul>
  <div class="sidebar-footer">
    <span id="sidebar-status" class="status-dot ok"></span>
    <span class="muted" id="sidebar-version">v1.0</span>
  </div>
</nav>

<main id="app">
  <div class="loading-screen">
    <span class="loading-icon">◈</span>
  </div>
</main>

<div id="toast-container"></div>

<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></script>
<script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `public/style.css`**

```css
/* ── RESET & ROOT ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:           #0e0e0f;
  --surface:      #181819;
  --surface-high: #222224;
  --border:       #2a2a2c;
  --accent:       #e8ff47;
  --accent-dim:   #b5c930;
  --text:         #f0f0f0;
  --muted:        #6b6b6b;
  --danger:       #ff4444;
  --warn:         #ffb347;
  --ok:           #4caf79;
  --font-ui:      'DM Mono', 'Courier New', monospace;
  --font-head:    'Syne', system-ui, sans-serif;
  --sidebar-w:    220px;
  --radius:       4px;
  --radius-lg:    8px;
}

html, body {
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 1.6;
}

/* ── LAYOUT ── */
body { display: flex; }

#sidebar {
  width: var(--sidebar-w);
  min-height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
}

#app {
  flex: 1;
  min-height: 100vh;
  padding: 32px 40px;
  overflow-y: auto;
  max-width: calc(100vw - var(--sidebar-w));
}

/* ── SIDEBAR ── */
.sidebar-logo {
  padding: 24px 20px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border);
}

.logo-mark {
  color: var(--accent);
  font-size: 18px;
  line-height: 1;
}

.logo-text {
  font-family: var(--font-head);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text);
}

.nav-links {
  list-style: none;
  padding: 12px 0;
  flex: 1;
}

.nav-links li a {
  display: block;
  padding: 9px 20px;
  color: var(--muted);
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 0.04em;
  transition: color 0.12s, background 0.12s;
  border-left: 2px solid transparent;
}

.nav-links li a:hover {
  color: var(--text);
  background: var(--surface-high);
}

.nav-links li a.active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: rgba(232, 255, 71, 0.05);
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted);
}

.status-dot.ok { background: var(--ok); }
.status-dot.error { background: var(--danger); }

/* ── TYPOGRAPHY ── */
h1 {
  font-family: var(--font-head);
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}

h2 {
  font-family: var(--font-head);
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}

h3 {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 10px;
}

.muted { color: var(--muted); }
.accent { color: var(--accent); }

/* ── SCREEN HEADER ── */
.screen-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.screen-header-left h1 { margin-bottom: 2px; }
.screen-header-left p { color: var(--muted); font-size: 12px; }

/* ── BUTTONS ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.12s, background 0.12s;
  text-decoration: none;
  letter-spacing: 0.02em;
}

.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-primary {
  background: var(--accent);
  color: #0e0e0f;
}

.btn-primary:hover:not(:disabled) { background: var(--accent-dim); }

.btn-secondary {
  background: var(--surface-high);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover:not(:disabled) { border-color: var(--muted); }

.btn-ghost {
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--border);
}

.btn-ghost:hover:not(:disabled) { color: var(--text); border-color: var(--muted); }

.btn-danger {
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
}

.btn-danger:hover:not(:disabled) { background: rgba(255,68,68,0.1); }

.btn-sm { padding: 5px 10px; font-size: 11px; }

/* ── CARDS ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 16px;
}

.card-grid {
  display: grid;
  gap: 16px;
}

.card-grid-2 { grid-template-columns: 1fr 1fr; }
.card-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
.card-grid-4 { grid-template-columns: repeat(4, 1fr); }

/* ── TABLES ── */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

thead th {
  padding: 10px 14px;
  text-align: left;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

tbody td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: middle;
}

tbody tr:last-child td { border-bottom: none; }

tbody tr:hover td { background: var(--surface-high); }

tbody tr { cursor: pointer; transition: background 0.08s; }

/* ── FORMS ── */
.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: grid;
  gap: 16px;
  margin-bottom: 16px;
}

.form-row-2 { grid-template-columns: 1fr 1fr; }
.form-row-3 { grid-template-columns: 1fr 1fr 1fr; }

label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 5px;
}

input, select, textarea {
  width: 100%;
  background: var(--surface-high);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 10px;
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 13px;
  transition: border-color 0.12s;
  -webkit-appearance: none;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
}

input::placeholder, textarea::placeholder { color: var(--muted); }

textarea { resize: vertical; min-height: 80px; }

select option { background: var(--surface-high); }

/* ── TABS ── */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.tab-btn {
  padding: 10px 18px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
  margin-bottom: -1px;
  white-space: nowrap;
}

.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ── STATUS CHIPS ── */
.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.chip-new       { background: rgba(107,107,107,0.2); color: var(--muted); }
.chip-planned   { background: rgba(232,255,71,0.1);  color: var(--accent); }
.chip-scoped    { background: rgba(74,144,226,0.15); color: #4a90e2; }
.chip-work_complete { background: rgba(76,175,121,0.15); color: var(--ok); }
.chip-complete  { background: rgba(76,175,121,0.2);  color: var(--ok); }
.chip-on_hold   { background: rgba(255,179,71,0.15); color: var(--warn); }
.chip-aborted   { background: rgba(255,68,68,0.1);   color: var(--danger); }

/* ── RISK SCORE PILLS ── */
.risk-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

.risk-pill::before {
  content: '';
  display: block;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
}

.risk-low    { background: rgba(76,175,121,0.12); color: var(--ok); }
.risk-low::before { background: var(--ok); }
.risk-medium { background: rgba(255,179,71,0.12); color: var(--warn); }
.risk-medium::before { background: var(--warn); }
.risk-high   { background: rgba(255,68,68,0.12); color: var(--danger); }
.risk-high::before { background: var(--danger); }

/* ── TOAST ── */
#toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}

.toast {
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 12px;
  animation: slideIn 0.2s ease;
  max-width: 320px;
}

.toast-success { background: var(--ok); color: #0e0e0f; }
.toast-error   { background: var(--danger); color: #fff; }

@keyframes slideIn {
  from { transform: translateX(20px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}

/* ── STAT CARDS (Dashboard) ── */
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.stat-value {
  font-family: var(--font-head);
  font-size: 32px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

/* ── MAP ── */
#map-container {
  height: 400px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 16px;
}

/* ── EMPTY STATE ── */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--muted);
}

.empty-state-icon { font-size: 32px; margin-bottom: 12px; }
.empty-state p { font-size: 13px; margin-bottom: 16px; }

/* ── MODAL ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px;
  width: 560px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
}

.modal-close:hover { color: var(--text); }

/* ── PERMISSION ITEMS ── */
.perm-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.perm-item:last-child { border-bottom: none; }

.perm-status-select {
  width: 130px;
  flex-shrink: 0;
}

.perm-label { flex: 1; font-size: 12px; }
.perm-authority { color: var(--muted); font-size: 11px; }

/* ── AI DRAFT SECTION ── */
.ai-section {
  background: rgba(232,255,71,0.04);
  border: 1px solid rgba(232,255,71,0.12);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-section p { font-size: 12px; color: var(--muted); }

/* ── LOADING ── */
.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.loading-icon {
  color: var(--accent);
  font-size: 28px;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(232,255,71,0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── COUNTRY CARD ── */
.country-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 12px;
}

.country-card h2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cred-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(232,255,71,0.1);
  color: var(--accent);
  border-radius: 3px;
  font-size: 10px;
  margin-right: 4px;
  margin-bottom: 4px;
}

/* ── RISK TABLE ── */
.risk-row-actions {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.12s;
}

tr:hover .risk-row-actions { opacity: 1; }

/* ── RESPONSIVE ── */
@media (max-width: 1200px) {
  .card-grid-4 { grid-template-columns: 1fr 1fr; }
}
```

- [ ] **Step 3: Write `public/app.js` skeleton**

```js
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
// SCREEN: DASHBOARD (stub — expanded in Task 12)
// ══════════════════════════════════════════════

async function renderDashboard() {
  document.getElementById('app').innerHTML = `<div class="loading-screen"><span class="loading-icon">◈</span></div>`;
  // Implemented in Task 12
}

// ══════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════

register('/dashboard', renderDashboard);

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', () => {
  getAuthHeader(); // trigger auth prompt if needed
  handleRoute();
});
```

- [ ] **Step 4: Smoke test — open in browser**

```bash
# From drone-ops/ directory, start the backend
ADMIN_USER=jack ADMIN_PASS=test ANTHROPIC_API_KEY=test NODE_ENV=development node server/index.js &
open http://localhost:3000
# Expected: browser prompts for username/password, then shows spinning ◈ logo
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: SPA shell, design system, auth flow, hash router"
```

---

## Task 12: Dashboard Screen

**Files:**
- Modify: `public/app.js` — replace `renderDashboard` stub

**Interfaces:**
- Consumes: `GET /api/jobs` (filters by upcoming dates), `GET /api/settings`
- Renders: 4 stat cards, upcoming jobs table, currency warnings

- [ ] **Step 1: Replace `renderDashboard` in `app.js`**

```js
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
```

- [ ] **Step 2: Add `openCreateJobModal` function**

```js
async function openCreateJobModal(prefill = {}) {
  const clients = await apiFetch('/api/clients');
  const aircraft = await apiFetch('/api/settings').then(() => apiFetch('/api/jobs')).catch(() => []);
  // We need aircraft list — fetch from a dedicated endpoint or use the seeded aircraft
  // Aircraft list is not exposed via API yet — add a simple endpoint
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
```

- [ ] **Step 3: Register route**

In the BOOT section, add:
```js
register('/dashboard', renderDashboard);
register('/', renderDashboard);
```

- [ ] **Step 4: Verify in browser**

```bash
node server/index.js &
open http://localhost:3000/#/dashboard
# Expected: 4 stat cards, empty upcoming jobs table, PDRA01 expiry shown
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: dashboard screen with stats and upcoming jobs"
```

---

## Task 13: Jobs List Screen

**Files:**
- Modify: `public/app.js` — add `renderJobsList`

**Interfaces:**
- Consumes: `GET /api/jobs[?status=&country=]`
- Renders: filterable table, click to navigate to job detail

- [ ] **Step 1: Add `renderJobsList` to `app.js`**

```js
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
```

- [ ] **Step 2: Register route**

```js
register('/jobs', renderJobsList);
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: jobs list screen with filters"
```

---

## Task 14: Job Detail — Overview + Permissions Tabs

**Files:**
- Modify: `public/app.js` — add `renderJobDetail` with tab infrastructure, Overview tab, Permissions tab

**Interfaces:**
- Consumes: `GET /api/jobs/:id`, `GET /api/jobs/:id/permissions`, `PUT /api/jobs/:id`, `PUT /api/jobs/:id/permissions`
- Produces: `renderJobDetail(params)` — tab container with 6 tabs; each tab lazy-loaded

- [ ] **Step 1: Add `renderJobDetail` and tab shell**

```js
// ── SHARED JOB STATE (populated once per job detail view)
let _currentJob = null;
let _currentJobId = null;

async function renderJobDetail({ id }) {
  _currentJobId = id;
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><span class="loading-icon">◈</span></div>`;
  _currentJob = await apiFetch(`/api/jobs/${id}`);

  const TABS = [
    { key: 'overview',   label: 'Overview' },
    { key: 'permissions',label: 'Permissions' },
    { key: 'map',        label: 'Map & Survey' },
    { key: 'risks',      label: 'Risks' },
    { key: 'method',     label: 'Method Statement' },
    { key: 'document',   label: 'Document' },
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
    overview: renderOverviewTab,
    permissions: renderPermissionsTab,
    map: renderMapTab,
    risks: renderRisksTab,
    method: renderMethodTab,
    document: renderDocumentTab,
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
```

- [ ] **Step 2: Add `renderOverviewTab`**

```js
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
    // Preserve JSON fields
    body.airspace_users = _currentJob.airspace_users;
    body.area_of_operations = _currentJob.area_of_operations;
    body.ground_risk_summary = _currentJob.ground_risk_summary;
    body.map_static_image_url = _currentJob.map_static_image_url;
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
```

- [ ] **Step 3: Add `/api/aircraft` route to backend**

Add `server/routes/aircraft.js`:
```js
import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();
router.get('/', (_req, res) => res.json(getDb().prepare('SELECT * FROM aircraft WHERE archived=0 ORDER BY make,model').all()));
export default router;
```

Mount in `server/index.js`:
```js
import aircraftRouter from './routes/aircraft.js';
app.use('/api/aircraft', aircraftRouter);
```

- [ ] **Step 4: Add `renderPermissionsTab`**

```js
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
```

- [ ] **Step 5: Register route**

```js
register('/jobs/:id', renderJobDetail);
```

- [ ] **Step 6: Commit**

```bash
git add public/app.js server/routes/aircraft.js server/index.js
git commit -m "feat: job detail shell, overview tab, permissions tab, aircraft API"
```

---

## Task 15: Job Detail — Map & Survey Tab

**Files:**
- Modify: `public/app.js` — add `renderMapTab`

**Interfaces:**
- Consumes: `GET /api/airspace`, `POST /api/ai/ground-risk`, `PUT /api/jobs/:id`
- Uses Mapbox GL JS for satellite map + polygon drawing
- Exports drawn polygon as Mapbox Static Image URL

- [ ] **Step 1: Add `renderMapTab` to `app.js`**

```js
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
      <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="saveAirspaceUsers()">Save Airspace Users</button>
    </div>

    <div id="ground-risk-section" style="margin-top:20px">
      <h2>Ground Risk Assessment</h2>
      <textarea id="ground-risk-text" rows="8" style="width:100%">${j.ground_risk_summary || ''}</textarea>
      <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="saveGroundRisk()">Save Ground Risk</button>
    </div>
  `;

  // Init Mapbox
  mapboxgl.accessToken = settings.mapbox_token || (window._mapboxToken || '');
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
    const body = {
      ...j,
      area_of_operations: drawnPolygon,
      airspace_users: j.airspace_users,
    };
    // Mapbox Static Image URL
    const coords = drawnPolygon.coordinates[0].map(c => c.join(',')).join(',');
    const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encodeURIComponent(JSON.stringify({ type:'Feature', geometry: drawnPolygon, properties: {} }))})/${center[0]},${center[1]},13/800x400@2x?access_token=${mapboxgl.accessToken}`;
    body.map_static_image_url = staticUrl;
    _currentJob = await apiFetch(`/api/jobs/${_currentJobId}`, { method: 'PUT', body });
    showToast('Area of operations saved');
  }

  // Fetch airspace
  let airspaceData = { aerodromes: [], hospitals: [], airspaceZones: [] };
  let airspaceUsers = Array.isArray(j.airspace_users) ? j.airspace_users : [];

  document.getElementById('btn-fetch-airspace').addEventListener('click', async e => {
    if (!j.lat || !j.lng) { showToast('Set lat/lng in Overview tab first', 'error'); return; }
    await savePolygonToJob();
    e.target.disabled = true;
    e.target.innerHTML = '<span class="spinner"></span> Fetching…';
    try {
      airspaceData = await apiFetch(`/api/airspace?lat=${j.lat}&lng=${j.lng}&radius_km=20`);
      // Merge into airspace users format
      const aeroRows = airspaceData.aerodromes.map(a => ({
        id: a.icao || a.name,
        name: a.name, type: a.type || 'AERODROME',
        icao: a.icao, distance_km: a.distance_km,
        phone: a.phone, notified: false, notes: '', selected: true,
      }));
      const hospRows = airspaceData.hospitals.map(h => ({
        id: `HOSP-${h.name}`,
        name: h.name, type: 'HOSPITAL',
        icao: null, distance_km: h.distance_km,
        phone: h.phone, notified: false, notes: '', selected: true,
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
              <td><input type="checkbox" ${a.selected!==false?'checked':''} onchange="toggleAirspaceUser(${i}, this.checked)"></td>
              <td>${a.name}</td><td>${a.type}</td><td>${a.icao||'—'}</td>
              <td>${a.distance_km?.toFixed(1)||'—'} km</td><td>${a.phone||'—'}</td>
              <td><input type="checkbox" ${a.notified?'checked':''} onchange="setAirspaceNotified(${i}, this.checked)"></td>
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
      const { ground_risk_summary } = await apiFetch('/api/ai/ground-risk', {
        method: 'POST',
        body: {
          polygon: drawnPolygon,
          airspace_class: _currentJob.airspace_class,
          location_name: _currentJob.location_name,
          lat: _currentJob.lat,
          lng: _currentJob.lng,
        },
      });
      document.getElementById('ground-risk-text').value = ground_risk_summary;
      _currentJob.ground_risk_summary = ground_risk_summary;
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
```

- [ ] **Step 2: Add Mapbox token to settings**

Add `mapbox_token` field to settings table — add migration in `server/db.js`:

After the `CREATE TABLE IF NOT EXISTS settings` block, add:
```js
// Add mapbox_token column if missing (migration)
try { db.exec('ALTER TABLE settings ADD COLUMN mapbox_token TEXT'); } catch {}
```

Add to `.env.example`:
```
MAPBOX_TOKEN=pk.eyJ1...
```

Add to the settings route `PUT` fields array:
```js
const fields = [..., 'mapbox_token'];
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js server/db.js server/routes/settings.js
git commit -m "feat: map & survey tab — polygon drawing, airspace fetch, ground risk generation"
```

---

## Task 16: Job Detail — Risks + Method Statement Tabs

**Files:**
- Modify: `public/app.js` — add `renderRisksTab`, `renderMethodTab`

- [ ] **Step 1: Add `renderRisksTab`**

```js
async function renderRisksTab() {
  let risks = await apiFetch(`/api/jobs/${_currentJobId}/risks`);

  function renderTable() {
    document.getElementById('risks-tbody').innerHTML = risks.length
      ? risks.map(r => {
          const initScore = riskScore(r.severity, r.probability);
          const residScore = riskScore(r.residual_severity, r.residual_probability);
          return `
          <tr>
            <td>${r.hazard || '—'}</td>
            <td style="font-size:11px;color:var(--muted)">${r.cause || '—'}</td>
            <td style="font-size:11px">${r.consequence || '—'}</td>
            <td>${r.severity||'—'}</td><td>${r.probability||'—'}</td>
            <td>${riskPill(r.severity, r.probability)}</td>
            <td style="font-size:11px;max-width:200px">${r.mitigations || '—'}</td>
            <td>${r.residual_severity||'—'}</td><td>${r.residual_probability||'—'}</td>
            <td>${riskPill(r.residual_severity, r.residual_probability)}</td>
            <td>
              <div class="risk-row-actions">
                <button class="btn btn-ghost btn-sm" onclick="editRisk('${r.id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteRisk('${r.id}')">✕</button>
              </div>
            </td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:32px">No risks added yet.</td></tr>`;
  }

  document.getElementById('tab-content').innerHTML = `
    <div class="ai-section" style="margin-bottom:16px">
      <p>AI can draft an initial risk table based on this job's details and ground risk assessment.</p>
      <button class="btn btn-primary btn-sm" id="btn-ai-risks">AI Draft Risks</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h2>Risk Assessment</h2>
      <button class="btn btn-secondary btn-sm" onclick="openAddRiskModal()">+ Add Risk</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Hazard</th><th>Cause</th><th>Consequence</th>
            <th>S</th><th>P</th><th>Initial</th>
            <th>Mitigations</th>
            <th>RS</th><th>RP</th><th>Residual</th><th></th>
          </tr>
        </thead>
        <tbody id="risks-tbody"></tbody>
      </table>
    </div>
  `;

  renderTable();

  document.getElementById('btn-ai-risks').addEventListener('click', async e => {
    e.target.disabled = true;
    e.target.innerHTML = '<span class="spinner"></span> Drafting…';
    try {
      const aircraft = _currentJob.aircraft_id ? await apiFetch('/api/aircraft').then(list => list.find(a => a.id === _currentJob.aircraft_id)) : null;
      const { risks: drafted } = await apiFetch('/api/ai/risks', {
        method: 'POST',
        body: {
          job_title: _currentJob.title,
          description: _currentJob.description,
          operation_type: _currentJob.operation_type,
          location_name: _currentJob.location_name,
          aircraft_model: aircraft ? `${aircraft.make} ${aircraft.model}` : 'Unknown',
          ground_risk_summary: _currentJob.ground_risk_summary,
        },
      });
      // Insert all drafted risks
      for (const r of drafted) {
        const created = await apiFetch(`/api/jobs/${_currentJobId}/risks`, { method: 'POST', body: r });
        risks.push(created);
      }
      renderTable();
      showToast(`${drafted.length} risk rows drafted`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { e.target.disabled = false; e.target.textContent = 'AI Draft Risks'; }
  });

  window.deleteRisk = async (id) => {
    if (!confirm('Remove this risk row?')) return;
    await apiFetch(`/api/jobs/${_currentJobId}/risks/${id}`, { method: 'DELETE' });
    risks = risks.filter(r => r.id !== id);
    renderTable();
  };

  window.editRisk = (id) => openRiskModal(risks.find(r => r.id === id));

  window.openAddRiskModal = () => openRiskModal(null);

  function openRiskModal(risk) {
    const isEdit = !!risk;
    const overlay = openModal(`
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Risk' : 'Add Risk'}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <form id="risk-form">
        <div class="form-group"><label>Hazard *</label><input name="hazard" value="${risk?.hazard||''}" required></div>
        <div class="form-row form-row-2">
          <div class="form-group"><label>Cause</label><input name="cause" value="${risk?.cause||''}"></div>
          <div class="form-group"><label>Consequence</label><input name="consequence" value="${risk?.consequence||''}"></div>
        </div>
        <div class="form-row form-row-2">
          <div class="form-group"><label>Severity (1–5)</label><input type="number" min="1" max="5" name="severity" value="${risk?.severity||3}"></div>
          <div class="form-group"><label>Probability (1–5)</label><input type="number" min="1" max="5" name="probability" value="${risk?.probability||3}"></div>
        </div>
        <div class="form-group"><label>Mitigations</label><textarea name="mitigations" rows="3">${risk?.mitigations||''}</textarea></div>
        <div class="form-row form-row-2">
          <div class="form-group"><label>Residual Severity</label><input type="number" min="1" max="5" name="residual_severity" value="${risk?.residual_severity||2}"></div>
          <div class="form-group"><label>Residual Probability</label><input type="number" min="1" max="5" name="residual_probability" value="${risk?.residual_probability||2}"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add Risk'}</button>
        </div>
      </form>
    `);

    overlay.querySelector('#risk-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      ['severity','probability','residual_severity','residual_probability'].forEach(k => body[k] = parseInt(body[k]));
      try {
        if (isEdit) {
          const updated = await apiFetch(`/api/jobs/${_currentJobId}/risks/${risk.id}`, { method: 'PUT', body });
          risks = risks.map(r => r.id === risk.id ? updated : r);
        } else {
          const created = await apiFetch(`/api/jobs/${_currentJobId}/risks`, { method: 'POST', body });
          risks.push(created);
        }
        overlay.remove();
        renderTable();
        showToast(isEdit ? 'Risk updated' : 'Risk added');
      } catch (err) { showToast(err.message, 'error'); }
    });
  }
}
```

- [ ] **Step 2: Add `renderMethodTab`**

```js
async function renderMethodTab() {
  const j = _currentJob;

  document.getElementById('tab-content').innerHTML = `
    <div class="ai-section" style="margin-bottom:16px">
      <p>AI drafts a method statement in your voice, based on this job's details and aircraft.</p>
      <button class="btn btn-primary btn-sm" id="btn-ai-method">AI Draft Method Statement</button>
    </div>
    <div class="form-group">
      <label>Method Statement</label>
      <textarea id="method-text" rows="20" style="width:100%;font-size:12px">${j.method_statement || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-sm" onclick="saveMethod()">Save Method Statement</button>
  `;

  document.getElementById('btn-ai-method').addEventListener('click', async e => {
    e.target.disabled = true;
    e.target.innerHTML = '<span class="spinner"></span> Drafting…';
    try {
      const aircraft = j.aircraft_id ? await apiFetch('/api/aircraft').then(list => list.find(a => a.id === j.aircraft_id)) : null;
      const { method_statement } = await apiFetch('/api/ai/method-statement', {
        method: 'POST',
        body: {
          job_title: j.title,
          description: j.description,
          operation_type: j.operation_type,
          location_name: j.location_name,
          aircraft_model: aircraft ? `${aircraft.make} ${aircraft.model}` : 'Unknown',
          crew_structure: 'Remote Pilot + Visual Observer',
        },
      });
      document.getElementById('method-text').value = method_statement;
      showToast('Method statement drafted');
    } catch (err) { showToast(err.message, 'error'); }
    finally { e.target.disabled = false; e.target.textContent = 'AI Draft Method Statement'; }
  });

  window.saveMethod = async () => {
    const text = document.getElementById('method-text').value;
    try {
      _currentJob = await apiFetch(`/api/jobs/${_currentJobId}`, {
        method: 'PUT',
        body: { ..._currentJob, method_statement: text },
      });
      showToast('Method statement saved');
    } catch (err) { showToast(err.message, 'error'); }
  };
}
```

- [ ] **Step 3: Add `method_statement` column to jobs table**

In `server/db.js`, after schema creation:
```js
try { db.exec('ALTER TABLE jobs ADD COLUMN method_statement TEXT'); } catch {}
```

In `server/routes/jobs.js`, add `method_statement` to the PUT update fields:
```js
// In the UPDATE statement, add method_statement=? and pass req.body.method_statement || null
```

- [ ] **Step 4: Commit**

```bash
git add public/app.js server/db.js server/routes/jobs.js
git commit -m "feat: risks tab with AI draft, method statement tab with AI draft"
```

---

## Task 17: Job Detail — Document Tab

**Files:**
- Modify: `public/app.js` — add `renderDocumentTab`

- [ ] **Step 1: Add `renderDocumentTab`**

```js
async function renderDocumentTab() {
  let docs = await apiFetch(`/api/documents/job/${_currentJobId}`);

  function renderDocList() {
    document.getElementById('doc-list').innerHTML = docs.length
      ? docs.map(d => `
        <tr>
          <td>v${d.version}</td>
          <td>${fmtDate(d.created_at)}</td>
          <td>
            <a href="/api/documents/${d.id}/html" target="_blank" class="btn btn-secondary btn-sm">Open for Print</a>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">No documents generated yet.</td></tr>`;
  }

  document.getElementById('tab-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>RAMS Documents</h2>
      <button class="btn btn-primary" id="btn-generate-doc">Generate RAMS</button>
    </div>
    <p class="muted" style="font-size:12px;margin-bottom:20px">
      Generate snapshot → Open for Print → Print → Save as PDF (⌘P in Chrome/Safari)
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Version</th><th>Generated</th><th>Action</th></tr></thead>
        <tbody id="doc-list"></tbody>
      </table>
    </div>
  `;

  renderDocList();

  document.getElementById('btn-generate-doc').addEventListener('click', async e => {
    e.target.disabled = true;
    e.target.innerHTML = '<span class="spinner"></span> Generating…';
    try {
      const doc = await apiFetch('/api/documents', { method: 'POST', body: { job_id: _currentJobId } });
      docs.unshift(doc);
      renderDocList();
      showToast(`RAMS v${doc.version} generated — click Open for Print`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { e.target.disabled = false; e.target.textContent = 'Generate RAMS'; }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: document tab — generate and open RAMS for printing"
```

---

## Task 18: Clients, Countries, Settings Screens

**Files:**
- Modify: `public/app.js` — add `renderClients`, `renderCountries`, `renderSettings`

- [ ] **Step 1: Add `renderClients`**

```js
async function renderClients() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><span class="loading-icon">◈</span></div>`;
  let clients = await apiFetch('/api/clients');

  function renderTable() {
    document.getElementById('clients-tbody').innerHTML = clients.length
      ? clients.map(c => `
        <tr onclick="openClientModal('${c.id}')">
          <td>${c.name}</td>
          <td>${c.contact_name || '—'}</td>
          <td>${c.email || '—'}</td>
          <td>${c.phone || '—'}</td>
          <td>${c.job_count || 0}</td>
        </tr>`).join('')
      : `<tr><td colspan="5"><div class="empty-state" style="padding:32px"><p>No clients yet.</p></div></td></tr>`;
  }

  app.innerHTML = `
    <div class="screen-header">
      <div class="screen-header-left"><h1>Clients</h1><p>${clients.length} clients</p></div>
      <button class="btn btn-primary" onclick="openClientModal(null)">+ New Client</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Jobs</th></tr></thead>
        <tbody id="clients-tbody"></tbody>
      </table>
    </div>
  `;
  renderTable();

  window.openClientModal = async (id) => {
    const client = id ? clients.find(c => c.id === id) : null;
    const overlay = openModal(`
      <div class="modal-header">
        <h2>${client ? 'Edit Client' : 'New Client'}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <form id="client-form">
        <div class="form-group"><label>Name *</label><input name="name" value="${client?.name||''}" required></div>
        <div class="form-row form-row-2">
          <div class="form-group"><label>Contact Name</label><input name="contact_name" value="${client?.contact_name||''}"></div>
          <div class="form-group"><label>Email</label><input type="email" name="email" value="${client?.email||''}"></div>
        </div>
        <div class="form-row form-row-2">
          <div class="form-group"><label>Phone</label><input name="phone" value="${client?.phone||''}"></div>
          <div class="form-group"><label>Address</label><input name="address" value="${client?.address||''}"></div>
        </div>
        <div class="form-group"><label>Notes</label><textarea name="notes" rows="2">${client?.notes||''}</textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          ${client ? `<button type="button" class="btn btn-danger btn-sm" onclick="archiveClient('${client.id}', this.closest('.modal-overlay'))">Archive</button>` : ''}
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${client ? 'Save' : 'Create'}</button>
        </div>
      </form>
    `);

    overlay.querySelector('#client-form').addEventListener('submit', async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (client) {
          const updated = await apiFetch(`/api/clients/${client.id}`, { method: 'PUT', body });
          clients = clients.map(c => c.id === client.id ? { ...c, ...updated } : c);
        } else {
          const created = await apiFetch('/api/clients', { method: 'POST', body });
          clients.unshift(created);
        }
        overlay.remove();
        renderTable();
        showToast(client ? 'Client updated' : 'Client created');
      } catch (err) { showToast(err.message, 'error'); }
    });
  };

  window.archiveClient = async (id, overlayEl) => {
    if (!confirm('Archive this client?')) return;
    await apiFetch(`/api/clients/${id}`, { method: 'DELETE' });
    clients = clients.filter(c => c.id !== id);
    overlayEl.remove();
    renderTable();
    showToast('Client archived');
  };
}
```

- [ ] **Step 2: Add `renderCountries`**

```js
async function renderCountries() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><span class="loading-icon">◈</span></div>`;
  const countries = await apiFetch('/api/countries');

  const cards = Object.entries(countries).map(([code, c]) => `
    <div class="country-card">
      <h2>
        <span>${c.name}</span>
        <span class="muted" style="font-size:11px">${c.regulatory_body} · ${c.framework}</span>
      </h2>
      <div style="margin-bottom:10px">
        ${(c.jack_credentials || []).map(cred => `<span class="cred-badge">${cred}</span>`).join('')}
      </div>
      <h3>Required Permissions</h3>
      <div class="table-wrap" style="margin-bottom:12px">
        <table>
          <thead><tr><th>Permission</th><th>Authority</th><th>Lead Time</th><th>Notes</th></tr></thead>
          <tbody>
            ${(c.permissions || []).map(p => `
              <tr>
                <td>${p.label}</td>
                <td>${p.authority || '—'}</td>
                <td>${p.lead_time_days > 0 ? p.lead_time_days + ' days' : 'Same day'}</td>
                <td style="font-size:11px;color:var(--muted)">${p.notes || ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${c.notes ? `<p style="font-size:12px;color:var(--muted)">${c.notes}</p>` : ''}
    </div>
  `).join('');

  app.innerHTML = `
    <div class="screen-header">
      <div class="screen-header-left">
        <h1>Countries</h1>
        <p>Regulatory reference — edit knowledge/countries.json to update</p>
      </div>
    </div>
    ${cards}
  `;
}
```

- [ ] **Step 3: Add `renderSettings`**

```js
async function renderSettings() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><span class="loading-icon">◈</span></div>`;
  const [settings, aircraft] = await Promise.all([
    apiFetch('/api/settings'),
    apiFetch('/api/aircraft'),
  ]);

  app.innerHTML = `
    <div class="screen-header">
      <div class="screen-header-left"><h1>Settings</h1></div>
    </div>
    <div class="card-grid card-grid-2">
      <div>
        <h2>Pilot Details &amp; Credentials</h2>
        <form id="settings-form">
          <div class="form-group"><label>Full Name</label><input name="name" value="${settings.name||''}"></div>
          <div class="form-row form-row-2">
            <div class="form-group"><label>Email</label><input name="email" value="${settings.email||''}"></div>
            <div class="form-group"><label>Phone</label><input name="phone" value="${settings.phone||''}"></div>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group"><label>Operator ID</label><input name="operator_id" value="${settings.operator_id||''}"></div>
            <div class="form-group"><label>Flyer ID</label><input name="flyer_id" value="${settings.flyer_id||''}"></div>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group"><label>Flyer ID Expiry</label><input type="date" name="flyer_id_expiry" value="${settings.flyer_id_expiry||''}"></div>
            <div class="form-group"><label>PDRA01 Ref</label><input name="pdra01_ref" value="${settings.pdra01_ref||''}"></div>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group"><label>PDRA01 Expiry</label><input type="date" name="pdra01_expiry" value="${settings.pdra01_expiry||''}"></div>
            <div class="form-group"><label>GVC Ref</label><input name="gvc_ref" value="${settings.gvc_ref||''}"></div>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group"><label>FAA Part 107</label><input name="faa_part107_ref" value="${settings.faa_part107_ref||''}"></div>
            <div class="form-group"><label>Irish IAA Ref</label><input name="iau_ref" value="${settings.iau_ref||''}"></div>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group"><label>Document Accent Colour</label><input type="color" name="document_accent_colour" value="${settings.document_accent_colour||'#1d4ed8'}" style="height:38px"></div>
            <div class="form-group"><label>Mapbox Token</label><input name="mapbox_token" value="${settings.mapbox_token||''}"></div>
          </div>
          <div class="form-group"><label>AI Style Prompt</label>
            <textarea name="ai_style_prompt" rows="3" placeholder="Write in a professional but direct style...">${settings.ai_style_prompt||''}</textarea>
          </div>
          <button type="submit" class="btn btn-primary">Save Settings</button>
        </form>
      </div>
      <div>
        <h2>Aircraft Fleet</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Aircraft</th><th>Weight</th><th>Max Wind</th><th>Prop Protection</th></tr></thead>
            <tbody>
              ${aircraft.map(a => `
                <tr>
                  <td>${a.make} ${a.model}<br><span class="muted" style="font-size:10px">${a.identifier||''}</span></td>
                  <td>${a.weight_g ? a.weight_g + 'g' : '—'}</td>
                  <td>${a.max_wind_ms ? a.max_wind_ms + ' m/s' : '—'}</td>
                  <td>${a.prop_protection || '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="muted" style="font-size:11px;margin-top:8px">Aircraft fleet is pre-seeded. Edit server/db.js to add/remove aircraft.</p>
      </div>
    </div>
  `;

  document.getElementById('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await apiFetch('/api/settings', { method: 'PUT', body });
      showToast('Settings saved');
    } catch (err) { showToast(err.message, 'error'); }
  });
}
```

- [ ] **Step 4: Register all routes in BOOT section**

```js
register('/dashboard', renderDashboard);
register('/', renderDashboard);
register('/jobs', renderJobsList);
register('/jobs/:id', renderJobDetail);
register('/clients', renderClients);
register('/countries', renderCountries);
register('/settings', renderSettings);
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
# All backend tests still passing
```

- [ ] **Step 6: Commit**

```bash
git add public/app.js
git commit -m "feat: clients, countries, settings screens — full SPA complete"
```

---

## Task 19: End-to-End Smoke Test

- [ ] **Step 1: Start the server**

```bash
ADMIN_USER=jack ADMIN_PASS=test ANTHROPIC_API_KEY=your-key NODE_ENV=development node server/index.js
```

- [ ] **Step 2: Walk the happy path**

Open `http://localhost:3000` and verify each step:

1. Login prompt accepts `jack` / `test` credentials
2. Dashboard loads — 4 stat cards visible, PDRA01 expiry shown
3. Click `+ New Job` → modal appears → create "Test Production" for country UK
4. Redirects to job detail → Overview tab populated
5. Switch to Permissions tab → 3 UK permissions pre-seeded
6. Switch to Overview → fill in lat/lng (51.5074, -0.1278) → Save
7. Switch to Map & Survey → Mapbox satellite map loads (if token set) → draw polygon → Fetch Airspace → hospitals appear
8. Click Generate Ground Risk → AI response populates textarea → Save
9. Switch to Risks → AI Draft Risks → 8-12 rows appear
10. Switch to Method Statement → AI Draft → text appears
11. Switch to Document → Generate RAMS → Open for Print opens HTML in new tab with correct styling
12. Navigate to Clients → create BBC Studios
13. Navigate to Countries → UK, US, CA, IE, AT all show regulatory data
14. Navigate to Settings → credentials pre-filled from seed data

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: end-to-end smoke test complete — v1.0 ready for Railway deploy"
```

- [ ] **Step 5: Deploy to Railway**

```bash
railway login
railway up
```

Set environment variables in Railway dashboard:
- `ADMIN_USER`, `ADMIN_PASS`, `ANTHROPIC_API_KEY`, `OPENAIP_API_KEY`, `NODE_ENV=production`

Update Settings screen in the live app: add `MAPBOX_TOKEN` via the Settings form.
