const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { id, numericCode } = require('../utils/ids');
const { signAccess } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const { emit } = require('../events/bus');

const r = express.Router();
const REFRESH_MS = 30 * 86400000;

function issue(user) {
  const refresh = id('rt_');
  db.prepare(
    `INSERT INTO sessions (id,user_id,refresh_token,expires_at) VALUES (?,?,?,?)`
  ).run(id('ses_'), user.id, refresh, Date.now() + REFRESH_MS);
  return { accessToken: signAccess(user.id), refreshToken: refresh, user };
}

r.post('/register', (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password || password.length < 8)
    return res.status(400).json({ error: 'invalid_input' });
  const exists = db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'email_taken' });

  const user = { id: id('usr_'), email: email.toLowerCase(), name };
  db.prepare(
    `INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)`
  ).run(user.id, user.email, name, bcrypt.hashSync(password, 10), Date.now());
  emit('USER_REGISTERED', { userId: user.id });
  res.json(issue(user));
});

r.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase());
  if (!row || !row.password_hash || !bcrypt.compareSync(password || '', row.password_hash))
    return res.status(401).json({ error: 'bad_credentials' });
  res.json(issue({ id: row.id, email: row.email, name: row.name }));
});

// Passwordless path. In dev the code is printed to the server console;
// swap the console.log for your SMS/email provider and nothing else changes.
r.post('/otp/start', (req, res) => {
  const email = (req.body?.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'email_required' });
  const code = numericCode(6);
  db.prepare(
    `INSERT INTO otp_codes (id,email,code,expires_at) VALUES (?,?,?,?)`
  ).run(id('otp_'), email, code, Date.now() + 10 * 60000);
  console.log(`\n  [OTP] ${email} -> ${code}\n`);
  res.json({ sent: true, devHint: process.env.OTP_DEV ? code : undefined });
});

r.post('/otp/verify', (req, res) => {
  const email = (req.body?.email || '').toLowerCase();
  const { code, name } = req.body || {};
  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email=? AND code=? AND used=0 AND expires_at > ?
       ORDER BY expires_at DESC LIMIT 1`
    )
    .get(email, code, Date.now());
  if (!row) return res.status(401).json({ error: 'bad_code' });
  db.prepare('UPDATE otp_codes SET used=1 WHERE id=?').run(row.id);

  let user = db.prepare('SELECT id,email,name FROM users WHERE email=?').get(email);
  if (!user) {
    user = { id: id('usr_'), email, name: name || email.split('@')[0] };
    db.prepare(
      `INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,NULL,?)`
    ).run(user.id, user.email, user.name, Date.now());
    emit('USER_REGISTERED', { userId: user.id });
  }
  res.json(issue(user));
});

r.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {};
  const ses = db
    .prepare('SELECT * FROM sessions WHERE refresh_token=? AND revoked=0 AND expires_at > ?')
    .get(refreshToken, Date.now());
  if (!ses) return res.status(401).json({ error: 'invalid_refresh' });
  const user = db.prepare('SELECT id,email,name FROM users WHERE id=?').get(ses.user_id);
  res.json({ accessToken: signAccess(user.id), user });
});

r.post('/logout', requireAuth, (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken)
    db.prepare('UPDATE sessions SET revoked=1 WHERE refresh_token=?').run(refreshToken);
  res.json({ ok: true });
});

module.exports = r;
