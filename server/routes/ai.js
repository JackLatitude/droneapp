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
    return '';
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
