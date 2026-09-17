const db = require('../db');
const { id } = require('../utils/ids');
const { emit } = require('../events/bus');
const snickEngine = require('./snick');

// ---------------------------------------------------------------------------
// Engines 5 + 6. Three methods: text, photo (AI-assisted), partner confirm.
// The final PASS/FAIL decision always happens here on the server.
// ---------------------------------------------------------------------------

function submit({ couple, user, snick, type, text, mediaId }) {
  const now = Date.now();
  const state = snickEngine.resolveState(snick, now);
  if (state !== 'ACTIVE') {
    const err = new Error('window_not_active');
    err.status = 409;
    err.detail = state;
    throw err;
  }
  if (snick.verification === 'photo' && !mediaId) {
    const err = new Error('media_required'); err.status = 400; throw err;
  }
  if (snick.verification === 'text' && !(text && text.trim().length >= 3)) {
    const err = new Error('text_required'); err.status = 400; throw err;
  }

  const subId = id('sub_');
  const status = snick.verification === 'partner' ? 'AWAITING_PARTNER' : 'PENDING';

  db.prepare(
    `INSERT INTO snick_submissions
       (id,daily_snick_id,couple_id,user_id,type,text,media_id,status,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(subId, snick.id, couple.id, user.id, snick.verification, text || null, mediaId || null, status, now);

  db.prepare(`UPDATE daily_snicks SET state='SUBMITTED' WHERE id=?`).run(snick.id);
  emit('SNICK_SUBMITTED', { coupleId: couple.id, userId: user.id, snickId: snick.id, submissionId: subId });

  if (snick.verification === 'text') {
    pass(subId, 'text', 1.0, user.id);
  } else if (snick.verification === 'photo') {
    // AI photo check runs async. Stubbed here: swap runAiCheck() for a real
    // vision call and keep the same shape (result + confidence).
    setTimeout(() => runAiCheck(subId), 400);
  }
  // 'partner' waits for the other person to hit confirm.

  return { submissionId: subId, status };
}

function runAiCheck(submissionId) {
  const sub = db.prepare('SELECT * FROM snick_submissions WHERE id=?').get(submissionId);
  if (!sub || sub.status !== 'PENDING') return;
  // --- replace this block with a real model call ---
  const confidence = 0.8 + Math.random() * 0.2;
  const ok = confidence >= 0.6;
  // -------------------------------------------------
  emit('AI_VERIFICATION_COMPLETED', { coupleId: sub.couple_id, submissionId, confidence, ok });
  if (ok) pass(submissionId, 'photo_ai', confidence, null);
  else fail(submissionId, 'photo_ai', confidence);
}

function confirmByPartner(submissionId, confirmingUser) {
  const sub = db.prepare('SELECT * FROM snick_submissions WHERE id=?').get(submissionId);
  if (!sub) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (sub.user_id === confirmingUser.id) {
    const e = new Error('cannot_confirm_own'); e.status = 403; throw e;
  }
  const isMember = db
    .prepare('SELECT 1 FROM couple_members WHERE couple_id=? AND user_id=?')
    .get(sub.couple_id, confirmingUser.id);
  if (!isMember) { const e = new Error('forbidden'); e.status = 403; throw e; }
  if (sub.status === 'VERIFIED') return { status: 'VERIFIED' };

  emit('PARTNER_CONFIRMED', { coupleId: sub.couple_id, userId: confirmingUser.id, submissionId });
  pass(submissionId, 'partner', 1.0, confirmingUser.id);
  return { status: 'VERIFIED' };
}

function pass(submissionId, method, confidence, actorId) {
  const sub = db.prepare('SELECT * FROM snick_submissions WHERE id=?').get(submissionId);
  if (!sub || sub.status === 'VERIFIED') return;
  const now = Date.now();
  db.prepare(
    `INSERT INTO verification_events (id,submission_id,method,result,confidence,actor_user_id,created_at)
     VALUES (?,?,?,'PASS',?,?,?)`
  ).run(id('ver_'), submissionId, method, confidence, actorId, now);
  db.prepare(`UPDATE snick_submissions SET status='VERIFIED' WHERE id=?`).run(submissionId);
  db.prepare(`UPDATE daily_snicks SET state='VERIFIED' WHERE id=?`).run(sub.daily_snick_id);

  const row = db
    .prepare(
      `SELECT ds.*, sc.difficulty, sc.rarity, sc.category FROM daily_snicks ds
       JOIN snick_catalog sc ON sc.id=ds.catalog_id WHERE ds.id=?`
    )
    .get(sub.daily_snick_id);

  emit('SNICK_VERIFIED', {
    coupleId: sub.couple_id,
    userId: sub.user_id,
    snickId: sub.daily_snick_id,
    submissionId,
    xp: snickEngine.xpFor(row),
    category: row.category,
    rarity: row.rarity,
    localDate: row.local_date,
  });
}

function fail(submissionId, method, confidence) {
  const sub = db.prepare('SELECT * FROM snick_submissions WHERE id=?').get(submissionId);
  if (!sub) return;
  db.prepare(
    `INSERT INTO verification_events (id,submission_id,method,result,confidence,actor_user_id,created_at)
     VALUES (?,?,?,'FAIL',?,NULL,?)`
  ).run(id('ver_'), submissionId, method, confidence, Date.now());
  db.prepare(`UPDATE snick_submissions SET status='REJECTED' WHERE id=?`).run(submissionId);
  db.prepare(`UPDATE daily_snicks SET state='PENDING' WHERE id=?`).run(sub.daily_snick_id);
  emit('SNICK_VERIFICATION_FAILED', { coupleId: sub.couple_id, submissionId });
}

module.exports = { submit, confirmByPartner, runAiCheck };
