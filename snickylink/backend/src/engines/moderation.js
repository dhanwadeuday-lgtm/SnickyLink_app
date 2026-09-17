const db = require('../db');
const { id } = require('../utils/ids');
const { emit } = require('../events/bus');

// Engine 17. Reports queue for humans, blocks take effect immediately.
const BANNED = [/\bfuck\b/i, /\bbitch\b/i, /\bchutiy/i, /\bmadarch/i, /\bbhosd/i];

// A crude pre-filter, deliberately: it flags for review, it does not silently
// reject. Real moderation is the human queue below.
function screen(text) {
  const hits = BANNED.filter((r) => r.test(text || ''));
  return { flagged: hits.length > 0, score: hits.length };
}

function report({ user, targetType, targetId, reason }) {
  if (!['post', 'user'].includes(targetType)) {
    const e = new Error('bad_target'); e.status = 400; throw e;
  }
  const rId = id('rep_');
  db.prepare(
    `INSERT INTO reports (id,reporter_id,target_type,target_id,reason,created_at)
     VALUES (?,?,?,?,?,?)`
  ).run(rId, user.id, targetType, targetId, reason || 'unspecified', Date.now());
  emit('CONTENT_REPORTED', { userId: user.id, targetType, targetId, reportId: rId });

  // Three open reports auto-hide a post until a human looks at it.
  if (targetType === 'post') {
    const n = db
      .prepare(`SELECT COUNT(*) c FROM reports WHERE target_type='post' AND target_id=? AND status='OPEN'`)
      .get(targetId).c;
    if (n >= 3) {
      db.prepare(`UPDATE community_posts SET status='HIDDEN' WHERE id=?`).run(targetId);
      emit('POST_AUTO_HIDDEN', { postId: targetId, reports: n });
    }
  }
  return { reportId: rId };
}

function block(blockerCoupleId, blockedCoupleId) {
  if (blockerCoupleId === blockedCoupleId) {
    const e = new Error('cannot_block_self'); e.status = 400; throw e;
  }
  db.prepare(
    `INSERT OR IGNORE INTO blocks (blocker_couple_id,blocked_couple_id,created_at) VALUES (?,?,?)`
  ).run(blockerCoupleId, blockedCoupleId, Date.now());
  return { blocked: true };
}

function unblock(blockerCoupleId, blockedCoupleId) {
  db.prepare('DELETE FROM blocks WHERE blocker_couple_id=? AND blocked_couple_id=?')
    .run(blockerCoupleId, blockedCoupleId);
  return { blocked: false };
}

function queue() {
  return db.prepare(`SELECT * FROM reports WHERE status='OPEN' ORDER BY created_at ASC`).all();
}

function resolve({ reportId, adminId, action }) {
  const r = db.prepare('SELECT * FROM reports WHERE id=?').get(reportId);
  if (!r) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (action === 'remove' && r.target_type === 'post') {
    db.prepare(`UPDATE community_posts SET status='REMOVED' WHERE id=?`).run(r.target_id);
  }
  if (action === 'restore' && r.target_type === 'post') {
    db.prepare(`UPDATE community_posts SET status='VISIBLE' WHERE id=?`).run(r.target_id);
  }
  db.prepare(`UPDATE reports SET status=?, resolved_by=? WHERE id=?`)
    .run(action === 'dismiss' ? 'DISMISSED' : 'ACTIONED', adminId, reportId);
  emit('REPORT_RESOLVED', { reportId, action, adminId });
  return { ok: true };
}

module.exports = { screen, report, block, unblock, queue, resolve };
