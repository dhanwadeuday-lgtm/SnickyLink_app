const db = require('../db');
const { id } = require('../utils/ids');
const { emit } = require('../events/bus');

// Engine 13. A memory is an intentional keepsake, not automatic history.
// A chat photo or a verified Snick can be promoted into one without copying
// the underlying media object.
function create({ couple, user, title, note, happenedOn, mediaIds = [], source = 'manual', sourceRef }) {
  if (!title || !title.trim()) { const e = new Error('title_required'); e.status = 400; throw e; }
  const memId = id('mem_');
  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO memories (id,couple_id,created_by,title,note,happened_on,source,source_ref,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(memId, couple.id, user.id, title.trim(), note || null,
          happenedOn || new Date(now).toISOString().slice(0, 10), source, sourceRef || null, now);
    for (const m of mediaIds) {
      const owned = db.prepare('SELECT 1 FROM media WHERE id=? AND couple_id=?').get(m, couple.id);
      if (owned) db.prepare(`INSERT OR IGNORE INTO memory_media (memory_id,media_id) VALUES (?,?)`).run(memId, m);
    }
  });
  tx();
  emit('MEMORY_CREATED', { coupleId: couple.id, userId: user.id, memoryId: memId });
  return get(couple.id, memId);
}

function get(coupleId, memoryId) {
  const m = db.prepare('SELECT * FROM memories WHERE id=? AND couple_id=?').get(memoryId, coupleId);
  if (!m) return null;
  m.media = db.prepare('SELECT media_id FROM memory_media WHERE memory_id=?').all(memoryId)
    .map((r) => r.media_id);
  return m;
}

function timeline(coupleId) {
  const rows = db
    .prepare('SELECT * FROM memories WHERE couple_id=? ORDER BY happened_on DESC, created_at DESC')
    .all(coupleId);
  const media = db
    .prepare(
      `SELECT mm.memory_id, mm.media_id FROM memory_media mm
       JOIN memories m ON m.id = mm.memory_id WHERE m.couple_id=?`
    )
    .all(coupleId);
  return rows.map((r) => ({
    ...r,
    media: media.filter((x) => x.memory_id === r.id).map((x) => x.media_id),
  }));
}

function remove(coupleId, memoryId) {
  db.prepare('DELETE FROM memory_media WHERE memory_id=?').run(memoryId);
  const info = db.prepare('DELETE FROM memories WHERE id=? AND couple_id=?').run(memoryId, coupleId);
  return info.changes > 0;
}

module.exports = { create, get, timeline, remove };
