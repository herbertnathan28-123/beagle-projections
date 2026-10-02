// Stopover demand + aircraft specs (ATL-148) — offline dataset built by
// scripts/build_stopover_data.py from the public MIT-licensed abc8747/am4 data.
// demand.bin.gz holds y/j/f (uint16 LE) for every airport pair, indexed by the
// page's own DB order; pairs are undirected (i<j).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(__dirname, '..', 'data');
const N = 3907;

let _icaoIdx = null;
let _demand = null;
let _aircrafts = null;

function icaoIdx() {
  if (!_icaoIdx) {
    const list = JSON.parse(fs.readFileSync(path.join(DIR, 'stopover-airports.json'), 'utf8'));
    _icaoIdx = new Map(list.map((icao, i) => [icao, i]));
  }
  return _icaoIdx;
}

function demandBuf() {
  if (!_demand) {
    _demand = zlib.gunzipSync(fs.readFileSync(path.join(DIR, 'stopover-demand.bin.gz')));
  }
  return _demand;
}

function pairIdx(a, b) {
  if (a > b) { const t = a; a = b; b = t; }
  return ((a * (2 * N - a - 1)) >> 1) + b - a - 1;
}

// Daily demand {y,j,f} for the airport pair, plus derived cargo units
// {l,h} per aircraft.cpp (l = round(y/2) t, h = j t). Null when unknown.
function demand(fromIcao, toIcao) {
  const idx = icaoIdx();
  const i = idx.get(String(fromIcao || '').toUpperCase());
  const j = idx.get(String(toIcao || '').toUpperCase());
  if (i == null || j == null || i === j) return null;
  const off = pairIdx(i, j) * 6;
  const b = demandBuf();
  const y = b.readUInt16LE(off);
  const jj = b.readUInt16LE(off + 2);
  const f = b.readUInt16LE(off + 4);
  return { y, j: jj, f, l: Math.round(y / 2) * 1000, h: jj * 1000 };
}

function aircrafts() {
  if (!_aircrafts) {
    _aircrafts = JSON.parse(fs.readFileSync(path.join(DIR, 'stopover-aircrafts.json'), 'utf8'));
  }
  return _aircrafts;
}

module.exports = { demand, aircrafts };
