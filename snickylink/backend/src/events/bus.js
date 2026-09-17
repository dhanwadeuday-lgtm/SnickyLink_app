const EventEmitter = require('events');
const db = require('../db');
const { id } = require('../utils/ids');

const bus = new EventEmitter();

// Every domain event is persisted before listeners run. The log is the source
// of truth and engines stay decoupled (blueprint section 3).
function emit(type, payload = {}) {
  const evt = {
    id: id('evt_'),
    type,
    couple_id: payload.coupleId || null,
    user_id: payload.userId || null,
    payload: JSON.stringify(payload),
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO events (id,type,couple_id,user_id,payload,created_at)
     VALUES (@id,@type,@couple_id,@user_id,@payload,@created_at)`
  ).run(evt);
  bus.emit(type, { ...payload, eventId: evt.id });
  return evt.id;
}

module.exports = { bus, emit };
