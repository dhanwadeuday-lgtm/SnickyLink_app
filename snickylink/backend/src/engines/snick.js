const db = require('../db');
const crypto = require('crypto');
const { id } = require('../utils/ids');
const { localDate, localDayStart, SLOT_HOURS, WINDOW_MS } = require('../utils/time');
const { emit } = require('../events/bus');

// ---------------------------------------------------------------------------
// Engine 3 + 4: pick three Snicks for a couple for one local day, plus the
// Mystery Snick that sits behind them.
// Selection is weighted, not pure random: recently-seen catalog entries and
// over-used categories are pushed down, so the mix stays varied.
// ---------------------------------------------------------------------------
function pickForDay(coupleId) {
  const pool = db
    .prepare(`SELECT * FROM snick_catalog WHERE rarity = 'NORMAL'`)
    .all();

  const recent = db
    .prepare(
      `SELECT catalog_id, MAX(window_start) last_seen FROM daily_snicks
       WHERE couple_id = ? GROUP BY catalog_id`
    )
    .all(coupleId);
  const lastSeen = Object.fromEntries(recent.map((r) => [r.catalog_id, r.last_seen]));

  const catCount = db
    .prepare(
      `SELECT sc.category, COUNT(*) n FROM daily_snicks ds
       JOIN snick_catalog sc ON sc.id = ds.catalog_id
       WHERE ds.couple_id = ? AND ds.window_start > ?
       GROUP BY sc.category`
    )
    .all(coupleId, Date.now() - 14 * 86400000);
  const catN = Object.fromEntries(catCount.map((r) => [r.category, r.n]));

  const now = Date.now();
  const scored = pool.map((s) => {
    const daysSince = lastSeen[s.id] ? (now - lastSeen[s.id]) / 86400000 : 99;
    let w = 1;
    if (daysSince < 3) w *= 0.05;        // just did it — almost never repeat
    else if (daysSince < 10) w *= 0.4;
    w *= 1 / (1 + (catN[s.category] || 0) * 0.25); // balance categories
    w *= 1 + Math.random() * 0.6;        // controlled randomness
    return { s, w };
  });

  scored.sort((a, b) => b.w - a.w);
  const chosen = scored.slice(0, 3).map((x) => x.s);

  // Slot 4 is the Mystery Snick: sometimes normal, sometimes rare.
  const roll = crypto.randomInt(0, 100);
  const rarity = roll < 12 ? 'LEGENDARY' : roll < 35 ? 'RARE' : 'NORMAL';
  const mystery =
    db.prepare(`SELECT * FROM snick_catalog WHERE rarity=? ORDER BY RANDOM() LIMIT 1`).get(rarity) ||
    scored[3].s;

  return [...chosen, mystery];
}

