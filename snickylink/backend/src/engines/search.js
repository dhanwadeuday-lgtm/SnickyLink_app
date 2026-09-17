const db = require('../db');

// Engine 18. Two scopes only: the public community feed, and this couple's own
// private data. Nothing crosses that line.
function search({ coupleId, q, scope = 'all' }) {
  const term = `%${(q || '').trim()}%`;
  if (!q || q.trim().length < 2) return { memories: [], posts: [], snicks: [] };

  const memories = scope === 'community' ? [] : db
    .prepare(
      `SELECT id,title,note,happened_on FROM memories
       WHERE couple_id=? AND (title LIKE ? OR note LIKE ?) ORDER BY happened_on DESC LIMIT 20`
    )
    .all(coupleId, term, term);

  const snicks = scope === 'community' ? [] : db
    .prepare(
      `SELECT ds.id, sc.title, sc.category, ds.local_date, ds.state
       FROM daily_snicks ds JOIN snick_catalog sc ON sc.id=ds.catalog_id
       WHERE ds.couple_id=? AND sc.title LIKE ? ORDER BY ds.window_start DESC LIMIT 20`
    )
    .all(coupleId, term);

  const posts = scope === 'private' ? [] : db
    .prepare(
      `SELECT id,body,created_at FROM community_posts
       WHERE visibility='COMMUNITY' AND status='VISIBLE' AND body LIKE ?
         AND couple_id NOT IN (SELECT blocked_couple_id FROM blocks WHERE blocker_couple_id=?)
       ORDER BY created_at DESC LIMIT 20`
    )
    .all(term, coupleId);

  return { memories, posts, snicks };
}

module.exports = { search };
