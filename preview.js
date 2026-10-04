// Standalone preview server (ATL-148): serves only the static site and the two
// stopover data endpoints — no schedulers, Discord hooks, /data state, or any
// other boot side effects. Used for the Render preview deploy Nathan approves
// before the change goes live. Run: node preview.js
const path = require('path');
const express = require('express');
const stopoverData = require('./lib/stopoverData');
const stopoverPlan = require('./lib/stopoverPlan');

const app = express();
app.get('/healthz', (req, res) => res.status(200).type('text').send('OK'));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/api/stopover/aircrafts', (req, res) => {
  res.json(stopoverData.aircrafts());
});

// Best setup (ATL-148 Phase 3): flight-time optimiser; calculator costs/C/D stay server-side.
app.get('/api/stopover/plan', (req, res) => {
  const p = stopoverPlan.planFromQuery(req.query, stopoverData);
  if (!p) return res.status(400).json({ ok: false, error: 'bad plan query' });
  res.json(p);
});

app.get('/api/stopover/demand', (req, res) => {
  const d = stopoverData.demand(req.query.from, req.query.to);
  if (!d) return res.status(404).json({ ok: false, error: 'unknown airport pair' });
  res.json(d);
});


// Real-world rain for the map (NASA GIBS IMERG 30-min frames, cached server-side).
const stopoverWeather = require('./lib/stopoverWeather');
app.get('/api/stopover/weather', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=300').json(await stopoverWeather.index());
});
app.get('/api/stopover/weather/frame/:t.png', (req, res) => {
  const png = stopoverWeather.frame(req.params.t);
  if (!png) return res.status(404).end();
  res.type('png').set('Cache-Control', 'public, max-age=86400, immutable').send(png);
});
// World synoptic chart (NOAA GFS isobars + WPC fronts), contoured and cached server-side.
const stopoverSynoptic = require('./lib/stopoverSynoptic');
app.get('/api/stopover/synoptic', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=600').json(await stopoverSynoptic.index());
});
// Zoomable map imagery (NASA GIBS Blue Marble + IMERG rain tiles), proxied and cached server-side.
const stopoverTiles = require('./lib/stopoverTiles');
app.get('/api/stopover/tiles/bm/:z/:r/:c.jpg', stopoverTiles.handler('bm'));
app.get('/api/stopover/tiles/rain/:t/:z/:r/:c.png', stopoverTiles.handler('rain'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Stopover preview on port ${PORT}`));
