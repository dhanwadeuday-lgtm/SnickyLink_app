const db = require('../db');
const { id } = require('../utils/ids');

// Engine 19. Stable IDs so a message or reaction keeps meaning even if the
// artwork behind a sticker changes later.
const SEED = [
  ['core', 'snicky_heart', '💗'], ['core', 'snicky_spark', '✨'],
  ['core', 'snicky_fire', '🔥'], ['core', 'snicky_diamond', '💎'],
  ['core', 'snicky_laugh', '😂'], ['core', 'snicky_blush', '☺️'],
  ['core', 'snicky_wow', '😮'], ['core', 'snicky_hug', '🫂'],
];

function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) c FROM custom_emojis').get().c) return;
  const ins = db.prepare(
    `INSERT INTO custom_emojis (id,pack,name,glyph,media_id,active) VALUES (?,?,?,?,NULL,1)`
  );
  SEED.forEach((e) => ins.run(id('emj_'), e[0], e[1], e[2]));
}

const list = () =>
  db.prepare('SELECT id,pack,name,glyph,media_id FROM custom_emojis WHERE active=1 ORDER BY pack,name').all();

module.exports = { seedIfEmpty, list };
