const express = require('express');
const db = require('../db');
const { requireAuth, requireCouple } = require('../middleware/auth');
const snickEngine = require('../engines/snick');
const verification = require('../engines/verification');
const stats = require('../engines/stats');
const notifications = require('../engines/notifications');

const r = express.Router();
r.use(requireAuth, requireCouple);

r.get('/daily-snicks', (req, res) => {
  res.json({ date: undefined, snicks: snickEngine.listDay(req.couple) });
});

r.get('/snicks/:id', (req, res) => {
  let s = snickEngine.getOne(req.couple.id, req.params.id);
  if (!s) return res.status(404).json({ error: 'not_found' });
  snickEngine.maybeUnlockMystery(req.couple.id, s.local_date, Date.now());
  s = snickEngine.getOne(req.couple.id, req.params.id);
  const state = snickEngine.resolveState(s);
  const hidden = s.is_mystery === 1 && state === 'LOCKED';
  const notEarnedYet = s.is_mystery === 1 && s.window_start === 0;
  const sub = db
    .prepare(
      `SELECT id,user_id,type,text,media_id,status,created_at FROM snick_submissions
       WHERE daily_snick_id=? ORDER BY created_at DESC LIMIT 1`
    )
    .get(s.id);
  res.json({
    id: s.id, slot: s.slot_index, state, isMystery: !!s.is_mystery,
    windowStart: s.window_start, windowEnd: s.window_end,
    locked: notEarnedYet,
    title: hidden ? 'Mystery Snick' : s.title,
    prompt: notEarnedYet
      ? 'Teenon Snicks poore karo, phir ye khulega.'
      : hidden
        ? 'Window khulte hi pata chalega.'
        : s.prompt,
    category: hidden ? null : s.category,
    verification: hidden ? null : s.verification,
    rarity: hidden ? null : s.rarity,
    xp: snickEngine.xpFor(s),
    submission: sub
      ? { ...sub, isMine: sub.user_id === req.user.id, canConfirm: sub.user_id !== req.user.id && sub.status === 'AWAITING_PARTNER' }
      : null,
  });
});

r.post('/snicks/:id/submit', (req, res) => {
  const snick = snickEngine.getOne(req.couple.id, req.params.id);
  if (!snick) return res.status(404).json({ error: 'not_found' });
  try {
    const out = verification.submit({
      couple: req.couple, user: req.user, snick,
      text: req.body?.text, mediaId: req.body?.mediaId,
    });
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, detail: e.detail });
  }
});

r.post('/submissions/:id/confirm', (req, res) => {
  try {
    res.json(verification.confirmByPartner(req.params.id, req.user));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.get('/stats', (req, res) => res.json(stats.forCouple(req.couple.id)));

r.get('/notifications', (req, res) =>
  res.json({ items: notifications.list(req.couple.id, req.user.id) })
);

// Engine 8, minimal: couples ranked by XP. Opt-in by design — a couple only
// appears here if they have completed at least one Snick.
r.get('/leaderboard', (req, res) => {
  const rows = db
    .prepare(
      `SELECT couple_id, total_xp, snicks_completed, current_streak FROM couple_stats
       WHERE snicks_completed > 0 ORDER BY total_xp DESC LIMIT 50`
    )
    .all();
  const me = rows.findIndex((x) => x.couple_id === req.couple.id);
  res.json({
    myRank: me >= 0 ? me + 1 : null,
    entries: rows.map((x, i) => ({
      rank: i + 1, isMe: x.couple_id === req.couple.id,
      xp: x.total_xp, completed: x.snicks_completed, streak: x.current_streak,
    })),
  });
});

module.exports = r;
