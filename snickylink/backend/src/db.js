const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });

const db = new Database(path.join(dir, 'snickylink.db'));
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Additive migrations for databases created before a column existed.
const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

module.exports = db;
