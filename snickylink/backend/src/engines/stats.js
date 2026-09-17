const db = require('../db');
const { bus, emit } = require('../events/bus');
const { levelFor } = require('./xp');

// Engine 9. Aggregates are rebuilt from trusted events, never from the client.
bus.on('SNICK_VERIFIED', (e) => {
  db.prepare(
    `INSERT INTO couple_stats (couple_id,snicks_completed) VALUES (?,1)
     ON CONFLICT(couple_id) DO UPDATE SET snicks_completed = snicks_completed + 1`
  ).run(e.coupleId);

  db.prepare(
    `INSERT INTO category_progress (couple_id,category,completed) VALUES (?,?,1)
     ON CONFLICT(couple_id,category) DO UPDATE SET completed = completed + 1`
  ).run(e.coupleId, e.category);

  updateStreak(e.coupleId, e.localDate);
});

function updateStreak(coupleId, date) {
  const s = db.prepare('SELECT * FROM couple_stats WHERE couple_id=?').get(coupleId);
  if (!s) return;
  if (s.last_completed_date === date) return; // already counted today

  const yesterday = new Date(Date.parse(date + 'T00:00:00Z') - 86400000)
    .toISOString().slice(0, 10);
  const streak = s.last_completed_date === yesterday ? s.current_streak + 1 : 1;
  const longest = Math.max(streak, s.longest_streak);

  db.prepare(
    `UPDATE couple_stats SET current_streak=?, longest_streak=?, last_completed_date=?
     WHERE couple_id=?`
  ).run(streak, longest, date, coupleId);

  emit('STREAK_UPDATED', { coupleId, streak });
  // Milestone diamonds at the counts from the retention doc.
  const total = db.prepare('SELECT snicks_completed n FROM couple_stats WHERE couple_id=?').get(coupleId).n;
  if ([25, 50, 100, 250, 500, 1000].includes(total)) {
    emit('MILESTONE_REACHED', { coupleId, milestone: total });
  }
}

function forCouple(coupleId) {
  const s =
    db.prepare('SELECT * FROM couple_stats WHERE couple_id=?').get(coupleId) || {
      total_xp: 0, snicks_completed: 0, snicks_offered: 0, current_streak: 0, longest_streak: 0,
    };
  const cats = db
    .prepare('SELECT category, completed FROM category_progress WHERE couple_id=?')
    .all(coupleId);
  const rate = s.snicks_offered ? Math.round((s.snicks_completed / s.snicks_offered) * 100) : 0;
  return {
    totalXp: s.total_xp,
    level: levelFor(s.total_xp),
    snicksCompleted: s.snicks_completed,
    completionRate: rate,
    currentStreak: s.current_streak,
    longestStreak: s.longest_streak,
    categories: cats,
    milestones: [25, 50, 100, 250, 500, 1000].filter((m) => s.snicks_completed >= m),
  };
}

module.exports = { forCouple };
