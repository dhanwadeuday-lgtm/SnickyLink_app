const db = require('../db');
const { id } = require('../utils/ids');
const { bus } = require('../events/bus');

// Engine 15, in-app only. Rows land in `notifications`; wiring FCM/APNs later
// means reading this table from a worker instead of changing any engine.
function push(coupleId, userId, kind, payload) {
  db.prepare(
    `INSERT INTO notifications (id,couple_id,user_id,kind,payload,created_at)
     VALUES (?,?,?,?,?,?)`
  ).run(id('ntf_'), coupleId, userId, kind, JSON.stringify(payload), Date.now());
}

function partnerOf(coupleId, userId) {
  const r = db
    .prepare('SELECT user_id FROM couple_members WHERE couple_id=? AND user_id != ?')
    .get(coupleId, userId);
  return r ? r.user_id : null;
}

bus.on('SNICK_SUBMITTED', (e) => {
  const partner = partnerOf(e.coupleId, e.userId);
  if (partner) push(e.coupleId, partner, 'PARTNER_SUBMITTED', { snickId: e.snickId });
});

bus.on('SNICK_VERIFIED', (e) => {
  const partner = partnerOf(e.coupleId, e.userId);
  if (partner) push(e.coupleId, partner, 'SNICK_VERIFIED', { snickId: e.snickId, xp: e.xp });
});

// Loss framing, not guilt framing — the copy names what's at risk, not what
// the user did wrong.
bus.on('SNICK_EXPIRED', (e) => {
  push(e.coupleId, null, 'SNICK_EXPIRED', {
    snickId: e.snickId,
    message: 'Ek window band ho gayi. Streak abhi bhi safe hai — agla Snick pakad lo.',
  });
});

bus.on('MILESTONE_REACHED', (e) => {
  push(e.coupleId, null, 'MILESTONE', { milestone: e.milestone });
});

function list(coupleId, userId) {
  return db
    .prepare(
      `SELECT * FROM notifications WHERE couple_id=? AND (user_id IS NULL OR user_id=?)
       ORDER BY created_at DESC LIMIT 50`
    )
    .all(coupleId, userId)
    .map((n) => ({ ...n, payload: JSON.parse(n.payload) }));
}

module.exports = { list, push };
