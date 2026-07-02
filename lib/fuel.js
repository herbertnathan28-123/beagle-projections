// Fuel & CO2 optimal-window path — cheapest fuel and CO2 slot per day of month.
const { FUEL_SCHEDULE, FUEL_PATH_FILE } = require('../config');
const { readJSON, writeJSON } = require('./storage');

function generateFuelPath() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const daySchedule = FUEL_SCHEDULE[String(d)];
    if (!daySchedule) {
      days.push({ day: d, fuel: null, co2: null });
      continue;
    }
    let bestFuel = null, bestCo2 = null;
    for (const [slot, [fp, cp]] of Object.entries(daySchedule)) {
      if (!bestFuel || fp < bestFuel.price) bestFuel = { slot, price: fp };
      if (!bestCo2 || cp < bestCo2.price) bestCo2 = { slot, price: cp };
    }
    const fuelRating = bestFuel.price < 500 ? 'green' : bestFuel.price <= 900 ? 'amber' : 'red';
    const co2Rating = bestCo2.price < 120 ? 'green' : bestCo2.price <= 160 ? 'amber' : 'red';
    days.push({
      day: d,
      fuel: { slot: bestFuel.slot, price: bestFuel.price, rating: fuelRating },
      co2:  { slot: bestCo2.slot,  price: bestCo2.price,  rating: co2Rating },
    });
  }
  return { year, month, generated: now.toISOString(), days };
}

// Cached per calendar month on disk; regenerated when month/year rolls over.
function getFuelPath() {
  const now = new Date();
  const curMonth = now.getUTCMonth() + 1;
  const curYear = now.getUTCFullYear();
  const cached = readJSON(FUEL_PATH_FILE, null);
  if (cached && cached.month === curMonth && cached.year === curYear) return cached;
  const fp = generateFuelPath();
  writeJSON(FUEL_PATH_FILE, fp);
  console.log('[FUEL-PATH] Generated for ' + curYear + '-' + String(curMonth).padStart(2, '0'));
  return fp;
}

module.exports = { generateFuelPath, getFuelPath };
