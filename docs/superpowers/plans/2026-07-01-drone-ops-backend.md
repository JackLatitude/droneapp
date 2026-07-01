# Drone Ops — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Node.js/Express/SQLite backend for a personal drone operations planning app — REST API, AI integration, airspace proxy, and RAMS document generation.

**Architecture:** Single Express app serving REST API and static frontend. SQLite via better-sqlite3 for all persistent data. AI calls (Claude Sonnet) are server-side only. External APIs (OpenAIP, Overpass, Mapbox Static) are proxied through Express so no keys leak to the browser.

**Tech Stack:** Node.js 20+, Express 4, better-sqlite3, Anthropic SDK (@anthropic-ai/sdk), Jest + Supertest, node-fetch (for OpenAIP/Overpass calls)

## Global Constraints

- Node.js 20+ required (`crypto.randomUUID()` built-in, no uuid package)
- No TypeScript — plain JS throughout
- No ORM — raw better-sqlite3 SQL only
- All IDs are UUIDs from `crypto.randomUUID()`
- All Express routes return `{ error: "message" }` JSON on failure with correct HTTP status
- HTTP Basic Auth on all routes (username/password from env vars `ADMIN_USER` / `ADMIN_PASS`)
- AI calls have 30s timeout; if Claude API unavailable return `{ error: "AI unavailable", fallback: true }`
- SQLite transactions for all multi-table writes
- Jest globals: `describe`, `it`, `expect`, `beforeAll`, `afterAll` — no import needed if `testEnvironment` is `node`
- Test DB is in-memory: `new Database(':memory:')`

---

## File Map

```
drone-ops/
├── server/
│   ├── index.js              # Express app, middleware, route mounting, static serving
│   ├── db.js                 # Schema creation, migrations, seed data
│   ├── auth.js               # HTTP Basic Auth middleware
│   └── routes/
│       ├── clients.js        # CRUD /api/clients
│       ├── jobs.js           # CRUD /api/jobs (includes airspace_users + area_of_operations JSON cols)
│       ├── job-permissions.js # /api/jobs/:id/permissions
│       ├── job-risks.js      # /api/jobs/:id/risks
│       ├── settings.js       # GET/PUT /api/settings (single row)
│       ├── countries.js      # GET /api/countries (reads knowledge/countries.json)
│       ├── airspace.js       # GET /api/airspace — OpenAIP proxy + NHS hospital lookup
│       ├── ai.js             # POST /api/ai/ground-risk, /api/ai/risks, /api/ai/method-statement
│       └── documents.js      # POST /api/documents, GET /api/documents/:id/html
├── server/templates/
│   └── rams.js               # generateRams(job, risks, airspaceUsers, settings) → HTML string
├── knowledge/
│   ├── countries.json        # Regulatory data for uk, us, ca, ie, at
│   ├── ops-manual.md         # Extracted from Jack's DOCX (placeholder until extracted)
│   └── uk-hospitals.json     # NHS helipad/hospital dataset
├── tests/
│   ├── helpers.js            # createTestDb(), closeTestDb()
│   └── routes/
│       ├── clients.test.js
│       ├── jobs.test.js
│       ├── job-permissions.test.js
│       ├── job-risks.test.js
│       ├── airspace.test.js
│       ├── ai.test.js
│       └── documents.test.js
├── .env.example
├── package.json
└── railway.toml
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `railway.toml`
- Create: `server/index.js`
- Create: `server/auth.js`

**Interfaces:**
- Produces: `app` (Express instance, exported from `server/index.js` for test imports), HTTP server listening on `process.env.PORT || 3000`

- [ ] **Step 1: Initialise project**

```bash
mkdir -p drone-ops/server/routes drone-ops/server/templates drone-ops/knowledge drone-ops/tests/routes drone-ops/public
cd drone-ops
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install express better-sqlite3 @anthropic-ai/sdk node-fetch
npm install --save-dev jest supertest
```

- [ ] **Step 3: Write `package.json` scripts**

Edit `package.json` — replace the `scripts` block:
```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js",
    "test": "jest --runInBand"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"]
  }
}
```

- [ ] **Step 4: Write `.env.example`**

```
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_USER=jack
ADMIN_PASS=changeme
OPENAIP_API_KEY=
MAPBOX_TOKEN=
PORT=3000
NODE_ENV=development
```

- [ ] **Step 5: Write `railway.toml`**

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server/index.js"
healthcheckPath = "/api/health"
```

- [ ] **Step 6: Write `server/auth.js`**

```js
export function basicAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const b64 = header.replace('Basic ', '');
  const [user, pass] = Buffer.from(b64, 'base64').toString().split(':');
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="drone-ops"');
  res.status(401).json({ error: 'Unauthorized' });
}
```

- [ ] **Step 7: Write `server/index.js`**

```js
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { basicAuth } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(basicAuth);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Routes mounted in later tasks

app.use(express.static(join(__dirname, '../public')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`drone-ops running on :${port}`));
}
```

> Note: `package.json` must have `"type": "module"` for ES module imports.

- [ ] **Step 8: Add `"type": "module"` to `package.json`**

Add to `package.json` root:
```json
"type": "module"
```

> Note: Jest needs `--experimental-vm-modules` for ES modules. Update jest config:

```json
"jest": {
  "testEnvironment": "node",
  "testMatch": ["**/tests/**/*.test.js"],
  "transform": {}
},
"scripts": {
  "test": "node --experimental-vm-modules node_modules/.bin/jest --runInBand"
}
```

- [ ] **Step 9: Smoke test — verify server starts**

```bash
ADMIN_USER=jack ADMIN_PASS=test NODE_ENV=development node server/index.js &
curl -u jack:test http://localhost:3000/api/health
# Expected: {"ok":true}
kill %1
```

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "feat: project scaffold — Express app, auth, health endpoint"
```

---

## Task 2: Database Schema + Seed

**Files:**
- Create: `server/db.js`
- Create: `tests/helpers.js`

**Interfaces:**
- Produces: `getDb()` — returns the singleton `Database` instance
- Produces: `initDb(db)` — creates all tables (idempotent, uses `CREATE TABLE IF NOT EXISTS`)
- Produces: `createTestDb()` / `closeTestDb(db)` exported from `tests/helpers.js`

- [ ] **Step 1: Write `server/db.js`**

```js
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let _db;

export function getDb() {
  if (!_db) {
    const path = process.env.DB_PATH || join(__dirname, '../drone-ops.db');
    _db = new Database(path);
    _db.pragma('journal_mode = WAL');
    initDb(_db);
  }
  return _db;
}

