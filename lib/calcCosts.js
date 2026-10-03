// Contribution Calculator per-aircraft cost constants (views/calc.js) — one source for the
// calculator page and the Stopover Finder optimiser. Served to the browser only by the
// key-gated calculator; the Stopover Finder uses them server-side.
// Generic $/1,000 lb fuel and $/1,000 q CO2 — fixed point values (Nathan, 9 Sep 2026).
const FUEL_P = 600, CO2_P = 130;
const REV = {
  'A380-800':     { ycap:600, cf:21.59, cc:0.0914, acheckH:28750.5, repair:1557 },   // cf = fuel lb/km at CI 200 · cc = CO₂ q/km per seat-unit at CI 200 · fitted from 902-route export   // 400 = typical configured seats after class layout (Nathan, 6 Sep); 600 is the raw purchase capacity
  'Concorde':     { ycap:128, cf:32.4,  cc:0.20,   acheckH:265693,  repair:2945 },
  // ── ATL-78 export constants ──
  'A330-200':     { cf:17.644, ccS:0.53922, acheckH:9959,  repair:294.52, spd:958,   priceM:39 },
  'A330-300':     { cf:18.682, ccS:0.53515, acheckH:13480, repair:292.48, spd:958,   priceM:39 },
  'A330-800neo':  { ycap:406, cf:11.640, ccS:0.26797, acheckH:6692,  repair:575.95, spd:801,   priceM:77 },   // ATL-78 calls it "A330-800"; the game sheet and the sibling row below both say neo
  'A330-900neo':  { cf:12.610, ccS:0.38816, acheckH:8574,  repair:737.88, spd:801,   priceM:98 },
  'A340-300':     { cf:20.758, ccS:0.44524, acheckH:15343, repair:374.42, spd:1004,  priceM:50 },
  'A340-600':     { cf:20.060, ccS:0.50014, acheckH:13674, repair:471.74, spd:871,   priceM:63 },
  'A350-900':     { cf:15.501, ccS:0.37512, acheckH:5127,  repair:475.90, spd:860,   priceM:64 },
  'A350-900R':    { cf:15.501, ccS:0.37512, acheckH:6363,  repair:558.38, spd:860,   priceM:75 },
  'B737-800':     { cf:9.118,  ccS:0.31810, acheckH:985,   repair:29.75,  spd:725,   priceM:4  },
  'B737 MAX 8':   { cf:6.994,  ccS:0.24119, acheckH:1385,  repair:121.58, spd:881,   priceM:16 },
  'B787-8':       { cf:14.744, ccS:0.35726, acheckH:3020,  repair:131.03, spd:822,   priceM:18 },
  'B787-9':       { cf:14.744, ccS:0.35726, acheckH:9800,  repair:472.49, spd:822,   priceM:63 },
  'B787-10':      { cf:18.061, ccS:0.47429, acheckH:17289, repair:491.37, spd:860,   priceM:66 },
  'B747SP':       { ycap:350, cf:21.127, ccS:0.61107, acheckH:9696,  repair:275.56, spd:990,   priceM:37 },
  'Il-96-400':    { ycap:436, cf:26.888, ccS:0.43004, acheckH:9671,  repair:272.98, spd:809,   priceM:36 }
  // B777-200 is contributions-only until an export is confirmed (ATL-78) — no entry, by design.
  // MC-21-400 likewise: its aircraft sheet gives A-check $494,428 over a 400h check
  // (= $1,236.07 per started hour) and 19.57 lb/km, but no per-flight repair figure exists
  // for it anywhere, so a partial entry would compute a profit that silently omits a cost.
  // B747-8 carries ATL-78 constants but is not in AIRCRAFT_DATA and so cannot be selected;
  // its constants stay on the issue rather than sitting here unreachable.
  //
  // Cross-checked against Nathan's in-game aircraft sheets. The A-check column proves out
  // exactly on all three sheets he sent:
  //   B747SP      $3,878,280 / 400h = $9,695.70 -> 9,696
  //   Il-96-400   $4,448,548 / 460h = $9,670.76 -> 9,671
  //   A330-800neo $3,413,028 / 510h = $6,692.21 -> 6,692
  // All three match ATL-78 to the dollar, which validates the whole A-check column.
};

module.exports = { REV, FUEL_P, CO2_P };
