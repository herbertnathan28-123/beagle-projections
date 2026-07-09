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
  return m === 15 || m === 45;
}

// The buy slot (UTC day + slot index + label) exactly 15 minutes from `now`.
function upcomingBuyTarget(now) {
  const t = new Date(now.getTime() + 15 * 60000);
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

// Discord message for a due warning — only includes the line(s) that are > 0.
function buildAlertMessage(discordId, label, fuel, co2) {
  const lines = ['<@' + discordId + '> ⏰ **Buy in 15 min** · ' + label];
  if (fuel > 0) lines.push('⛽ Fuel: buy **' + fmt(fuel) + '** Lbs');
  if (co2 > 0)  lines.push('🌿 CO2: buy **' + fmt(co2) + '** quotas');
  return lines.join('\n');
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
    if (fuel > 0 || co2 > 0) {
      out.push({
        discordId: did,
        slot: target.slot,
        label: target.label,
        fuel, co2,
        message: buildAlertMessage(did, target.label, fuel, co2),
      });
    }
  }
  return out;
}

// A stable key so the scheduler fires each (player, day, slot) at most once.
function firedKey(now, alert) {
  return alert.discordId + ':' + now.getUTCFullYear() + '-' + (now.getUTCMonth() + 1) + '-' +
         now.getUTCDate() + ':' + alert.slot;
}

module.exports = {
  SLOTS_PER_DAY, slotLabel, isWarningMinute, upcomingBuyTarget,
  planAmountAt, buildAlertMessage, dueAlerts, firedKey, fmt,
};
