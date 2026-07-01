# Drone Ops Planning App — Design Spec
**Date:** 2026-07-01  
**Status:** Approved by user

---

## Overview

A personal, hosted web application that replaces DroneDesk for Jack Downes's film & TV drone operations. It manages jobs and clients, generates professional RAMS documents tailored to Jack's style, and provides a per-country permissions checklist for international work. Single user; no financials; no team management.

---

## Context & Background

Jack is a professional drone operator (CAA PDRA01, GVC, FAA Part 107, Irish IAA Open A2) working primarily in UK film & TV (Gladiators, Destination X, MAFS, etc.) with increasing international work (US F1, Vienna, Canada). He currently uses DroneDesk for UK job management but finds its generated documents bloated (65-page Thames Clipper job pack, 30+ pages of auto-generated airspace users). He hand-codes his own RAMS documents in HTML (`rams-botanist.html` style) which are far more elegant — 3 tight pages with cover, method statement, risk table, risk matrix, checklist, and sign-off.

**Aircraft fleet:** Inspire 3, Mavic 3E, Mini 3 Pro, Mini 5 Pro, Avata 2  
**Credentials:** Flyer ID GBR-RP-CM4W8MR2V43L, PDRA01-23281 (exp 30/08/2026), GVC (ICARUS), FAA Part 107, Irish IAA Open A2 IRL-RP-000008146ZAC  
**Operator ID:** GBR-OP-R3PNNYZFTPJJ

---

## Goals

1. Replace DroneDesk's document output with personal, polished RAMS documents
2. Manage UK and international jobs with client records
3. Per-country permission checklists that auto-populate when a job is created in that country
4. AI-assisted drafting of variable document sections (method statement, risk rows), with templates for fixed sections (personnel, aircraft, credentials)
5. Live airspace integration — auto-fetched nearby airspace users and zones, condensed to relevant entries only
6. Map-based area of operations scoping with AI-generated ground risk assessment from the drawn area

---

## Non-Goals

- No financial tools (invoicing, rates, expenses)
- No team management or multi-user access
- No mobile-first design (desktop planning tool)
- No asset maintenance tracking

---

## Architecture

**Backend:** Node.js + Express — REST API, Claude API calls, document HTML rendering, airspace API proxy  
**Database:** SQLite via `better-sqlite3` — single portable file, trivially backed up  
**Frontend:** Vanilla JS + CSS — desktop-first, dark theme consistent with OT.LOG aesthetic. App UI is dark; document output is white/print-ready.  
**Map:** Mapbox GL JS — satellite imagery, polygon drawing for area of operations, static image export for documents  
**Airspace data:** OpenAIP REST API (free tier) — radius search for aerodromes, helipads, controlled airspace. NHS hospital dataset (static, UK) for hospital/HEMS entries.  
**Document output:** Server renders HTML template → user opens in browser tab → Print → Save as PDF  
**AI:** Anthropic Claude API (Sonnet) called server-side only  
**Hosting:** Railway — single service, `railway up`, git-push deploys  

```
drone-ops/
├── server/
│   ├── index.js              # Express app entry
│   ├── db.js                 # SQLite setup + migrations
│   ├── routes/
│   │   ├── jobs.js
│   │   ├── clients.js
│   │   ├── documents.js
│   │   ├── ai.js
│   │   ├── airspace.js       # OpenAIP proxy + NHS hospital lookup
│   │   └── countries.js
│   └── templates/
│       └── rams.html         # RAMS document template
├── public/
│   ├── index.html            # SPA shell
│   ├── app.js                # All frontend JS
│   └── style.css
├── knowledge/
│   ├── countries.json        # Per-country regulatory data (editable)
│   ├── ops-manual.md         # Jack's ops manual — AI context source
│   └── uk-hospitals.json     # NHS helipad/hospital dataset (static)
└── railway.toml
```

The `knowledge/` directory is the regulatory brain. Plain text/JSON, edited directly when regulations change. No database overhead for infrequently-changing reference data.

---

## Data Model

### `settings` (single row)
Pilot's personal details and credentials, auto-filled on every document.
```
name, email, phone, operator_id, flyer_id, flyer_id_expiry
pdra01_ref, pdra01_expiry, gvc_ref, gvc_expiry
faa_part107_ref, faa_part107_expiry
iau_ref, iau_expiry
document_logo_path, document_accent_colour, ai_style_prompt
```

