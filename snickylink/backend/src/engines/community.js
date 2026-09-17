const db = require('../db');
const { id } = require('../utils/ids');
const { emit } = require('../events/bus');

// Engine 16. Visibility is enforced here, on the server. A PRIVATE_COUPLE post
// never appears in anyone else's feed, whatever the client asks for.
function createPost({ couple, user, body, mediaId, visibility }) {
  if (!body || !body.trim()) { const e = new Error('body_required'); e.status = 400; throw e; }
  if (!['PRIVATE_COUPLE', 'COMMUNITY'].includes(visibility)) {
    const e = new Error('bad_visibility'); e.status = 400; throw e;
  }
  if (mediaId) {
    const owned = db.prepare('SELECT 1 FROM media WHERE id=? AND couple_id=?').get(mediaId, couple.id);
    if (!owned) { const e = new Error('media_not_yours'); e.status = 403; throw e; }
  }
  const postId = id('pst_');
  db.prepare(
    `INSERT INTO community_posts (id,couple_id,author_id,body,media_id,visibility,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run(postId, couple.id, user.id, body.trim(), mediaId || null, visibility, Date.now());
  emit('COMMUNITY_POSTED', { coupleId: couple.id, userId: user.id, postId, visibility });
  return getPost(postId, couple.id);
}

function getPost(postId, viewerCoupleId) {
  const p = db.prepare('SELECT * FROM community_posts WHERE id=?').get(postId);
  if (!p) return null;
  if (p.status !== 'VISIBLE' && p.couple_id !== viewerCoupleId) return null;
  if (p.visibility === 'PRIVATE_COUPLE' && p.couple_id !== viewerCoupleId) return null;
  return decorate(p, viewerCoupleId);
}

function decorate(p, viewerCoupleId) {
  const reactions = db
    .prepare('SELECT emoji, COUNT(*) n FROM post_reactions WHERE post_id=? GROUP BY emoji')
    .all(p.id);
  const mine = db
    .prepare(
      `SELECT pr.emoji FROM post_reactions pr JOIN couple_members m ON m.user_id = pr.user_id
       WHERE pr.post_id=? AND m.couple_id=?`
    )
    .get(p.id, viewerCoupleId);
  return { ...p, isMine: p.couple_id === viewerCoupleId, reactions, myReaction: mine?.emoji || null };
}

// Public feed, minus anything this couple has blocked.
function feed(viewerCoupleId, { limit = 50, before = Date.now() } = {}) {
  const rows = db
    .prepare(
      `SELECT p.* FROM community_posts p
       WHERE p.visibility='COMMUNITY' AND p.status='VISIBLE' AND p.created_at < ?
         AND p.couple_id NOT IN (SELECT blocked_couple_id FROM blocks WHERE blocker_couple_id=?)
       ORDER BY p.created_at DESC LIMIT ?`
    )
    .all(before, viewerCoupleId, limit);
  return rows.map((p) => decorate(p, viewerCoupleId));
}

function ourWall(coupleId) {
  return db
    .prepare(`SELECT * FROM community_posts WHERE couple_id=? ORDER BY created_at DESC`)
    .all(coupleId)
    .map((p) => decorate(p, coupleId));
}

function react({ postId, user, coupleId, emoji }) {
  const p = getPost(postId, coupleId);
  if (!p) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (!emoji) {
    db.prepare('DELETE FROM post_reactions WHERE post_id=? AND user_id=?').run(postId, user.id);
  } else {
    db.prepare(
      `INSERT INTO post_reactions (post_id,user_id,emoji,created_at) VALUES (?,?,?,?)
       ON CONFLICT(post_id,user_id) DO UPDATE SET emoji=excluded.emoji`
    ).run(postId, user.id, emoji, Date.now());
  }
  return getPost(postId, coupleId);
}

function removeOwn(postId, coupleId) {
  return db.prepare(`UPDATE community_posts SET status='REMOVED' WHERE id=? AND couple_id=?`)
    .run(postId, coupleId).changes > 0;
}

module.exports = { createPost, getPost, feed, ourWall, react, removeOwn };
