const db = require('../db');
const { id } = require('../utils/ids');
const { emit } = require('../events/bus');
const notifications = require('./notifications');

// Engine 14. Stores dates and feeds the reminder system.
function create({ couple, user, title, kind = 'date', eventDate, recursYearly, memoryId, remindDaysBefore = 1 }) {
  if (!title || !eventDate) { const e = new Error('title_and_date_required'); e.status = 400; throw e; }
  const evId = id('cal_');
  db.prepare(
    `INSERT INTO calendar_events
       (id,couple_id,created_by,title,kind,event_date,recurs_yearly,memory_id,remind_days_before,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(evId, couple.id, user.id, title.trim(), kind, eventDate,
        recursYearly ? 1 : 0, memoryId || null, remindDaysBefore, Date.now());
  emit('CALENDAR_EVENT_CREATED', { coupleId: couple.id, userId: user.id, eventId: evId });
  return db.prepare('SELECT * FROM calendar_events WHERE id=?').get(evId);
}

function list(coupleId) {
  return db
    .prepare('SELECT * FROM calendar_events WHERE couple_id=? ORDER BY event_date ASC')
    .all(coupleId)
    .map((e) => ({ ...e, nextOccurrence: nextOccurrence(e) }));
}

// A yearly event rolls forward; a one-off keeps its original date.
function nextOccurrence(ev, now = new Date()) {
  if (!ev.recurs_yearly) return ev.event_date;
  const [, mm, dd] = ev.event_date.split('-');
  const thisYear = `${now.getUTCFullYear()}-${mm}-${dd}`;
  return thisYear >= now.toISOString().slice(0, 10)
    ? thisYear
    : `${now.getUTCFullYear() + 1}-${mm}-${dd}`;
}

function remove(coupleId, eventId) {
  return db.prepare('DELETE FROM calendar_events WHERE id=? AND couple_id=?')
    .run(eventId, coupleId).changes > 0;
}

// Engine 15 feeds off this: one reminder per event per occurrence.
function sweepReminders() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare('SELECT * FROM calendar_events').all();
  let sent = 0;
  for (const ev of rows) {
    const occ = nextOccurrence(ev);
    const remindOn = new Date(Date.parse(occ + 'T00:00:00Z') - ev.remind_days_before * 86400000)
      .toISOString().slice(0, 10);
    if (today === remindOn && ev.last_reminded_for !== occ) {
      notifications.push(ev.couple_id, null, 'CALENDAR_REMINDER', {
        eventId: ev.id, title: ev.title, on: occ,
      });
      db.prepare('UPDATE calendar_events SET last_reminded_for=? WHERE id=?').run(occ, ev.id);
      emit('REMINDER_SENT', { coupleId: ev.couple_id, eventId: ev.id });
      sent++;
    }
  }
  return sent;
}

module.exports = { create, list, remove, sweepReminders, nextOccurrence };
