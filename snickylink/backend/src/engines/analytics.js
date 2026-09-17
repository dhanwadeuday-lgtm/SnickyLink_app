const db = require('../db');
const { id } = require('../utils/ids');
const { bus } = require('../events/bus');

// Engine 20. Kept separate from the audit log on purpose: the audit log is a
// permanent record of what happened, this is disposable product measurement.
function track(name, { userId, coupleId, props } = {}) {
  db.prepare(
    `INSERT INTO analytics_events (id,name,user_id,couple_id,props,created_at)
     VALUES (?,?,?,?,?,?)`
  ).run(id('an_'), name, userId || null, coupleId || null, JSON.stringify(props || {}), Date.now());
}

// Domain events feed the funnel automatically, so the client can't skew it.
const MIRROR = [
  'USER_REGISTERED', 'COUPLE_CREATED', 'DAILY_SNICKS_CREATED', 'SNICK_SUBMITTED',
  'SNICK_VERIFIED', 'SNICK_EXPIRED', 'MYSTERY_UNLOCKED', 'MESSAGE_SENT',
  'MEMORY_CREATED', 'COMMUNITY_POSTED', 'MILESTONE_REACHED',
];
MIRROR.forEach((t) => bus.on(t, (e) => track(t, { userId: e.userId, coupleId: e.coupleId, props: e })));

function funnel(days = 30) {
  const since = Date.now() - days * 86400000;
  const counts = Object.fromEntries(
    db.prepare(
      `SELECT name, COUNT(*) n FROM analytics_events WHERE created_at > ? GROUP BY name`
    ).all(since).map((r) => [r.name, r.n])
  );
  const submitted = counts.SNICK_SUBMITTED || 0;
  const verified = counts.SNICK_VERIFIED || 0;
  return {
    windowDays: days,
    signups: counts.USER_REGISTERED || 0,
    couplesFormed: counts.COUPLE_CREATED || 0,
    snicksOffered: (counts.DAILY_SNICKS_CREATED || 0) * 3,
    snicksSubmitted: submitted,
    snicksVerified: verified,
    verificationRate: submitted ? Math.round((verified / submitted) * 100) : 0,
    mysteryUnlocked: counts.MYSTERY_UNLOCKED || 0,
    messages: counts.MESSAGE_SENT || 0,
    memories: counts.MEMORY_CREATED || 0,
    posts: counts.COMMUNITY_POSTED || 0,
    raw: counts,
  };
}

function retention() {
  const rows = db
    .prepare(
      `SELECT couple_id, COUNT(DISTINCT date(created_at/1000,'unixepoch')) days
       FROM analytics_events WHERE name='SNICK_VERIFIED' GROUP BY couple_id`
    )
    .all();
  return {
    activeCouples: rows.length,
    avgActiveDays: rows.length
      ? Math.round((rows.reduce((a, r) => a + r.days, 0) / rows.length) * 10) / 10
      : 0,
  };
}

module.exports = { track, funnel, retention };
