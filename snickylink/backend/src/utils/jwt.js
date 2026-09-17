const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const signAccess = (userId) =>
  jwt.sign({ sub: userId }, SECRET, { expiresIn: process.env.ACCESS_TTL || '15m' });
const verifyAccess = (token) => jwt.verify(token, SECRET);
module.exports = { signAccess, verifyAccess };
