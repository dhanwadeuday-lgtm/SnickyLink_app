require('dotenv').config();
const express = require('express');
const cors = require('cors');

const db = require('./db');
require('./engines/xp');            // subscribes to SNICK_VERIFIED
require('./engines/stats');         // subscribes to SNICK_VERIFIED
require('./engines/notifications'); // subscribes to several events
require('./engines/analytics');     // mirrors domain events into the funnel
const { seedIfEmpty } = require('./engines/catalog');
const emoji = require('./engines/emoji');
const chat = require('./engines/chat');
const calendar = require('./engines/calendar');
const snickEngine = require('./engines/snick');
const { requireAuth } = require('./middleware/auth');

seedIfEmpty();
emoji.seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/auth', require('./routes/auth.routes'));
app.use('/couples', require('./routes/couple.routes'));
app.use('/admin', require('./routes/admin.routes'));
app.use('/', require('./routes/snick.routes'));
app.use('/', require('./routes/social.routes'));
app.use('/', require('./routes/media.routes'));

app.get('/me', requireAuth, (req, res) => {
  const couple = db
    .prepare(
      `SELECT c.id,c.state FROM couples c JOIN couple_members m ON m.couple_id=c.id
       WHERE m.user_id=?`
    )
    .get(req.user.id);
  res.json({ user: req.user, couple: couple || null });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'server_error' });
});

// Windows close on their own. One sweep a minute is plenty at this scale;
// move it to a real job queue when you outgrow a single process.
setInterval(() => {
  const n = snickEngine.expireStale();
  if (n) console.log(`[sweep] expired ${n} snick window(s)`);
  const m = chat.sweepExpired();
  if (m) console.log(`[sweep] deleted ${m} expired message(s)`);
}, 60000);

// Calendar reminders only need checking a few times a day.
setInterval(() => {
  const n = calendar.sweepReminders();
  if (n) console.log(`[sweep] sent ${n} calendar reminder(s)`);
}, 60 * 60 * 1000);
calendar.sweepReminders();

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nSnickyLink backend on http://0.0.0.0:${PORT}`);
  console.log(`Phone se connect karne ke liye apna LAN IP use karo, e.g. http://192.168.1.5:${PORT}\n`);
});
