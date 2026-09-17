const db = require('../db');
const { id } = require('../utils/ids');
const { emit } = require('../events/bus');

// ---------------------------------------------------------------------------
// Engines 10 + 11.
//
// IMPORTANT: the server never decrypts anything here. It stores an opaque
// `ciphertext` string plus routing metadata (who, when, expiry). That part is
// real and correct. The encryption itself happens on the device — see
// app/src/crypto.ts, which currently ships a PLACEHOLDER, not real crypto.
// Read that file before you call this feature end-to-end encrypted anywhere.
// ---------------------------------------------------------------------------

function conversationFor(coupleId) {
  let c = db.prepare('SELECT * FROM conversations WHERE couple_id=?').get(coupleId);
  if (!c) {
    c = { id: id('cnv_'), couple_id: coupleId, created_at: Date.now() };
    db.prepare(`INSERT INTO conversations (id,couple_id,created_at) VALUES (?,?,?)`)
      .run(c.id, c.couple_id, c.created_at);
  }
  return c;
}

function send({ couple, user, ciphertext, nonce, kind = 'text', mediaId, emojiId, ttlSeconds }) {
  if (!ciphertext) { const e = new Error('ciphertext_required'); e.status = 400; throw e; }
  const conv = conversationFor(couple.id);
  const now = Date.now();
  // Disappearing messages: expiry is set once, at send time. There is no
  // manual unsend — the product rule is automatic lifecycle only.
  const expiresAt = ttlSeconds ? now + ttlSeconds * 1000 : null;
  const msgId = id('msg_');
  db.prepare(
    `INSERT INTO messages
       (id,conversation_id,couple_id,sender_id,ciphertext,nonce,kind,media_id,emoji_id,created_at,expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(msgId, conv.id, couple.id, user.id, ciphertext, nonce || null, kind,
        mediaId || null, emojiId || null, now, expiresAt);
  emit('MESSAGE_SENT', { coupleId: couple.id, userId: user.id, messageId: msgId, expiresAt });
  return { id: msgId, createdAt: now, expiresAt };
}

function list(couple, { since = 0, limit = 100 } = {}) {
  sweepExpired();
  return db
    .prepare(
      `SELECT id,sender_id,ciphertext,nonce,kind,media_id,emoji_id,created_at,expires_at,read_at
       FROM messages WHERE couple_id=? AND created_at > ?
       ORDER BY created_at ASC LIMIT ?`
    )
    .all(couple.id, since, limit);
}

function markRead(couple, userId) {
  const now = Date.now();
  db.prepare(
    `UPDATE messages SET read_at=? WHERE couple_id=? AND sender_id != ? AND read_at IS NULL`
  ).run(now, couple.id, userId);
  return { readAt: now };
}

// Expired messages are deleted, not flagged. Nothing is recoverable.
function sweepExpired() {
  const info = db
    .prepare(`DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < ?`)
    .run(Date.now());
  return info.changes;
}

module.exports = { conversationFor, send, list, markRead, sweepExpired };
