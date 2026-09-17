const crypto = require('crypto');
const id = (p = '') => p + crypto.randomBytes(12).toString('hex');
const numericCode = (n = 6) =>
  Array.from({ length: n }, () => crypto.randomInt(0, 10)).join('');
const inviteCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 confusion
  return Array.from({ length: 8 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
};
module.exports = { id, numericCode, inviteCode };
