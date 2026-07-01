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
    <tr><th>S\\P</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
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
  <thead><tr><th class="check-box">&#x2713;</th><th>Item</th></tr></thead>
  <tbody>
    <tr><td>&#x2610;</td><td>Location secured / controlled access confirmed</td></tr>
    <tr><td>&#x2610;</td><td>Crew briefed and roles understood</td></tr>
    <tr><td>&#x2610;</td><td>Aircraft inspected — props, motors, gimbal, sensors</td></tr>
    <tr><td>&#x2610;</td><td>Batteries charged and checked</td></tr>
    <tr><td>&#x2610;</td><td>Controller linked and firmware up to date</td></tr>
    <tr><td>&#x2610;</td><td>Return-to-home altitude and parameters set</td></tr>
    <tr><td>&#x2610;</td><td>Emergency landing zone identified</td></tr>
    <tr><td>&#x2610;</td><td>NOTAMs checked — no conflicts</td></tr>
    <tr><td>&#x2610;</td><td>Weather within limits (wind, visibility, precipitation)</td></tr>
    <tr><td>&#x2610;</td><td>All permissions obtained and documented</td></tr>
    <tr><td>&#x2610;</td><td>Go / No-Go confirmed</td></tr>
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