### `clients`
```
id, name, contact_name, email, phone, address, notes, created_at
```

### `aircraft` (pre-seeded)
```
id, make, model, identifier, weight_g, diagonal_mm
max_wind_ms, kinetic_energy_kj, prop_protection, notes
```
Pre-seeded: Inspire 3, Mavic 3E, Mini 3 Pro, Mini 5 Pro, Avata 2.

### `jobs`
```
id, client_id, title, description
status  (new | scoped | planned | work_complete | complete | aborted | on_hold)
operation_type  (UK_PDRA01 | UK_STS | INTERNATIONAL)
country, start_date, start_time, end_time
location_name, location_address, lat, lng, elevation_ft
airspace_class, airspace_users (JSON)
area_of_operations (JSON — GeoJSON polygon drawn by user on map)
map_static_image_url (Mapbox Static Images URL stored at generation time)
ground_risk_summary (AI-generated narrative based on area polygon + OSM context)
aircraft_id, notes, created_at, updated_at
```
`airspace_users` is a JSON array fetched from OpenAIP + NHS hospital data, filtered to radius and reviewed by Jack. Each entry: `{ name, type, icao, direction, distance_km, phone, notified, notes }`. Jack can deselect irrelevant entries but does not need to enter them manually.

`area_of_operations` stores the GeoJSON polygon drawn on the Mapbox map. Used to generate the static map image for the document and passed to Claude as context for the ground risk assessment.

### `job_permissions`
Per-job permission checklist items, auto-seeded from `countries.json` when an international job is created.
```
id, job_id, label, status (pending | obtained | not_required)
authority, contact, deadline, notes
```

### `job_risks`
```
id, job_id, sort_order, hazard, cause, consequence
severity (1–5), probability (1–5)
mitigations, residual_severity, residual_probability, notes
```
Risk score = severity + probability. Low < 6, Medium 6–7, High 8–10.

### `documents`
Snapshot of generated HTML at time of creation — historical documents don't change when the job is later edited.
```
id, job_id, version, html_snapshot, created_at
```

---

## Features & Screens

### 1. Dashboard
- Upcoming jobs (next 30 days) with status chips
- Jobs with outstanding permissions (red badge count)
- Quick-create job button
- Pilot currency: days since last flight, PDRA01 expiry countdown

### 2. Jobs
Table view with filters (status, country, client, date range). Each job opens to a detail view with tabs:

**Overview tab** — title, description, client, dates/times, location (lat/lng + what3words), aircraft selector, operation type, status

**Permissions tab** — checklist of items needed. For UK PDRA01 jobs: pre-seeded with standard items (Drone Assist notification, NSF if required, location permission, insurance check). For international: auto-seeded from `countries.json` for that country. Each item has status toggle + notes field.

**Map & Survey tab** — Mapbox satellite map centred on the job location. Jack draws a polygon for the area of operations. Once drawn:
- "Fetch Airspace" button queries OpenAIP + NHS hospital data within a configurable radius (default 20km UK, 30km international) and populates the airspace users table below the map
- Airspace zones (FRZs, CTRs, controlled airspace) are overlaid on the map
- "Generate Ground Risk" button sends the polygon bounds, airspace class, and OSM context (population density indicator, terrain, water, roads) to Claude, which returns a narrative site survey and initial ground risk rows
- Jack reviews and deselects irrelevant airspace entries; the remainder render as a condensed table in the document
- The map with drawn polygon is exported as a Mapbox Static Image and embedded in the RAMS document

**Risks tab** — editable risk table. "AI Draft" button sends job details + ops manual context to Claude and generates an initial set of risk rows appropriate to the operation type and location. Jack reviews, edits, adds/removes rows.

**Method Statement tab** — text area. Pre-filled with a standard template on job creation. "AI Draft" button rewrites it specifically for this job (operation type, location characteristics, aircraft, crew structure). Jack reviews and edits.

**Document tab** — renders a live preview summary. "Generate RAMS" button creates the HTML document and stores a snapshot. "Open for Print" opens it in a new browser tab ready for Print → Save as PDF.

### 3. Clients
Simple list: name, contact, job count, last job date. Client detail shows job history. Create/edit/archive.

### 4. Countries
Knowledge base screen showing all countries in `countries.json`. Each entry displays:
- Regulatory authority + website
- Permission types required (with typical lead times)
- Jack's applicable credentials for that country
- Key contacts
- Notes/gotchas

