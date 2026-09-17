const db = require('../db');
const crypto = require('crypto');
const { id } = require('../utils/ids');
const { bus, emit } = require('../events/bus');

// Engine 7. XP is only ever awarded from a trusted server event, and every
// award carries an idempotency key so a retry can't double-pay.
function award({ coupleId, userId, amount, reason, key }) {
  try {
    db.prepare(
      `INSERT INTO xp_transactions (id,couple_id,user_id,amount,reason,idempotency_key,created_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run(id('xp_'), coupleId, userId || null, amount, reason, key, Date.now());
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return false; // already paid
    throw e;
  }
  db.prepare(
    `INSERT INTO couple_stats (couple_id,total_xp) VALUES (?,?)
     ON CONFLICT(couple_id) DO UPDATE SET total_xp = total_xp + ?`
  ).run(coupleId, amount, amount);
  emit('XP_AWARDED', { coupleId, userId, amount, reason });
  return true;
}

const LEVELS = [
  ['New Couple', 0], ['Getting Closer', 300], ['In Sync', 900],
  ['Strong Bond', 2000], ['Legendary', 4000],
];

function levelFor(xp) {
  let cur = LEVELS[0], next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i][1]) { cur = LEVELS[i]; next = LEVELS[i + 1] || null; }
  }
  // Past Legendary the progression keeps going: sub-tiers every 100 XP.
  if (!next) {
    const over = Math.floor((xp - LEVELS[4][1]) / 100);
    return { name: `Legendary ${toRoman(over + 1)}`, xp, nextAt: LEVELS[4][1] + (over + 1) * 100 };
  }
  return { name: cur[0], xp, nextAt: next[1] };
}

function toRoman(n) {
  const map = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out || 'I';
}

bus.on('SNICK_VERIFIED', (e) => {
  award({
    coupleId: e.coupleId, userId: e.userId, amount: e.xp,
    reason: 'snick_verified', key: `snick:${e.snickId}`,
  });
  // Surprise Bonus: roughly 1 in 6 completions pays a little extra.
  if (crypto.randomInt(0, 6) === 0) {
    award({
      coupleId: e.coupleId, userId: e.userId, amount: 15,
      reason: 'surprise_bonus', key: `bonus:${e.snickId}`,
    });
    emit('SURPRISE_BONUS', { coupleId: e.coupleId, snickId: e.snickId, amount: 15 });
  }
});

module.exports = { award, levelFor };
