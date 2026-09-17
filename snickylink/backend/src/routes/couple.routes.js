const express = require('express');
const db = require('../db');
const { id, inviteCode } = require('../utils/ids');
const { requireAuth } = require('../middleware/auth');
const { emit } = require('../events/bus');

const r = express.Router();
r.use(requireAuth);

function myCouple(userId) {
  return db
    .prepare(
      `SELECT c.* FROM couples c JOIN couple_members m ON m.couple_id=c.id
       WHERE m.user_id=?`
    )
    .get(userId);
}

r.get('/status', (req, res) => {
  const c = myCouple(req.user.id);
  if (!c) return res.json({ state: 'NONE' });
  const members = db
    .prepare(
      `SELECT u.id,u.name,u.email FROM couple_members m JOIN users u ON u.id=m.user_id
       WHERE m.couple_id=?`
    )
    .all(c.id);
  const invite = db
    .prepare(`SELECT code FROM couple_invites WHERE couple_id=? AND used=0 AND expires_at > ?`)
    .get(c.id, Date.now());
  return res.json({
    state: c.state,
    coupleId: c.id,
    members,
    partner: members.find((m) => m.id !== req.user.id) || null,
    inviteCode: invite ? invite.code : null,
  });
});

r.post('/invite', (req, res) => {
  let c = myCouple(req.user.id);
  if (c && c.state === 'ACTIVE') return res.status(409).json({ error: 'already_paired' });

  if (!c) {
    c = { id: id('cpl_'), state: 'PENDING', tz_offset: Number(req.body?.tzOffset ?? 330) };
    db.prepare(`INSERT INTO couples (id,state,tz_offset,created_at) VALUES (?,?,?,?)`)
      .run(c.id, 'PENDING', c.tz_offset, Date.now());
    db.prepare(`INSERT INTO couple_members (couple_id,user_id,joined_at) VALUES (?,?,?)`)
      .run(c.id, req.user.id, Date.now());
  }
  const code = inviteCode();
  db.prepare(
    `INSERT INTO couple_invites (code,couple_id,created_by,expires_at) VALUES (?,?,?,?)`
  ).run(code, c.id, req.user.id, Date.now() + 7 * 86400000);
  emit('COUPLE_INVITE_CREATED', { coupleId: c.id, userId: req.user.id });
  res.json({ code, coupleId: c.id, expiresInDays: 7 });
});

r.post('/join', (req, res) => {
  const code = (req.body?.code || '').toUpperCase().trim();
  if (myCouple(req.user.id)) return res.status(409).json({ error: 'already_in_couple' });

  const inv = db
    .prepare(`SELECT * FROM couple_invites WHERE code=? AND used=0 AND expires_at > ?`)
    .get(code, Date.now());
  if (!inv) return res.status(404).json({ error: 'invalid_code' });
  if (inv.created_by === req.user.id) return res.status(400).json({ error: 'own_code' });

  const n = db
    .prepare('SELECT COUNT(*) c FROM couple_members WHERE couple_id=?')
    .get(inv.couple_id).c;
  if (n >= 2) return res.status(409).json({ error: 'couple_full' });

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO couple_members (couple_id,user_id,joined_at) VALUES (?,?,?)`)
      .run(inv.couple_id, req.user.id, Date.now());
    db.prepare(`UPDATE couples SET state='ACTIVE' WHERE id=?`).run(inv.couple_id);
    db.prepare(`UPDATE couple_invites SET used=1 WHERE code=?`).run(code);
    db.prepare(`INSERT OR IGNORE INTO couple_stats (couple_id) VALUES (?)`).run(inv.couple_id);
  });
  tx();
  emit('COUPLE_CREATED', { coupleId: inv.couple_id, userId: req.user.id });
  res.json({ state: 'ACTIVE', coupleId: inv.couple_id });
});

module.exports = r;
