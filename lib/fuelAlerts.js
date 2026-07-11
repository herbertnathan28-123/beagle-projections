// ═══════════════════════════════════════════════════════════════════════════
// BEAGLE — PER-PLAYER FUEL/CO2 BUY ALERTS (15-min warning)
//
// Registered fuel-calculator players push their optimiser plan (the exact
// per-slot suggested buys — sugAll for fuel + CO2) to /api/fuel-plan. This
// module turns a stored plan into a 15-minute-ahead buy warning, fired by the
// server scheduler and posted to the #fuel-alert Discord webhook.
//
// The plan array layout mirrors the client's monthPathway sugAll exactly:
//   index (day, slot) = (day − baseDay) * 48 + slot     (day = UTC calendar date)
// so no optimiser re-derivation is needed server-side — it is the calculator's
// own plan. Game time = UTC (getGameNow() is new Date()), so all math is UTC.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const SLOTS_PER_DAY = 48;   // 30-min slots
const fmt = n => Math.round(n).toLocaleString('en-US');

// "HH:MM" label for a 0..47 slot index.
function slotLabel(slot) {
  const h = Math.floor(slot / 2), m = (slot % 2) * 30;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// A buy slot is warned about 15 minutes ahead. At :15 → the :30 slot; at :45 →
// the next hour's :00 slot (rolling to the next UTC day when needed).
function isWarningMinute(now) {
  const m = now.getUTCMinutes();
  return m === 25 || m === 55;
}

// The buy slot (UTC day + slot index + label) exactly 15 minutes from `now`.
function upcomingBuyTarget(now) {
  const t = new Date(now.getTime() + 5 * 60000);
  const slot = Math.min(Math.floor((t.getUTCHours() * 60 + t.getUTCMinutes()) / 30), SLOTS_PER_DAY - 1);
  return { day: t.getUTCDate(), slot, label: slotLabel(slot) };
}

// Suggested fuel/CO2 buy for a plan at a target (UTC day, slot). Returns {0,0}
// when the target is outside the plan window (before baseDay, or past month end).
function planAmountAt(plan, targetDay, slot) {
  if (!plan || !Array.isArray(plan.fsug) || !Array.isArray(plan.csug)) return { fuel: 0, co2: 0 };
  const idx = (targetDay - plan.baseDay) * SLOTS_PER_DAY + slot;
  if (idx < 0) return { fuel: 0, co2: 0 };
  const fuel = idx < plan.fsug.length ? Number(plan.fsug[idx]) || 0 : 0;
  const co2  = idx < plan.csug.length ? Number(plan.csug[idx]) || 0 : 0;
  return { fuel: fuel > 0 ? fuel : 0, co2: co2 > 0 ? co2 : 0 };
}

// Discord message for ONE commodity. Fuel and CO2 are always separate
// notifications — separate price windows, separate schedule timings — so a
// message never mixes the two. `lead` overrides the default 15-min phrasing
// for late-breaking alerts ("in 1 min", "NOW — window open").
function buildAlertMessage(discordId, label, type, qty, lead) {
  const head = '<@' + discordId + '> ⏰ **' + (type === 'fuel' ? 'FUEL' : 'CO2') + ' buy ' + (lead || 'in 5 min') + '** · ' + label;
  const line = type === 'fuel'
    ? '⛽ Fuel: buy **' + fmt(qty) + '** Lbs'
    : '🌿 CO2: buy **' + fmt(qty) + '** quotas';
  return head + '\n' + line;
}

// Split a slot's amounts into per-type entries (fuel first, then CO2).
function splitByType(base, fuel, co2) {
  const out = [];
  if (fuel > 0) out.push({ ...base, type: 'fuel', qty: fuel });
  if (co2  > 0) out.push({ ...base, type: 'co2',  qty: co2  });
  return out;
}

// Late-breaking buys: when a re-pushed plan (DEP pressed late, schedule
// reshuffled) contains a buy the :15/:45 warning can no longer cover — i.e.
// in the slot that is OPEN right now, or in the next slot when it starts
// within 15 minutes (its warning minute has already passed). Buys further out
// are left to the normal scheduler so nothing fires twice. One entry PER TYPE.
function imminentBuys(plan, now) {
  const out = [];
  const minsNow = now.getUTCHours() * 60 + now.getUTCMinutes();
  const curSlot = Math.min(Math.floor(minsNow / 30), SLOTS_PER_DAY - 1);
  const cur = planAmountAt(plan, now.getUTCDate(), curSlot);
  out.push(...splitByType({ day: now.getUTCDate(), slot: curSlot, label: slotLabel(curSlot), minsLeft: 0 }, cur.fuel, cur.co2));
  const minsToNext = 30 - (minsNow % 30);        // minutes until the next slot opens
  if (minsToNext <= 5) {                         // > 15 → the :15/:45 warning still handles it
    const t = new Date(now.getTime() + minsToNext * 60000);
    const nSlot = Math.min(Math.floor((t.getUTCHours() * 60 + t.getUTCMinutes()) / 30), SLOTS_PER_DAY - 1);
    const nx = planAmountAt(plan, t.getUTCDate(), nSlot);
    out.push(...splitByType({ day: t.getUTCDate(), slot: nSlot, label: slotLabel(nSlot), minsLeft: minsToNext }, nx.fuel, nx.co2));
  }
  return out;
}

// Given all stored plans and `now`, return the alerts to post THIS minute.
// Empty unless `now` is a :15/:45 warning minute; a plan with no upcoming buy
// yields nothing (silent). maxAgeDays skips plans too stale to trust (reserves
// drift); pass 0/null to never expire.
function dueAlerts(plans, now, maxAgeDays) {
  const out = [];
  if (!isWarningMinute(now)) return out;
  const target = upcomingBuyTarget(now);
  const maxAgeMs = maxAgeDays ? maxAgeDays * 86400000 : 0;
  for (const did of Object.keys(plans || {})) {
    const plan = plans[did];
    if (!plan) continue;
    if (maxAgeMs && plan.updated) {
      const age = now.getTime() - new Date(plan.updated).getTime();
      if (age > maxAgeMs) continue;   // plan too old — reserves likely stale, don't fire
    }
    const { fuel, co2 } = planAmountAt(plan, target.day, target.slot);
    // Fuel and CO2 are SEPARATE notifications (separate price windows/timings):
    // one alert entry per type, fuel first, CO2 second when both land together.
    for (const t of splitByType({ discordId: did, slot: target.slot, label: target.label }, fuel, co2)) {
      out.push({ ...t, message: buildAlertMessage(did, target.label, t.type, t.qty) });
    }
  }
  return out;
}

// A stable key so each (player, day, slot, type) fires at most once — the type
// is part of the key so a fuel alert never suppresses a CO2 alert (or vice
// versa) in the same slot.
function firedKey(now, alert) {
  return alert.discordId + ':' + now.getUTCFullYear() + '-' + (now.getUTCMonth() + 1) + '-' +
         now.getUTCDate() + ':' + alert.slot + ':' + (alert.type || 'fuel');
}

module.exports = {
  SLOTS_PER_DAY, slotLabel, isWarningMinute, upcomingBuyTarget,
  planAmountAt, buildAlertMessage, splitByType, dueAlerts, imminentBuys, firedKey, fmt,
};