Editable inline. Pre-built for: UK, USA, Canada, Ireland/EU, Austria.

### 5. Settings
- Personal/credential details (pre-fill on documents)
- Aircraft fleet management
- Document preferences: logo upload, accent colour
- AI style prompt: free text to steer tone ("Write in a professional but direct style, avoid passive voice...")

---

## Document Output

Matches `rams-botanist.html` structure exactly. Generated as a styled HTML file, opened in a new tab, printed to PDF via browser.

**Sections:**
1. Cover page — job title, location, date/time, aircraft, operation type, document version, operator details
2. Operation overview — description, planned areas, key assumptions
3. Location & environment — address, coordinates, what3words, airspace class, known hazards, operational controls (two-column layout)
4. Area of operations map — Mapbox static satellite image with drawn polygon overlaid
5. Ground risk assessment — AI-generated site survey narrative (terrain, population, access, environmental considerations)
6. Aircraft & crew — aircraft spec table, crew roles
7. Method statement — site setup, crew briefing, pre-flight & rehearsal, live flight, emergency procedure
8. Risk assessment — full table with severity, probability, risk score, mitigations, residual scores (colour-coded)
9. Risk matrix — 5×5 grid
10. Airspace users — condensed table (OpenAIP-fetched, reviewed by Jack — relevant entries only)
11. Pre-flight checklist — site, aircraft, crew, go/no-go
12. Responsibility statement
13. Sign-off — drone operator + production representative signature blocks

---

## AI Integration

**When AI is invoked (server-side Claude API calls):**

- **Ground risk assessment**: System prompt includes ops manual + Jack's site survey style. User prompt includes the area of operations polygon bounds, airspace class, and a summary of OSM context (queried via Overpass API: nearby roads, buildings, water features, population indicator). Returns a structured site survey narrative (terrain, ground hazards, access, environmental considerations) matching the DroneDesk initial survey format.
- **Risk draft**: System prompt includes ops manual excerpt + operation type context + ground risk narrative. User prompt includes job title, location, aircraft, operation description. Returns structured JSON array of risk rows.
- **Method statement draft**: System prompt includes ops manual + Jack's standard language style. User prompt includes job specifics, aircraft, crew structure, location type. Returns plain text method statement in Jack's voice.

**What AI never touches:**
- Personnel details, credentials, aircraft specs (pulled from DB/settings)
- Airspace users (fetched from OpenAIP, reviewed by Jack)
- Document structure and formatting
- Permission checklist items (from `countries.json`)
- The drawn map polygon or static image

**AI style prompt** in Settings lets Jack tune the output tone without touching code.

---

## International Knowledge Base (`countries.json`)

Structure per country:
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
      }
    ],
    "contacts": [],
    "notes": "Operating under PDRA01 covers most film/TV work in populated areas."
  },
  "us": { ... },
  "ca": { ... },
  "ie": { ... },
  "at": { ... }
}
```

---

## Error Handling

- All Express routes return structured JSON errors with HTTP status codes
- Frontend shows inline toast notifications (success/error) — no page reloads for form saves
- AI calls have a timeout (30s) and fallback message if Claude API is unavailable
- Document generation failures show a clear error with the reason
- SQLite transactions used for multi-table writes (job + permissions seeding)

---

## Deployment

- Single Railway service running Node.js
- Environment variables: `ANTHROPIC_API_KEY`, `SESSION_SECRET`, `NODE_ENV`
- SQLite DB file persisted via Railway volume mount
- `knowledge/` directory checked into git — regulatory updates are a git commit
- No CI/CD complexity needed — `railway up` or git push to main

---

## External APIs & Keys Required

| Service | Purpose | Cost |
|---|---|---|
| Anthropic Claude API | Risk draft, method statement, ground risk | Pay per use (~pennies per doc) |
| OpenAIP API | Airspace users + zones radius search | Free tier (100 req/day) |
| Mapbox | Map display, polygon drawing, static image export | Free tier (50k loads/month) |
| Overpass API (OSM) | OSM context for AI ground risk prompt | Free, no key needed |

---

## Future Considerations (out of scope for v1)

- NATS / Drone Assist API integration if partnership access becomes available
- Document templates per production company (some clients have house style requirements)
- Flight log import from DJI for automatic currency tracking
- PDF generation via Puppeteer server-side (eliminates browser-print step)
