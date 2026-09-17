const db = require('../db');
const { verifyAccess } = require('../utils/jwt');

// Engine 1: nothing behind this line runs before we know who the user is.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const { sub } = verifyAccess(token);
    const user = db.prepare('SELECT id,email,name FROM users WHERE id=?').get(sub);
    if (!user) return res.status(401).json({ error: 'unknown_user' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Engine 2: private relationship data is always scoped by couple_id.
function requireCouple(req, res, next) {
  const row = db
    .prepare(
      `SELECT c.* FROM couples c
       JOIN couple_members m ON m.couple_id = c.id
       WHERE m.user_id = ? AND c.state = 'ACTIVE'`
    )
    .get(req.user.id);
  if (!row) return res.status(409).json({ error: 'no_active_couple' });
  req.couple = row;
  next();
}

module.exports = { requireAuth, requireCouple };