export function initDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT, email TEXT, phone TEXT,
      operator_id TEXT, flyer_id TEXT, flyer_id_expiry TEXT,
      pdra01_ref TEXT, pdra01_expiry TEXT,
      gvc_ref TEXT, gvc_expiry TEXT,
      faa_part107_ref TEXT, faa_part107_expiry TEXT,
      iau_ref TEXT, iau_expiry TEXT,
      document_logo_path TEXT,
      document_accent_colour TEXT DEFAULT '#1d4ed8',
      ai_style_prompt TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT, email TEXT, phone TEXT,
      address TEXT, notes TEXT,
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS aircraft (
      id TEXT PRIMARY KEY,
      make TEXT NOT NULL, model TEXT NOT NULL,
      identifier TEXT,
      weight_g INTEGER, diagonal_mm INTEGER,
      max_wind_ms REAL, kinetic_energy_kj REAL,
      prop_protection TEXT, notes TEXT,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      client_id TEXT REFERENCES clients(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'new',
      operation_type TEXT DEFAULT 'UK_PDRA01',
      country TEXT DEFAULT 'uk',
      start_date TEXT, start_time TEXT, end_time TEXT,
      location_name TEXT, location_address TEXT,
      lat REAL, lng REAL, elevation_ft INTEGER,
      airspace_class TEXT,
      airspace_users TEXT DEFAULT '[]',
      area_of_operations TEXT,
      map_static_image_url TEXT,
      ground_risk_summary TEXT,
      aircraft_id TEXT REFERENCES aircraft(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_permissions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      authority TEXT, contact TEXT, deadline TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS job_risks (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      hazard TEXT, cause TEXT, consequence TEXT,
      severity INTEGER DEFAULT 3, probability INTEGER DEFAULT 3,
      mitigations TEXT, residual_severity INTEGER, residual_probability INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id),
      version INTEGER DEFAULT 1,
      html_snapshot TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed settings row if absent
  const hasSettings = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!hasSettings) {
    db.prepare(`INSERT INTO settings (id, name, operator_id, flyer_id, pdra01_ref, gvc_ref, faa_part107_ref, iau_ref)
      VALUES (1, 'Jack Downes', 'GBR-OP-R3PNNYZFTPJJ', 'GBR-RP-CM4W8MR2V43L',
              'PDRA01-23281', 'GVC/ICARUS', 'FAA Part 107', 'IRL-RP-000008146ZAC')`).run();
  }

  // Seed aircraft fleet if absent
  const hasAircraft = db.prepare('SELECT id FROM aircraft LIMIT 1').get();
  if (!hasAircraft) {
    const insert = db.prepare(`INSERT INTO aircraft
      (id, make, model, identifier, weight_g, diagonal_mm, max_wind_ms, kinetic_energy_kj, prop_protection)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const fleet = [
      [crypto.randomUUID(), 'DJI', 'Inspire 3', 'INSPIRE3-01', 3995, 605, 12, 7.8, 'None'],
      [crypto.randomUUID(), 'DJI', 'Mavic 3E', 'MAVIC3E-01', 915, 380, 12, 0.5, 'None'],
      [crypto.randomUUID(), 'DJI', 'Mini 3 Pro', 'MINI3P-01', 249, 251, 10.7, 0.14, 'None'],
      [crypto.randomUUID(), 'DJI', 'Mini 5 Pro', 'MINI5P-01', 299, 255, 10.7, 0.17, 'None'],
      [crypto.randomUUID(), 'DJI', 'Avata 2', 'AVATA2-01', 377, 180, 8, 0.14, 'Integrated ducts'],
    ];
    const seedAll = db.transaction(() => fleet.forEach(f => insert.run(...f)));
    seedAll();
  }
}
```

- [ ] **Step 2: Write `tests/helpers.js`**

```js
import Database from 'better-sqlite3';
import { initDb } from '../server/db.js';

export function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  initDb(db);
  return db;
}

export function closeTestDb(db) {
  db.close();
}
```

- [ ] **Step 3: Write schema smoke test**

Create `tests/db.test.js`:
```js
import { createTestDb, closeTestDb } from './helpers.js';

describe('DB schema', () => {
  let db;
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => closeTestDb(db));

  it('creates all tables', () => {
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    ).all().map(r => r.name);
    expect(tables).toEqual(expect.arrayContaining([
      'aircraft','clients','documents','job_permissions','job_risks','jobs','settings'
    ]));
  });

  it('seeds settings row', () => {
    const s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    expect(s.name).toBe('Jack Downes');
    expect(s.operator_id).toBe('GBR-OP-R3PNNYZFTPJJ');
  });

  it('seeds 5 aircraft', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM aircraft').get();
    expect(count.n).toBe(5);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test tests/db.test.js
# Expected: PASS — 3 tests
```

- [ ] **Step 5: Commit**

```bash
git add server/db.js tests/helpers.js tests/db.test.js
git commit -m "feat: SQLite schema, seed data, test helpers"
```

---

## Task 3: Clients API

**Files:**
- Create: `server/routes/clients.js`
- Create: `tests/routes/clients.test.js`
- Modify: `server/index.js` — mount clients router

**Interfaces:**
- Consumes: `getDb()` from `server/db.js`
- Produces:
  - `GET /api/clients` → `[{ id, name, contact_name, email, phone, address, notes, archived, created_at, job_count }]`
  - `GET /api/clients/:id` → single client object
  - `POST /api/clients` body `{ name, contact_name?, email?, phone?, address?, notes? }` → created client
  - `PUT /api/clients/:id` body (same fields) → updated client
  - `DELETE /api/clients/:id` → archives (sets `archived=1`), returns `{ ok: true }`

- [ ] **Step 1: Write the failing test**

```js
// tests/routes/clients.test.js
import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';

// Inject test DB — patched in index.js via getDb export swap
// We need to mock getDb. Use a simple approach: set process.env.DB_PATH to :memory: won't work for shared instance.
// Instead, we'll directly patch the module. Use jest.unstable_mockModule.

let db;
const AUTH = { user: 'jack', pass: 'test' };

beforeAll(async () => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
});

describe('GET /api/clients', () => {
  it('returns empty array when no clients', async () => {
    // This test verifies the route exists and returns JSON
    // Full test requires DB injection — see below
    const res = await request(app)
      .get('/api/clients')
      .auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

> **Note on test DB injection:** The cleanest pattern without a DI framework is to add a `setDb(db)` export to `server/db.js` that overrides the singleton. Tests call `setDb(createTestDb())` in `beforeAll` and `setDb(null)` in `afterAll` to reset.

- [ ] **Step 2: Add `setDb` to `server/db.js`**

Add after the `let _db` line:
```js
export function setDb(db) { _db = db; }
```

- [ ] **Step 3: Write `server/routes/clients.js`**

```js
import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*, COUNT(j.id) as job_count
    FROM clients c
    LEFT JOIN jobs j ON j.client_id = c.id
    WHERE c.archived = 0
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
  res.json(clients);
});

router.get('/:id', (req, res) => {
  const client = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  res.json(client);
});

router.post('/', (req, res) => {
  const { name, contact_name, email, phone, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO clients (id, name, contact_name, email, phone, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, contact_name || null, email || null, phone || null, address || null, notes || null);
  res.status(201).json(getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, contact_name, email, phone, address, notes } = req.body;
  db.prepare(`
    UPDATE clients SET name=?, contact_name=?, email=?, phone=?, address=?, notes=?
    WHERE id=?
  `).run(name, contact_name || null, email || null, phone || null, address || null, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('UPDATE clients SET archived=1 WHERE id=?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Mount in `server/index.js`**

Add after the health route:
```js
import clientsRouter from './routes/clients.js';
app.use('/api/clients', clientsRouter);
```

- [ ] **Step 5: Write full test suite**

Replace `tests/routes/clients.test.js`:
```js
import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Clients API', () => {
  let clientId;

  it('POST /api/clients creates a client', async () => {
    const res = await request(app)
      .post('/api/clients')
      .auth(AUTH.user, AUTH.pass)
      .send({ name: 'BBC Studios', contact_name: 'Sarah Jones', email: 'sarah@bbc.co.uk' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('BBC Studios');
    clientId = res.body.id;
  });

  it('GET /api/clients returns the created client', async () => {
    const res = await request(app).get('/api/clients').auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.find(c => c.id === clientId)).toBeTruthy();
  });

  it('GET /api/clients/:id returns the client', async () => {
    const res = await request(app).get(`/api/clients/${clientId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('sarah@bbc.co.uk');
  });

  it('PUT /api/clients/:id updates the client', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ name: 'BBC Studios Updated', email: 'new@bbc.co.uk' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('BBC Studios Updated');
  });

  it('DELETE /api/clients/:id archives the client', async () => {
    const res = await request(app).delete(`/api/clients/${clientId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Should not appear in list
    const list = await request(app).get('/api/clients').auth(AUTH.user, AUTH.pass);
    expect(list.body.find(c => c.id === clientId)).toBeFalsy();
  });

  it('POST returns 400 if name missing', async () => {
    const res = await request(app).post('/api/clients').auth(AUTH.user, AUTH.pass).send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npm test tests/routes/clients.test.js
# Expected: PASS — 7 tests
```

- [ ] **Step 7: Commit**

```bash
git add server/routes/clients.js server/index.js tests/routes/clients.test.js
git commit -m "feat: clients CRUD API"
```

---

## Task 4: Jobs API

**Files:**
- Create: `server/routes/jobs.js`
- Create: `tests/routes/jobs.test.js`
- Modify: `server/index.js` — mount jobs router

**Interfaces:**
- Produces:
  - `GET /api/jobs[?status=&country=&client_id=]` → array of job summaries
  - `GET /api/jobs/:id` → full job object (airspace_users and area_of_operations parsed from JSON)
  - `POST /api/jobs` body `{ title, client_id?, description?, operation_type?, country?, start_date?, ... }` → created job + auto-seeded permissions
  - `PUT /api/jobs/:id` → updated job
  - `DELETE /api/jobs/:id` → `{ ok: true }` (hard delete, cascades to permissions/risks)

**Key behaviour:** When a job is created, `job_permissions` are auto-seeded from `knowledge/countries.json` for the job's country. This requires reading `countries.json` at job creation time.

- [ ] **Step 1: Write `knowledge/countries.json` stub**

```json
{
  "uk": {
    "name": "United Kingdom",
    "regulatory_body": "CAA",
    "framework": "UK Reg (PDRA01/STS)",
    "jack_credentials": ["PDRA01", "GVC", "Flyer ID"],
    "permissions": [
      {
        "label": "Drone Assist / NATS notification",
        "lead_time_days": 0,
        "authority": "NATS / Drone Assist app",
        "required_for": "all",
        "notes": "Check for NOTAMs and FRZs"
      },
      {
        "label": "Location / landowner permission",
        "lead_time_days": 7,
        "authority": "Landowner / Location Manager",
        "required_for": "all",
        "notes": ""
      },
      {
        "label": "Insurance confirmed",
        "lead_time_days": 0,
        "authority": "Internal",
        "required_for": "all",
        "notes": "Public liability minimum £5M"
      }
    ],
    "contacts": [],
    "notes": "Operating under PDRA01 covers most film/TV work in populated areas."
  },
  "us": {
    "name": "United States",
    "regulatory_body": "FAA",
    "framework": "Part 107",
    "jack_credentials": ["FAA Part 107"],
    "permissions": [
      {
        "label": "FAA LAANC authorisation",
        "lead_time_days": 0,
        "authority": "FAA via Aloft/DroneZone",
        "required_for": "controlled airspace",
        "notes": "Instant for most locations via LAANC"
      },
      {
        "label": "Location / landowner permission",
        "lead_time_days": 14,
        "authority": "Landowner / Permit Office",
        "required_for": "all",
        "notes": ""
      }
    ],
    "contacts": [],
    "notes": "Jack holds FAA Part 107 Remote Pilot Certificate."
  },
  "ca": {
    "name": "Canada",
    "regulatory_body": "Transport Canada",
    "framework": "CARs Part IX",
    "jack_credentials": [],
    "permissions": [
      {
        "label": "SFOC (Special Flight Operations Certificate)",
        "lead_time_days": 20,
        "authority": "Transport Canada",
        "required_for": "controlled airspace or complex ops",
        "notes": "Apply via Nav Canada or Transport Canada portal"
      },
      {
        "label": "Location / landowner permission",
        "lead_time_days": 14,
        "authority": "Landowner / National Parks",
        "required_for": "all",
        "notes": ""
      }
    ],
    "contacts": [],
    "notes": "Foreign operators require Transport Canada registration and may need SFOC."
  },
  "ie": {
    "name": "Ireland",
    "regulatory_body": "IAA",
    "framework": "EU Reg (Open/Specific Category)",
    "jack_credentials": ["Irish IAA Open A2"],
    "permissions": [
      {
        "label": "IAA UAS Operator Registration",
        "lead_time_days": 0,
        "authority": "Irish Aviation Authority",
        "required_for": "all",
        "notes": "Jack holds IRL-RP-000008146ZAC"
      },
      {
        "label": "Location / landowner permission",
        "lead_time_days": 7,
        "authority": "Landowner",
        "required_for": "all",
        "notes": ""
      }
    ],
    "contacts": [],
    "notes": "EU Open Category rules apply. Jack's IAA Open A2 covers most ops."
  },
  "at": {
    "name": "Austria",
    "regulatory_body": "Austro Control",
    "framework": "EU Reg (Open/Specific Category)",
    "jack_credentials": [],
    "permissions": [
      {
        "label": "EU UAS Operator Registration (EASA)",
        "lead_time_days": 7,
        "authority": "Austro Control",
        "required_for": "all",
        "notes": "Register in Austria's national registry"
      },
      {
        "label": "Location / airspace authorisation",
        "lead_time_days": 14,
        "authority": "Austro Control",
        "required_for": "controlled airspace",
        "notes": ""
      }
    ],
    "contacts": [],
    "notes": "Vienna ops — confirm with Austro Control for specific areas."
  }
}
```

- [ ] **Step 2: Write `server/routes/jobs.js`**

```js
import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const countriesPath = join(__dirname, '../../knowledge/countries.json');

function loadCountries() {
  return JSON.parse(readFileSync(countriesPath, 'utf8'));
}

function parseJobJson(job) {
  if (!job) return null;
  return {
    ...job,
    airspace_users: JSON.parse(job.airspace_users || '[]'),
    area_of_operations: job.area_of_operations ? JSON.parse(job.area_of_operations) : null,
  };
}

const router = Router();

router.get('/', (req, res) => {
  const { status, country, client_id } = req.query;
  let sql = `SELECT j.*, c.name as client_name FROM jobs j LEFT JOIN clients c ON c.id = j.client_id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND j.status = ?'; params.push(status); }
  if (country) { sql += ' AND j.country = ?'; params.push(country); }
  if (client_id) { sql += ' AND j.client_id = ?'; params.push(client_id); }
  sql += ' ORDER BY j.start_date DESC, j.created_at DESC';
  res.json(getDb().prepare(sql).all(...params).map(parseJobJson));
});

router.get('/:id', (req, res) => {
  const job = getDb().prepare('SELECT j.*, c.name as client_name FROM jobs j LEFT JOIN clients c ON c.id = j.client_id WHERE j.id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(parseJobJson(job));
});

router.post('/', (req, res) => {
  const db = getDb();
  const {
    title, client_id, description, operation_type = 'UK_PDRA01',
    country = 'uk', start_date, start_time, end_time,
    location_name, location_address, lat, lng, elevation_ft,
    airspace_class, aircraft_id, notes
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const id = crypto.randomUUID();

  const createJob = db.transaction(() => {
    db.prepare(`
      INSERT INTO jobs (id, client_id, title, description, operation_type, country,
        start_date, start_time, end_time, location_name, location_address,
        lat, lng, elevation_ft, airspace_class, aircraft_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, client_id || null, title, description || null, operation_type, country,
      start_date || null, start_time || null, end_time || null,
      location_name || null, location_address || null,
      lat || null, lng || null, elevation_ft || null,
      airspace_class || null, aircraft_id || null, notes || null);

    // Seed permissions from countries.json
    const countries = loadCountries();
    const countryData = countries[country.toLowerCase()];
    if (countryData?.permissions) {
      const insertPerm = db.prepare(`
        INSERT INTO job_permissions (id, job_id, label, authority, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      countryData.permissions.forEach((p, i) => {
        insertPerm.run(crypto.randomUUID(), id, p.label, p.authority || null, p.notes || null, i);
      });
    }
  });

  createJob();
  res.status(201).json(parseJobJson(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    title, client_id, description, status, operation_type, country,
    start_date, start_time, end_time, location_name, location_address,
    lat, lng, elevation_ft, airspace_class, airspace_users,
    area_of_operations, map_static_image_url, ground_risk_summary,
    aircraft_id, notes
  } = req.body;

  db.prepare(`
    UPDATE jobs SET
      title=?, client_id=?, description=?, status=?, operation_type=?, country=?,
      start_date=?, start_time=?, end_time=?, location_name=?, location_address=?,
      lat=?, lng=?, elevation_ft=?, airspace_class=?,
      airspace_users=?, area_of_operations=?, map_static_image_url=?,
      ground_risk_summary=?, aircraft_id=?, notes=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    title, client_id || null, description || null, status || 'new', operation_type || 'UK_PDRA01', country || 'uk',
    start_date || null, start_time || null, end_time || null, location_name || null, location_address || null,
    lat || null, lng || null, elevation_ft || null, airspace_class || null,
    airspace_users ? JSON.stringify(airspace_users) : '[]',
    area_of_operations ? JSON.stringify(area_of_operations) : null,
    map_static_image_url || null, ground_risk_summary || null, aircraft_id || null, notes || null,
    req.params.id
  );
  res.json(parseJobJson(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 3: Mount in `server/index.js`**

```js
import jobsRouter from './routes/jobs.js';
app.use('/api/jobs', jobsRouter);
```

- [ ] **Step 4: Write tests**

```js
// tests/routes/jobs.test.js
import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db, jobId;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Jobs API', () => {
  it('POST /api/jobs creates a job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .auth(AUTH.user, AUTH.pass)
      .send({ title: 'Gladiators S3 Arena', country: 'uk', operation_type: 'UK_PDRA01' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Gladiators S3 Arena');
    expect(Array.isArray(res.body.airspace_users)).toBe(true);
    jobId = res.body.id;
  });

  it('POST /api/jobs auto-seeds UK permissions', async () => {
    const perms = db.prepare('SELECT * FROM job_permissions WHERE job_id = ?').all(jobId);
    expect(perms.length).toBeGreaterThanOrEqual(3);
    expect(perms.some(p => p.label.includes('Drone Assist'))).toBe(true);
  });

  it('GET /api/jobs returns the job', async () => {
    const res = await request(app).get('/api/jobs').auth(AUTH.user, AUTH.pass);
    expect(res.body.find(j => j.id === jobId)).toBeTruthy();
  });

  it('GET /api/jobs/:id returns full job', async () => {
    const res = await request(app).get(`/api/jobs/${jobId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
  });

  it('PUT /api/jobs/:id updates status', async () => {
    const res = await request(app)
      .put(`/api/jobs/${jobId}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ title: 'Gladiators S3 Arena', status: 'planned', country: 'uk', operation_type: 'UK_PDRA01' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('planned');
  });

  it('PUT stores area_of_operations as JSON', async () => {
    const polygon = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] };
    const res = await request(app)
      .put(`/api/jobs/${jobId}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ title: 'Gladiators S3 Arena', country: 'uk', operation_type: 'UK_PDRA01', area_of_operations: polygon });
    expect(res.status).toBe(200);
    expect(res.body.area_of_operations).toEqual(polygon);
  });

  it('DELETE /api/jobs/:id deletes the job', async () => {
    const res = await request(app).delete(`/api/jobs/${jobId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test tests/routes/jobs.test.js
# Expected: PASS — 7 tests
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/jobs.js server/index.js knowledge/countries.json tests/routes/jobs.test.js
git commit -m "feat: jobs CRUD API with auto-seeded permissions"
```

---

## Task 5: Job Sub-Resources (Permissions + Risks)

**Files:**
- Create: `server/routes/job-permissions.js`
- Create: `server/routes/job-risks.js`
- Create: `tests/routes/job-permissions.test.js`
- Create: `tests/routes/job-risks.test.js`
- Modify: `server/index.js` — mount both routers

**Interfaces:**
- Permissions: `GET/PUT /api/jobs/:id/permissions` — list and bulk-update permission statuses
- Risks: `GET /api/jobs/:id/risks`, `POST /api/jobs/:id/risks`, `PUT /api/jobs/:id/risks/:riskId`, `DELETE /api/jobs/:id/risks/:riskId`, `PUT /api/jobs/:id/risks/reorder`

- [ ] **Step 1: Write `server/routes/job-permissions.js`**

```js
import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router({ mergeParams: true });

router.get('/', (req, res) => {
  const perms = getDb().prepare(
    'SELECT * FROM job_permissions WHERE job_id = ? ORDER BY sort_order ASC'
  ).all(req.params.id);
  res.json(perms);
});

// PUT replaces the full list (status updates from frontend)
router.put('/', (req, res) => {
  const db = getDb();
  const perms = req.body; // array of { id, status, contact, deadline, notes }
  if (!Array.isArray(perms)) return res.status(400).json({ error: 'Expected array' });

  const update = db.prepare(`
    UPDATE job_permissions SET status=?, contact=?, deadline=?, notes=? WHERE id=? AND job_id=?
  `);
  const updateAll = db.transaction(() => {
    perms.forEach(p => update.run(p.status || 'pending', p.contact || null, p.deadline || null, p.notes || null, p.id, req.params.id));
  });
  updateAll();
  res.json(db.prepare('SELECT * FROM job_permissions WHERE job_id = ? ORDER BY sort_order').all(req.params.id));
});

// POST adds a custom permission item
router.post('/', (req, res) => {
  const { label, authority, notes } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  const db = getDb();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM job_permissions WHERE job_id = ?').get(req.params.id);
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO job_permissions (id, job_id, label, authority, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, req.params.id, label, authority || null, notes || null, (maxOrder.m || 0) + 1);
  res.status(201).json(db.prepare('SELECT * FROM job_permissions WHERE id = ?').get(id));
});

router.delete('/:permId', (req, res) => {
  const result = getDb().prepare('DELETE FROM job_permissions WHERE id = ? AND job_id = ?').run(req.params.permId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2: Write `server/routes/job-risks.js`**

```js
import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router({ mergeParams: true });

router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM job_risks WHERE job_id = ? ORDER BY sort_order ASC').all(req.params.id));
});

router.post('/', (req, res) => {
  const db = getDb();
  const { hazard, cause, consequence, severity = 3, probability = 3, mitigations, residual_severity, residual_probability, notes } = req.body;
  if (!hazard) return res.status(400).json({ error: 'hazard is required' });
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM job_risks WHERE job_id = ?').get(req.params.id);
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO job_risks
    (id, job_id, sort_order, hazard, cause, consequence, severity, probability, mitigations, residual_severity, residual_probability, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, req.params.id, (maxOrder.m || 0) + 1,
    hazard, cause || null, consequence || null,
    severity, probability, mitigations || null,
    residual_severity || null, residual_probability || null, notes || null
  );
  res.status(201).json(db.prepare('SELECT * FROM job_risks WHERE id = ?').get(id));
});

router.put('/:riskId', (req, res) => {
  const db = getDb();
  const { hazard, cause, consequence, severity, probability, mitigations, residual_severity, residual_probability, notes } = req.body;
  const result = db.prepare(`UPDATE job_risks SET
    hazard=?, cause=?, consequence=?, severity=?, probability=?,
    mitigations=?, residual_severity=?, residual_probability=?, notes=?
    WHERE id=? AND job_id=?`).run(
    hazard, cause || null, consequence || null, severity || 3, probability || 3,
    mitigations || null, residual_severity || null, residual_probability || null, notes || null,
    req.params.riskId, req.params.id
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM job_risks WHERE id = ?').get(req.params.riskId));
});

router.delete('/:riskId', (req, res) => {
  const result = getDb().prepare('DELETE FROM job_risks WHERE id = ? AND job_id = ?').run(req.params.riskId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Bulk reorder — body: [{ id, sort_order }]
router.put('/reorder', (req, res) => {
  const db = getDb();
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
  const update = db.prepare('UPDATE job_risks SET sort_order=? WHERE id=? AND job_id=?');
  db.transaction(() => items.forEach(i => update.run(i.sort_order, i.id, req.params.id)))();
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 3: Mount in `server/index.js`**

```js
import jobPermissionsRouter from './routes/job-permissions.js';
import jobRisksRouter from './routes/job-risks.js';
app.use('/api/jobs/:id/permissions', jobPermissionsRouter);
app.use('/api/jobs/:id/risks', jobRisksRouter);
```

- [ ] **Step 4: Write tests**

```js
// tests/routes/job-permissions.test.js
import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db, jobId;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
  // Create a job directly in DB
  jobId = crypto.randomUUID();
  db.prepare(`INSERT INTO jobs (id, title, country, operation_type) VALUES (?, ?, ?, ?)`).run(jobId, 'Test Job', 'uk', 'UK_PDRA01');
  db.prepare(`INSERT INTO job_permissions (id, job_id, label, sort_order) VALUES (?, ?, ?, ?)`).run(crypto.randomUUID(), jobId, 'Drone Assist', 0);
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Job Permissions API', () => {
  it('GET returns permissions', async () => {
    const res = await request(app).get(`/api/jobs/${jobId}/permissions`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].label).toBe('Drone Assist');
  });

  it('PUT updates permission status', async () => {
    const existing = db.prepare('SELECT * FROM job_permissions WHERE job_id = ?').all(jobId);
    const updated = existing.map(p => ({ ...p, status: 'obtained' }));
    const res = await request(app).put(`/api/jobs/${jobId}/permissions`).auth(AUTH.user, AUTH.pass).send(updated);
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('obtained');
  });

  it('POST adds a custom permission', async () => {
    const res = await request(app).post(`/api/jobs/${jobId}/permissions`).auth(AUTH.user, AUTH.pass).send({ label: 'Custom item' });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Custom item');
  });
});
```

```js
// tests/routes/job-risks.test.js
import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db, jobId, riskId;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
  jobId = crypto.randomUUID();
  db.prepare(`INSERT INTO jobs (id, title, country, operation_type) VALUES (?, ?, ?, ?)`).run(jobId, 'Risk Test Job', 'uk', 'UK_PDRA01');
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Job Risks API', () => {
  it('POST creates a risk', async () => {
    const res = await request(app).post(`/api/jobs/${jobId}/risks`).auth(AUTH.user, AUTH.pass)
      .send({ hazard: 'Loss of control link', cause: 'RF interference', consequence: 'Flyaway', severity: 4, probability: 2, mitigations: 'RTH configured, VLOS maintained', residual_severity: 2, residual_probability: 1 });
    expect(res.status).toBe(201);
    expect(res.body.hazard).toBe('Loss of control link');
    riskId = res.body.id;
  });

  it('GET returns risks', async () => {
    const res = await request(app).get(`/api/jobs/${jobId}/risks`).auth(AUTH.user, AUTH.pass);
    expect(res.body.length).toBe(1);
  });

  it('PUT updates a risk', async () => {
    const res = await request(app).put(`/api/jobs/${jobId}/risks/${riskId}`).auth(AUTH.user, AUTH.pass)
      .send({ hazard: 'Loss of control link', severity: 3, probability: 2, mitigations: 'Updated mitigations' });
    expect(res.status).toBe(200);
    expect(res.body.mitigations).toBe('Updated mitigations');
  });

  it('DELETE removes a risk', async () => {
    const res = await request(app).delete(`/api/jobs/${jobId}/risks/${riskId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    const list = await request(app).get(`/api/jobs/${jobId}/risks`).auth(AUTH.user, AUTH.pass);
    expect(list.body.length).toBe(0);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test tests/routes/job-permissions.test.js tests/routes/job-risks.test.js
# Expected: PASS — 7 tests combined
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/job-permissions.js server/routes/job-risks.js server/index.js tests/routes/job-permissions.test.js tests/routes/job-risks.test.js
git commit -m "feat: job permissions and risks sub-resource APIs"
```

---

## Task 6: Settings + Countries API

**Files:**
- Create: `server/routes/settings.js`
- Create: `server/routes/countries.js`
- Modify: `server/index.js`

**Interfaces:**
- `GET /api/settings` → settings row (id=1)
- `PUT /api/settings` → updated settings row
- `GET /api/countries` → full countries.json object
- `GET /api/countries/:code` → single country entry

- [ ] **Step 1: Write `server/routes/settings.js`**

```js
import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const s = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(s || {});
});

router.put('/', (req, res) => {
  const db = getDb();
  const fields = ['name','email','phone','operator_id','flyer_id','flyer_id_expiry',
    'pdra01_ref','pdra01_expiry','gvc_ref','gvc_expiry',
    'faa_part107_ref','faa_part107_expiry','iau_ref','iau_expiry',
    'document_logo_path','document_accent_colour','ai_style_prompt'];
  const setClauses = fields.map(f => `${f}=?`).join(', ');
  const values = fields.map(f => req.body[f] ?? null);
  db.prepare(`UPDATE settings SET ${setClauses} WHERE id=1`).run(...values);
  res.json(db.prepare('SELECT * FROM settings WHERE id = 1').get());
});

export default router;
```

- [ ] **Step 2: Write `server/routes/countries.js`**

```js
import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadCountries() {
  return JSON.parse(readFileSync(join(__dirname, '../../knowledge/countries.json'), 'utf8'));
}

const router = Router();

router.get('/', (_req, res) => res.json(loadCountries()));
router.get('/:code', (req, res) => {
  const data = loadCountries()[req.params.code.toLowerCase()];
  if (!data) return res.status(404).json({ error: 'Country not found' });
  res.json(data);
});

export default router;
```

- [ ] **Step 3: Mount both in `server/index.js`**

```js
import settingsRouter from './routes/settings.js';
import countriesRouter from './routes/countries.js';
app.use('/api/settings', settingsRouter);
app.use('/api/countries', countriesRouter);
```

- [ ] **Step 4: Write quick integration tests**

```js
// tests/routes/settings.test.js
import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db;
beforeAll(() => {
  process.env.ADMIN_USER = 'jack'; process.env.ADMIN_PASS = 'test';
  db = createTestDb(); setDb(db);
});
afterAll(() => { setDb(null); closeTestDb(db); });

it('GET /api/settings returns seeded row', async () => {
  const res = await request(app).get('/api/settings').auth(AUTH.user, AUTH.pass);
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Jack Downes');
});

it('PUT /api/settings updates name', async () => {
  const res = await request(app).put('/api/settings').auth(AUTH.user, AUTH.pass).send({ name: 'J. Downes' });
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('J. Downes');
});

it('GET /api/countries returns all countries', async () => {
  const res = await request(app).get('/api/countries').auth(AUTH.user, AUTH.pass);
  expect(res.status).toBe(200);
  expect(res.body.uk).toBeDefined();
  expect(res.body.us).toBeDefined();
});
```

- [ ] **Step 5: Run tests**

```bash
npm test tests/routes/settings.test.js
# Expected: PASS — 3 tests
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/settings.js server/routes/countries.js server/index.js tests/routes/settings.test.js
git commit -m "feat: settings and countries API"
```

---

## Task 7: Airspace API (OpenAIP Proxy + NHS Hospitals)

**Files:**
- Create: `server/routes/airspace.js`
- Create: `knowledge/uk-hospitals.json`
- Create: `tests/routes/airspace.test.js`
- Modify: `server/index.js`

**Interfaces:**
- `GET /api/airspace?lat=&lng=&radius_km=` → `{ aerodromes: [...], airspaceZones: [...], hospitals: [...] }`
- Each aerodrome: `{ name, type, icao, lat, lng, distance_km, phone }`
- Each hospital: `{ name, type: 'HOSPITAL', lat, lng, distance_km, phone }`
- Each airspace zone: `{ name, class, geometry }` (GeoJSON from OpenAIP)

- [ ] **Step 1: Create `knowledge/uk-hospitals.json` stub**

```json
[
  { "name": "Royal London Hospital", "lat": 51.5188, "lng": -0.0597, "phone": "020 7377 7000" },
  { "name": "St George's Hospital", "lat": 51.4272, "lng": -0.1768, "phone": "020 8672 1255" },
  { "name": "King's College Hospital", "lat": 51.4679, "lng": -0.0938, "phone": "020 3299 9000" },
  { "name": "St Thomas' Hospital", "lat": 51.4990, "lng": -0.1186, "phone": "020 7188 7188" },
  { "name": "University College Hospital", "lat": 51.5247, "lng": -0.1349, "phone": "020 3456 7890" }
]
```

> Note: The full NHS dataset can be populated later by finding HEMS-capable hospitals. This stub covers London ops.

- [ ] **Step 2: Write `server/routes/airspace.js`**

```js
import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function loadHospitals() {
  return JSON.parse(readFileSync(join(__dirname, '../../knowledge/uk-hospitals.json'), 'utf8'));
}

router.get('/', async (req, res) => {
  const { lat, lng, radius_km = 20 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);
  const radiusF = parseFloat(radius_km);

  const results = { aerodromes: [], airspaceZones: [], hospitals: [] };

  // NHS hospitals within radius
  const hospitals = loadHospitals();
  results.hospitals = hospitals
    .map(h => ({ ...h, type: 'HOSPITAL', distance_km: haversineKm(latF, lngF, h.lat, h.lng) }))
    .filter(h => h.distance_km <= radiusF)
    .sort((a, b) => a.distance_km - b.distance_km);

  // OpenAIP — aerodromes
  if (process.env.OPENAIP_API_KEY) {
    try {
      const { default: fetch } = await import('node-fetch');
      const url = `https://api.openaip.net/api/airports?lat=${latF}&lng=${lngF}&dist=${radiusF}&apiKey=${process.env.OPENAIP_API_KEY}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const data = await resp.json();
        results.aerodromes = (data.items || []).map(a => ({
          name: a.name,
          type: a.type,
          icao: a.icaoCode,
          lat: a.geometry?.coordinates?.[1],
          lng: a.geometry?.coordinates?.[0],
          distance_km: haversineKm(latF, lngF, a.geometry?.coordinates?.[1], a.geometry?.coordinates?.[0]),
          phone: a.frequencies?.[0]?.value || null,
        }));
      }
    } catch (e) {
      // OpenAIP unavailable — return what we have
      console.error('OpenAIP error:', e.message);
    }

    // OpenAIP — airspace zones
    try {
      const { default: fetch } = await import('node-fetch');
      const url = `https://api.openaip.net/api/airspaces?lat=${latF}&lng=${lngF}&dist=${radiusF}&apiKey=${process.env.OPENAIP_API_KEY}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const data = await resp.json();
        results.airspaceZones = (data.items || []).map(z => ({
          name: z.name,
          class: z.icaoClass,
          geometry: z.geometry,
        }));
      }
    } catch (e) {
      console.error('OpenAIP airspace error:', e.message);
    }
  }

  res.json(results);
});

export default router;
```

- [ ] **Step 3: Mount in `server/index.js`**

```js
import airspaceRouter from './routes/airspace.js';
app.use('/api/airspace', airspaceRouter);
```

- [ ] **Step 4: Write tests (mock OpenAIP to avoid network calls)**

```js
// tests/routes/airspace.test.js
import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  // No OPENAIP_API_KEY set — only NHS hospitals will return
  delete process.env.OPENAIP_API_KEY;
  db = createTestDb();
  setDb(db);
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Airspace API', () => {
  it('returns 400 if lat/lng missing', async () => {
    const res = await request(app).get('/api/airspace').auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(400);
  });

  it('returns hospital data for London coords', async () => {
    const res = await request(app)
      .get('/api/airspace?lat=51.5074&lng=-0.1278&radius_km=10')
      .auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hospitals');
    expect(res.body).toHaveProperty('aerodromes');
    expect(res.body).toHaveProperty('airspaceZones');
    // At least some London hospitals within 10km
    expect(res.body.hospitals.length).toBeGreaterThan(0);
  });

  it('filters hospitals by radius', async () => {
    // Edinburgh coords — no London hospitals within 5km
    const res = await request(app)
      .get('/api/airspace?lat=55.9533&lng=-3.1883&radius_km=5')
      .auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.hospitals.length).toBe(0);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test tests/routes/airspace.test.js
# Expected: PASS — 3 tests
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/airspace.js knowledge/uk-hospitals.json server/index.js tests/routes/airspace.test.js
git commit -m "feat: airspace API — OpenAIP proxy + NHS hospital radius search"
```

---

## Task 8: AI Routes

**Files:**
- Create: `server/routes/ai.js`
- Create: `tests/routes/ai.test.js`
- Modify: `server/index.js`

**Interfaces:**
- `POST /api/ai/ground-risk` body `{ polygon, airspace_class, location_name, lat, lng }` → `{ ground_risk_summary: "..." }`
- `POST /api/ai/risks` body `{ job_title, description, operation_type, location_name, aircraft_model, ground_risk_summary, ai_style_prompt? }` → `{ risks: [{ hazard, cause, consequence, severity, probability, mitigations, residual_severity, residual_probability }] }`
- `POST /api/ai/method-statement` body `{ job_title, description, operation_type, location_name, aircraft_model, crew_structure, ai_style_prompt? }` → `{ method_statement: "..." }`

- [ ] **Step 1: Write `server/routes/ai.js`**

```js
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function loadOpsManual() {
  try {
    return readFileSync(join(__dirname, '../../knowledge/ops-manual.md'), 'utf8');
  } catch {
    return 'Ops manual not yet available.';
  }
}

async function callClaude(systemPrompt, userPrompt, timeoutMs = 30000) {
  const client = getClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }, { signal: controller.signal });
    return msg.content[0].text;
  } finally {
    clearTimeout(timer);
  }
}

router.post('/ground-risk', async (req, res) => {
  const { polygon, airspace_class, location_name, lat, lng } = req.body;
  const settings = getDb().prepare('SELECT ai_style_prompt FROM settings WHERE id=1').get();
  const styleNote = settings?.ai_style_prompt || '';

  const system = `You are a professional drone operations consultant assisting a CAA-licensed remote pilot (PDRA01, GVC) with UK film and TV drone operations. Write concise, factual site survey narratives for inclusion in RAMS documents. ${styleNote}
  
Ops manual context:
${loadOpsManual().slice(0, 4000)}`;

  const user = `Generate a ground risk assessment narrative for the following operation:
Location: ${location_name || 'Unknown'} (${lat}, ${lng})
Airspace class: ${airspace_class || 'Unknown'}
Area of operations polygon: ${JSON.stringify(polygon || {})}

Write 3-5 paragraphs covering: terrain and ground characteristics, population density and third-party risk, access and egress, environmental considerations. Be specific and professional. Do not use bullet points.`;

  try {
    const text = await callClaude(system, user);
    res.json({ ground_risk_summary: text });
  } catch (e) {
    console.error('AI ground-risk error:', e.message);
    res.status(503).json({ error: 'AI unavailable', fallback: true });
  }
});

router.post('/risks', async (req, res) => {
  const { job_title, description, operation_type, location_name, aircraft_model, ground_risk_summary, ai_style_prompt } = req.body;
  const settings = getDb().prepare('SELECT ai_style_prompt FROM settings WHERE id=1').get();
  const styleNote = ai_style_prompt || settings?.ai_style_prompt || '';

  const system = `You are a professional drone operations risk assessor for UK film and TV. Generate structured risk assessment rows for RAMS documents. Output ONLY valid JSON — no markdown, no explanation. ${styleNote}`;

  const user = `Generate risk assessment rows for this drone operation:
Job: ${job_title}
Description: ${description || 'Not provided'}
Operation type: ${operation_type}
Location: ${location_name}
Aircraft: ${aircraft_model}
Ground risk context: ${ground_risk_summary || 'Not provided'}

Return a JSON array of risk objects. Each object must have these exact keys:
{ "hazard": string, "cause": string, "consequence": string, "severity": number (1-5), "probability": number (1-5), "mitigations": string, "residual_severity": number (1-5), "residual_probability": number (1-5) }

Include 8-12 risks covering: loss of control, flyaway, collision with person, collision with structure, battery failure, RF interference, weather deterioration, third-party intrusion, emergency landing, and any operation-specific risks.`;

  try {
    const text = await callClaude(system, user);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const risks = JSON.parse(cleaned);
    res.json({ risks });
  } catch (e) {
    console.error('AI risks error:', e.message);
    res.status(503).json({ error: 'AI unavailable', fallback: true });
  }
});

router.post('/method-statement', async (req, res) => {
  const { job_title, description, operation_type, location_name, aircraft_model, crew_structure, ai_style_prompt } = req.body;
  const settings = getDb().prepare('SELECT ai_style_prompt FROM settings WHERE id=1').get();
  const styleNote = ai_style_prompt || settings?.ai_style_prompt || '';

  const system = `You are writing method statements for a professional drone operator's RAMS documents. Write in first-person plural ("We will..."), professionally direct, no passive voice. Match the structure: Site Setup, Crew Briefing, Pre-Flight & Rehearsal, Live Flight, Emergency Procedure. ${styleNote}

Ops manual context:
${loadOpsManual().slice(0, 3000)}`;

  const user = `Write a method statement for:
Job: ${job_title}
Description: ${description || 'Not provided'}
Operation type: ${operation_type}
Location: ${location_name}
Aircraft: ${aircraft_model}
Crew: ${crew_structure || 'Remote Pilot + Visual Observer'}

Write 5 sections: **Site Setup**, **Crew Briefing**, **Pre-Flight & Rehearsal**, **Live Flight**, **Emergency Procedure**. Each section: 3-5 bullet points. Specific to this operation.`;

  try {
    const text = await callClaude(system, user);
    res.json({ method_statement: text });
  } catch (e) {
    console.error('AI method-statement error:', e.message);
    res.status(503).json({ error: 'AI unavailable', fallback: true });
  }
});

export default router;
```

- [ ] **Step 2: Mount in `server/index.js`**

```js
import aiRouter from './routes/ai.js';
app.use('/api/ai', aiRouter);
```

- [ ] **Step 3: Write tests (mock Anthropic SDK)**

```js
// tests/routes/ai.test.js
import request from 'supertest';
import { jest } from '@jest/globals';

// Mock the Anthropic SDK before importing app
jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: jest.fn().mockResolvedValue({
        content: [{ text: 'Mocked AI response for testing.' }]
      })
    };
  }
}));

const { app } = await import('../../server/index.js');
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  db = createTestDb();
  setDb(db);
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('AI Routes', () => {
  it('POST /api/ai/ground-risk returns summary', async () => {
    const res = await request(app)
      .post('/api/ai/ground-risk')
      .auth(AUTH.user, AUTH.pass)
      .send({ location_name: 'Wembley Stadium', lat: 51.5560, lng: -0.2796, airspace_class: 'G' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ground_risk_summary');
    expect(typeof res.body.ground_risk_summary).toBe('string');
  });

  it('POST /api/ai/method-statement returns text', async () => {
    const res = await request(app)
      .post('/api/ai/method-statement')
      .auth(AUTH.user, AUTH.pass)
      .send({ job_title: 'Gladiators Arena', operation_type: 'UK_PDRA01', location_name: 'Sheffield Arena', aircraft_model: 'Mavic 3E' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('method_statement');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test tests/routes/ai.test.js
# Expected: PASS — 2 tests
```

- [ ] **Step 5: Create ops-manual placeholder**

```bash
echo "# Jack Downes Operations Manual\n\nFull manual to be extracted from /Users/jdownes/Documents/Drone\\ Docs/Ops\\ Manual/Jack\\ Downes\\ -\\ OM\\ v5.4.docx\n\n## Operating Principles\n\n- All operations conducted under PDRA01 or relevant national framework\n- VLOS maintained at all times unless specific exemption granted\n- No flight within FRZs without prior ATC permission\n- Crew briefing mandatory before every flight\n- Emergency landing zone identified before each operation" > knowledge/ops-manual.md
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/ai.js server/index.js tests/routes/ai.test.js knowledge/ops-manual.md
git commit -m "feat: AI routes — ground risk, risk draft, method statement"
```

---

## Task 9: RAMS Document Template + Generation

**Files:**
- Create: `server/templates/rams.js`
- Create: `server/routes/documents.js`
- Create: `tests/routes/documents.test.js`
- Modify: `server/index.js`

**Interfaces:**
- `generateRams(job, risks, airspaceUsers, settings)` → HTML string (complete printable document)
- `POST /api/documents` body `{ job_id }` → `{ id, job_id, version, created_at }`
- `GET /api/documents/:id/html` → HTML string (Content-Type: text/html)
- `GET /api/jobs/:id/documents` → `[{ id, version, created_at }]`

**Risk scoring:** score = severity + probability. Low < 6, Medium 6–7, High 8–10.

- [ ] **Step 1: Write `server/templates/rams.js`**

```js
// generateRams(job, risks, airspaceUsers, settings) → HTML string

function riskScore(s, p) { return (s || 0) + (p || 0); }
function riskClass(score) {
  if (score <= 5) return 'low';
  if (score <= 7) return 'medium';
  return 'high';
}
function riskLabel(score) {
  if (score <= 5) return 'LOW';
  if (score <= 7) return 'MEDIUM';
  return 'HIGH';
}

function matrixCell(s, p) {
  const score = s + p;
  const cls = riskClass(score);
  return `<td class="matrix-cell ${cls}">${score}</td>`;
}

function buildMatrix() {
  let rows = '';
  for (let s = 5; s >= 1; s--) {
    rows += `<tr><td class="matrix-label">${s}</td>`;
    for (let p = 1; p <= 5; p++) {
      rows += matrixCell(s, p);
    }
    rows += '</tr>';
  }
  return rows;
}

export function generateRams(job, risks, airspaceUsers, settings) {
  const accent = settings?.document_accent_colour || '#1d4ed8';
  const accentDark = '#0f172a';

  const score = (s, p) => riskScore(s, p);

  const risksRows = (risks || []).map((r, i) => {
    const initScore = score(r.severity, r.probability);
    const residScore = score(r.residual_severity, r.residual_probability);
    return `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${r.hazard || ''}</strong><br><small>${r.cause || ''}</small></td>
      <td>${r.consequence || ''}</td>
      <td>${r.severity || ''}</td>
      <td>${r.probability || ''}</td>
      <td class="${riskClass(initScore)}">${riskLabel(initScore)} (${initScore})</td>
      <td>${r.mitigations || ''}</td>
      <td>${r.residual_severity || ''}</td>
      <td>${r.residual_probability || ''}</td>
      <td class="${riskClass(residScore)}">${riskLabel(residScore)} (${residScore})</td>
    </tr>`;
  }).join('');

  const airspaceRows = (airspaceUsers || []).filter(a => a.notified !== false).map(a => `
    <tr>
      <td>${a.name || ''}</td>
      <td>${a.type || ''}</td>
      <td>${a.icao || '—'}</td>
      <td>${a.distance_km ? a.distance_km.toFixed(1) + ' km' : '—'}</td>
      <td>${a.phone || '—'}</td>
      <td>${a.notified ? 'Yes' : 'Pending'}</td>
      <td>${a.notes || ''}</td>
    </tr>`).join('');

  const mapImg = job.map_static_image_url
    ? `<img src="${job.map_static_image_url}" alt="Area of Operations Map" class="map-img">`
    : `<div class="map-placeholder">Map image not yet generated</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>RAMS — ${job.title || 'Untitled'}</title>
<style>
  :root { --accent: ${accent}; --dark: ${accentDark}; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; background: #fff; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 18mm; }
  h1 { font-size: 22pt; color: var(--dark); margin-bottom: 6px; }
  h2 { font-size: 13pt; color: var(--accent); border-bottom: 2px solid var(--accent); padding-bottom: 4px; margin: 22px 0 10px; }
  h3 { font-size: 11pt; font-weight: bold; margin: 10px 0 4px; }
  .cover { background: var(--dark); color: #fff; padding: 24mm 18mm; min-height: 297mm; display: flex; flex-direction: column; justify-content: flex-end; }
  .cover h1 { color: #fff; font-size: 28pt; margin-bottom: 8px; }
  .cover .subtitle { color: rgba(255,255,255,0.7); font-size: 13pt; margin-bottom: 32px; }
  .cover-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 10pt; }
  .cover-grid .label { color: rgba(255,255,255,0.5); text-transform: uppercase; font-size: 8pt; letter-spacing: 0.05em; }
  .cover-grid .value { color: #fff; font-weight: 600; }
  .cover-badge { background: var(--accent); color: #fff; display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 9pt; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 700; }
  .low { background: #d8f5d2; font-weight: bold; }
  .medium { background: #ffe9b3; font-weight: bold; }
  .high { background: #ffcccc; font-weight: bold; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .map-img { width: 100%; max-height: 180mm; object-fit: contain; border: 1px solid #ccc; }
  .map-placeholder { width: 100%; height: 80mm; background: #f5f5f5; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10pt; }
  .matrix-table { width: auto; }
  .matrix-cell { width: 36px; height: 36px; text-align: center; font-size: 9pt; font-weight: bold; }
  .matrix-label { font-size: 9pt; font-weight: bold; background: #f0f0f0; text-align: center; }
  .checklist td { font-size: 10pt; }
  .check-box { width: 20px; text-align: center; }
  ul { padding-left: 18px; }
  li { margin-bottom: 2px; }
  .sign-block { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .sign-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 9pt; color: #555; }
  .doc-meta { font-size: 8.5pt; color: #888; border-top: 1px solid #eee; padding-top: 8px; margin-top: 30px; }
  @media print {
    .cover { page-break-after: always; }
    h2 { page-break-before: auto; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <div class="cover-badge">RAMS — ${job.operation_type || 'UK_PDRA01'}</div>
  <h1>${job.title || 'Untitled Operation'}</h1>
  <p class="subtitle">${job.location_name || 'Location TBC'}</p>
  <div class="cover-grid">
    <div>
      <div class="label">Date</div>
      <div class="value">${job.start_date || 'TBC'}</div>
    </div>
    <div>
      <div class="label">Operational Window</div>
      <div class="value">${job.start_time || 'TBC'} – ${job.end_time || 'TBC'}</div>
    </div>
    <div>
      <div class="label">Aircraft</div>
      <div class="value">${job.aircraft_model || 'TBC'}</div>
    </div>
    <div>
      <div class="label">Remote Pilot</div>
      <div class="value">${settings?.name || 'Jack Downes'}</div>
    </div>
    <div>
      <div class="label">Operator ID</div>
      <div class="value">${settings?.operator_id || ''}</div>
    </div>
    <div>
      <div class="label">Document Version</div>
      <div class="value">v${job.doc_version || 1}</div>
    </div>
  </div>
</div>

<!-- PAGE 2+ -->
<div class="page">

<h2>1. Operation Overview</h2>
<p>${job.description || 'No description provided.'}</p>

<h2>2. Location &amp; Environment</h2>
<div class="two-col">
  <div>
    <h3>Site Details</h3>
    <table>
      <tr><th>Address</th><td>${job.location_address || '—'}</td></tr>
      <tr><th>Coordinates</th><td>${job.lat ? `${job.lat}, ${job.lng}` : '—'}</td></tr>
      <tr><th>Elevation</th><td>${job.elevation_ft ? job.elevation_ft + ' ft AMSL' : '—'}</td></tr>
      <tr><th>Airspace Class</th><td>${job.airspace_class || '—'}</td></tr>
      <tr><th>Country</th><td>${job.country?.toUpperCase() || 'UK'}</td></tr>
    </table>
  </div>
  <div>
    <h3>Operational Controls</h3>
    <ul>
      <li>Operation conducted under ${job.operation_type || 'PDRA01'}</li>
      <li>VLOS maintained at all times</li>
      <li>Maximum operating height: subject to airspace constraints</li>
      <li>Third-party risk mitigated by controlled access area</li>
    </ul>
  </div>
</div>

<h2>3. Area of Operations</h2>
${mapImg}

<h2>4. Ground Risk Assessment</h2>
<p>${job.ground_risk_summary || 'Ground risk assessment not yet generated.'}</p>

<h2>5. Aircraft &amp; Credentials</h2>
<table>
  <tr><th>Aircraft</th><td>${job.aircraft_model || '—'}</td></tr>
  <tr><th>Remote Pilot</th><td>${settings?.name || 'Jack Downes'}</td></tr>
  <tr><th>Flyer ID</th><td>${settings?.flyer_id || '—'} (exp. ${settings?.flyer_id_expiry || '—'})</td></tr>
  <tr><th>PDRA01 Ref</th><td>${settings?.pdra01_ref || '—'} (exp. ${settings?.pdra01_expiry || '—'})</td></tr>
  <tr><th>GVC</th><td>${settings?.gvc_ref || '—'}</td></tr>
  <tr><th>FAA Part 107</th><td>${settings?.faa_part107_ref || '—'}</td></tr>
  <tr><th>Operator ID</th><td>${settings?.operator_id || '—'}</td></tr>
</table>

<h2>6. Method Statement</h2>
${job.method_statement ? job.method_statement.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split('\n').map(l => l.startsWith('- ') ? `<li>${l.slice(2)}</li>` : `<p>${l}</p>`).join('') : '<p>Method statement not yet drafted.</p>'}

<h2>7. Risk Assessment</h2>
<table>
  <thead>
    <tr>
      <th>#</th><th>Hazard / Cause</th><th>Consequence</th>
      <th>S</th><th>P</th><th>Initial Risk</th>
      <th>Mitigations</th>
      <th>RS</th><th>RP</th><th>Residual Risk</th>
    </tr>
  </thead>
  <tbody>${risksRows || '<tr><td colspan="10">No risks entered.</td></tr>'}</tbody>
</table>
<p style="font-size:9pt;margin-top:6px;">S = Severity (1–5) &nbsp; P = Probability (1–5) &nbsp; Score = S+P &nbsp; Low &lt;6 &nbsp; Medium 6–7 &nbsp; High 8–10</p>

<h2>8. Risk Matrix</h2>
<table class="matrix-table">
  <thead>
    <tr><th>S\P</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
  </thead>
  <tbody>${buildMatrix()}</tbody>
</table>

<h2>9. Airspace Users</h2>
${airspaceRows ? `<table>
  <thead><tr><th>Name</th><th>Type</th><th>ICAO</th><th>Distance</th><th>Phone</th><th>Notified</th><th>Notes</th></tr></thead>
  <tbody>${airspaceRows}</tbody>
</table>` : '<p>No airspace users recorded.</p>'}

<h2>10. Pre-Flight Checklist</h2>
<table class="checklist">
  <thead><tr><th class="check-box">✓</th><th>Item</th></tr></thead>
  <tbody>
    <tr><td>☐</td><td>Location secured / controlled access confirmed</td></tr>
    <tr><td>☐</td><td>Crew briefed and roles understood</td></tr>
    <tr><td>☐</td><td>Aircraft inspected — props, motors, gimbal, sensors</td></tr>
    <tr><td>☐</td><td>Batteries charged and checked</td></tr>
    <tr><td>☐</td><td>Controller linked and firmware up to date</td></tr>
    <tr><td>☐</td><td>Return-to-home altitude and parameters set</td></tr>
    <tr><td>☐</td><td>Emergency landing zone identified</td></tr>
    <tr><td>☐</td><td>NOTAMs checked — no conflicts</td></tr>
    <tr><td>☐</td><td>Weather within limits (wind, visibility, precipitation)</td></tr>
    <tr><td>☐</td><td>All permissions obtained and documented</td></tr>
    <tr><td>☐</td><td>Go / No-Go confirmed</td></tr>
  </tbody>
</table>

<h2>11. Responsibility Statement</h2>
<p>This Risk Assessment and Method Statement has been prepared by the Remote Pilot named below. All personnel involved in this operation accept their responsibilities as described. The Remote Pilot retains final authority over all flight decisions and may abort the operation at any time if safety conditions are not met.</p>

<h2>12. Sign-Off</h2>
<div class="sign-block">
  <div>
    <p><strong>Remote Pilot</strong></p>
    <p>${settings?.name || 'Jack Downes'}</p>
    <div class="sign-line">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
  </div>
  <div>
    <p><strong>Production Representative</strong></p>
    <p>&nbsp;</p>
    <div class="sign-line">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
  </div>
</div>

<div class="doc-meta">
  Generated: ${new Date().toISOString().split('T')[0]} &nbsp;|&nbsp; Operator ID: ${settings?.operator_id || '—'} &nbsp;|&nbsp; ${job.title || ''}
</div>

</div>
</body>
</html>`;
}
```

- [ ] **Step 2: Write `server/routes/documents.js`**

```js
import { Router } from 'express';
import { getDb } from '../db.js';
import { generateRams } from '../templates/rams.js';

const router = Router();

router.post('/', (req, res) => {
  const { job_id } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });
  const db = getDb();

  const job = db.prepare(`
    SELECT j.*, a.model as aircraft_model
    FROM jobs j LEFT JOIN aircraft a ON a.id = j.aircraft_id
    WHERE j.id = ?
  `).get(job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Parse JSON fields
  job.airspace_users = JSON.parse(job.airspace_users || '[]');

  const risks = db.prepare('SELECT * FROM job_risks WHERE job_id = ? ORDER BY sort_order').all(job_id);
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  // Add method_statement from job (stored via PUT job)
  // Version = max existing + 1
  const maxDoc = db.prepare('SELECT MAX(version) as v FROM documents WHERE job_id = ?').get(job_id);
  const version = (maxDoc?.v || 0) + 1;
  job.doc_version = version;

  const html = generateRams(job, risks, job.airspace_users, settings);
  const id = crypto.randomUUID();

  db.prepare('INSERT INTO documents (id, job_id, version, html_snapshot) VALUES (?, ?, ?, ?)')
    .run(id, job_id, version, html);

  res.status(201).json({ id, job_id, version, created_at: new Date().toISOString() });
});

router.get('/:id/html', (req, res) => {
  const doc = getDb().prepare('SELECT html_snapshot FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', 'text/html');
  res.send(doc.html_snapshot);
});

// List docs for a job
router.get('/job/:jobId', (req, res) => {
  const docs = getDb().prepare('SELECT id, job_id, version, created_at FROM documents WHERE job_id = ? ORDER BY version DESC').all(req.params.jobId);
  res.json(docs);
});

export default router;
```

- [ ] **Step 3: Mount in `server/index.js`**

```js
import documentsRouter from './routes/documents.js';
app.use('/api/documents', documentsRouter);
```

- [ ] **Step 4: Write tests**

```js
// tests/routes/documents.test.js
import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db, jobId, docId;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
  jobId = crypto.randomUUID();
  db.prepare(`INSERT INTO jobs (id, title, country, operation_type, description, location_name) VALUES (?, ?, ?, ?, ?, ?)`).run(
    jobId, 'Test RAMS Job', 'uk', 'UK_PDRA01', 'Cinematic aerial for BBC production', 'Wembley Stadium'
  );
  db.prepare(`INSERT INTO job_risks (id, job_id, sort_order, hazard, cause, consequence, severity, probability, mitigations, residual_severity, residual_probability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(), jobId, 1, 'Loss of control link', 'RF interference', 'Flyaway', 4, 2, 'RTH configured', 2, 1
  );
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Documents API', () => {
  it('POST /api/documents generates a document', async () => {
    const res = await request(app).post('/api/documents').auth(AUTH.user, AUTH.pass).send({ job_id: jobId });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(1);
    docId = res.body.id;
  });

  it('GET /api/documents/:id/html returns HTML', async () => {
    const res = await request(app).get(`/api/documents/${docId}/html`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Test RAMS Job');
    expect(res.text).toContain('Loss of control link');
    expect(res.text).toContain('Jack Downes');
  });

  it('second generation increments version', async () => {
    const res = await request(app).post('/api/documents').auth(AUTH.user, AUTH.pass).send({ job_id: jobId });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);
  });

  it('GET /api/documents/job/:jobId lists documents', async () => {
    const res = await request(app).get(`/api/documents/job/${jobId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});
```

- [ ] **Step 5: Run all tests**

```bash
npm test
# Expected: all tests passing
```

- [ ] **Step 6: Commit**

```bash
git add server/templates/rams.js server/routes/documents.js server/index.js tests/routes/documents.test.js
git commit -m "feat: RAMS document template and generation endpoint"
```

---

## Task 10: Deployment Config

**Files:**
- Verify: `railway.toml`
- Create: `.gitignore`

- [ ] **Step 1: Write `.gitignore`**

```
node_modules/
*.db
*.db-shm
*.db-wal
.env
.DS_Store
```

- [ ] **Step 2: Verify `railway.toml`** (already created in Task 1 — confirm it references the correct start command)

- [ ] **Step 3: Final test run**

```bash
npm test
# All tests must pass before deploying
```

- [ ] **Step 4: Extract ops manual (manual step)**

```
Open: /Users/jdownes/Documents/Drone Docs/Ops Manual/Jack Downes - OM v5.4.docx
File > Save As > knowledge/ops-manual.md (copy paste or use Pandoc: pandoc -o knowledge/ops-manual.md "Jack Downes - OM v5.4.docx")
```

- [ ] **Step 5: Final commit**

```bash
git add .gitignore railway.toml
git commit -m "chore: deployment config and gitignore"
```

---

## Notes for Frontend Plan

The backend exposes these API endpoints for the frontend to consume:

- `GET/PUT /api/settings`
- `GET /api/countries`, `GET /api/countries/:code`
- `GET/POST/PUT/DELETE /api/clients`
- `GET/POST/PUT/DELETE /api/jobs`
- `GET/PUT/POST/DELETE /api/jobs/:id/permissions`
- `GET/POST/PUT/DELETE /api/jobs/:id/risks`
- `PUT /api/jobs/:id/risks/reorder`
- `GET /api/airspace?lat=&lng=&radius_km=`
- `POST /api/ai/ground-risk`
- `POST /api/ai/risks`
- `POST /api/ai/method-statement`
- `POST /api/documents`, `GET /api/documents/:id/html`, `GET /api/documents/job/:jobId`
- `GET /api/health`

All requests require HTTP Basic Auth headers. The frontend plan covers: `public/index.html` (SPA shell), `public/style.css` (dark theme matching OT.LOG), `public/app.js` (hash router + all screen rendering).
