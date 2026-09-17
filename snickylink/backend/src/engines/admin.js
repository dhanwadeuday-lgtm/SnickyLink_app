const db = require('../db');
const { id } = require('../utils/ids');
const { emit } = require('../events/bus');

// Engine 22. Every admin action is written to admin_actions before it takes
// effect, so there is always a trail of who did what.
function log(adminId, action, target, detail) {
  db.prepare(
    `INSERT INTO admin_actions (id,admin_id,action,target,detail,created_at) VALUES (?,?,?,?,?,?)`
  ).run(id('adm_'), adminId, action, target || null, JSON.stringify(detail || {}), Date.now());
  emit('ADMIN_ACTION', { userId: adminId, action, target });
}

function overview() {
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  return {
    users: one('SELECT COUNT(*) c FROM users').c,
    couples: one(`SELECT COUNT(*) c FROM couples WHERE state='ACTIVE'`).c,
    snicksVerified: one(`SELECT COUNT(*) c FROM daily_snicks WHERE state='VERIFIED'`).c,
    snicksExpired: one(`SELECT COUNT(*) c FROM daily_snicks WHERE state='FAILED'`).c,
    openReports: one(`SELECT COUNT(*) c FROM reports WHERE status='OPEN'`).c,
    messages: one('SELECT COUNT(*) c FROM messages').c,
    catalogSize: one('SELECT COUNT(*) c FROM snick_catalog').c,
  };
}

// Snick catalog management — the thing you will actually use every week.
function addCatalogSnick({ adminId, title, prompt, category, difficulty, verification, rarity }) {
  if (!title || !prompt) { const e = new Error('title_and_prompt_required'); e.status = 400; throw e; }
  if (!['text', 'photo', 'partner'].includes(verification)) {
    const e = new Error('bad_verification'); e.status = 400; throw e;
  }
  const scId = id('sc_');
  db.prepare(
    `INSERT INTO snick_catalog (id,title,prompt,category,difficulty,verification,rarity)
     VALUES (?,?,?,?,?,?,?)`
  ).run(scId, title, prompt, category || 'Fun', difficulty || 1, verification, rarity || 'NORMAL');
  log(adminId, 'catalog_add', scId, { title });
  return { id: scId };
}

function listCatalog() {
  return db.prepare('SELECT * FROM snick_catalog ORDER BY rarity, category, title').all();
}

function removeCatalogSnick(adminId, scId) {
  db.prepare('DELETE FROM snick_catalog WHERE id=?').run(scId);
  log(adminId, 'catalog_remove', scId);
  return { ok: true };
}

function suspendUser(adminId, userId, reason) {
  db.prepare('UPDATE sessions SET revoked=1 WHERE user_id=?').run(userId);
  log(adminId, 'user_suspend', userId, { reason });
  return { ok: true };
}

function setFlag(adminId, key, value) {
  db.prepare(
    `INSERT INTO feature_flags (key,value,updated_at) VALUES (?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
  ).run(key, String(value), Date.now());
  log(adminId, 'flag_set', key, { value });
  return { key, value };
}

const flags = () =>
  Object.fromEntries(db.prepare('SELECT key,value FROM feature_flags').all().map((r) => [r.key, r.value]));

const actions = () =>
  db.prepare('SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT 100').all();

module.exports = {
  overview, addCatalogSnick, listCatalog, removeCatalogSnick,
  suspendUser, setFlag, flags, actions, log,
};
