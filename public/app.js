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
