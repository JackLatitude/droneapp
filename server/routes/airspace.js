import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();
const hospitals = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../knowledge/uk-hospitals.json'), 'utf8'));

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

router.get('/', async (req, res) => {
  const { lat, lng, radius_km = 20 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);
  const radiusF = parseFloat(radius_km);

  const results = { aerodromes: [], airspaceZones: [], hospitals: [] };

  // NHS hospitals within radius
  results.hospitals = hospitals
    .map(h => ({ ...h, type: 'HOSPITAL', distance_km: haversineKm(latF, lngF, h.lat, h.lng) }))
    .filter(h => h.distance_km <= radiusF)
    .sort((a, b) => a.distance_km - b.distance_km);

  // OpenAIP — aerodromes
  if (process.env.OPENAIP_API_KEY) {
    try {
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