function ensureDay(couple, atTs = Date.now()) {
  const date = localDate(atTs, couple.tz_offset);
  const existing = db
    .prepare(`SELECT COUNT(*) c FROM daily_snicks WHERE couple_id=? AND local_date=?`)
    .get(couple.id, date).c;
  if (existing === 4) return date;

  const dayStart = localDayStart(date, couple.tz_offset);
  const picks = pickForDay(couple.id);
  const ins = db.prepare(
    `INSERT OR IGNORE INTO daily_snicks
       (id,couple_id,catalog_id,local_date,slot_index,is_mystery,window_start,window_end)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  const tx = db.transaction(() => {
    picks.forEach((p, i) => {
      const isMystery = i === 3;
      // window_start 0 marks "not unlocked yet" for the Mystery Snick.
      const start = isMystery ? 0 : dayStart + SLOT_HOURS[i] * 3600000;
      const end = isMystery ? 0 : start + WINDOW_MS;
      ins.run(id('ds_'), couple.id, p.id, date, i, isMystery ? 1 : 0, start, end);
    });
    // Only the three scheduled Snicks count as offered. The Mystery one is
    // added to the denominator when it actually unlocks.
    db.prepare(
      `INSERT INTO couple_stats (couple_id, snicks_offered) VALUES (?,3)
       ON CONFLICT(couple_id) DO UPDATE SET snicks_offered = snicks_offered + 3`
    ).run(couple.id);
  });
  tx();
  emit('DAILY_SNICKS_CREATED', { coupleId: couple.id, date });
  return date;
}

// State is computed from the clock, never trusted from the client.
function resolveState(row, now = Date.now()) {
  if (row.state === 'VERIFIED') return 'VERIFIED';
  if (row.state === 'FAILED') return 'FAILED';
  if (row.state === 'SUBMITTED') return 'SUBMITTED';
  // Mystery Snick that has not been earned yet.
  if (row.is_mystery === 1 && row.window_start === 0) return 'LOCKED';
  if (now < row.window_start) return 'LOCKED';
  if (now > row.window_end) return 'EXPIRED';
  return 'ACTIVE';
}

// The Mystery Snick unlocks the moment all three scheduled Snicks are done.
// Its two-hour window starts right then, so the reward stays immediate.
function maybeUnlockMystery(coupleId, date, now) {
  const rows = db
    .prepare(`SELECT * FROM daily_snicks WHERE couple_id=? AND local_date=?`)
    .all(coupleId, date);
  const mystery = rows.find((r) => r.is_mystery === 1);
  if (!mystery || mystery.window_start !== 0) return;

  const scheduled = rows.filter((r) => r.is_mystery === 0);
  const allDone = scheduled.length === 3 && scheduled.every((r) => r.state === 'VERIFIED');
  if (!allDone) return;

  db.prepare(`UPDATE daily_snicks SET window_start=?, window_end=? WHERE id=?`)
    .run(now, now + WINDOW_MS, mystery.id);
  db.prepare(
    `UPDATE couple_stats SET snicks_offered = snicks_offered + 1 WHERE couple_id=?`
  ).run(coupleId);
  emit('MYSTERY_UNLOCKED', { coupleId, snickId: mystery.id });
}

function listDay(couple, now = Date.now()) {
  const date = ensureDay(couple, now);
  maybeUnlockMystery(couple.id, date, now);
  const rows = db
    .prepare(
      `SELECT ds.*, sc.title, sc.prompt, sc.category, sc.difficulty, sc.verification, sc.rarity
       FROM daily_snicks ds JOIN snick_catalog sc ON sc.id = ds.catalog_id
       WHERE ds.couple_id=? AND ds.local_date=? ORDER BY ds.slot_index`
    )
    .all(couple.id, date);

  return rows.map((r) => {
    const state = resolveState(r, now);
    // Mystery Snick stays hidden until its window opens — that is the whole point.
    const hidden = r.is_mystery === 1 && state === 'LOCKED';
    const notEarnedYet = r.is_mystery === 1 && r.window_start === 0;
    return {
      id: r.id,
      slot: r.slot_index,
      isMystery: !!r.is_mystery,
      state,
      windowStart: r.window_start,
      windowEnd: r.window_end,
      locked: notEarnedYet,
      title: hidden ? 'Mystery Snick' : r.title,
      prompt: notEarnedYet
        ? 'Teenon Snicks poore karo, phir ye khulega.'
        : hidden
          ? 'Window khulte hi pata chalega.'
          : r.prompt,
      category: hidden ? null : r.category,
      difficulty: r.difficulty,
      verification: hidden ? null : r.verification,
      rarity: hidden ? null : r.rarity,
      xp: xpFor(r),
    };
  });
}

function xpFor(row) {
  let xp = 10;
  if (row.difficulty === 2) xp = 20;
  if (row.difficulty === 3) xp = 30;
  if (row.rarity === 'RARE') xp += 15;
  if (row.rarity === 'LEGENDARY') xp += 40;
  return xp;
}

function getOne(coupleId, snickId) {
  return db
    .prepare(
      `SELECT ds.*, sc.title, sc.prompt, sc.category, sc.difficulty, sc.verification, sc.rarity
       FROM daily_snicks ds JOIN snick_catalog sc ON sc.id = ds.catalog_id
       WHERE ds.id=? AND ds.couple_id=?`
    )
    .get(snickId, coupleId);
}

// Called by a cron-ish sweep: anything past its window that was never
// submitted is marked FAILED once, and the partner gets a soft nudge.
function expireStale() {
  const rows = db
    .prepare(
      `SELECT * FROM daily_snicks WHERE state='PENDING' AND window_end > 0 AND window_end < ?`
    )
    .all(Date.now());
  for (const r of rows) {
    db.prepare(`UPDATE daily_snicks SET state='FAILED' WHERE id=?`).run(r.id);
    emit('SNICK_EXPIRED', { coupleId: r.couple_id, snickId: r.id });
  }
  return rows.length;
}

module.exports = { ensureDay, listDay, getOne, resolveState, xpFor, expireStale, maybeUnlockMystery };
