// Usage: node scripts-make-admin.js someone@example.com
const db = require('./src/db');
const email = (process.argv[2] || '').toLowerCase();
if (!email) { console.error('Usage: node scripts-make-admin.js <email>'); process.exit(1); }
const info = db.prepare('UPDATE users SET role=? WHERE email=?').run('admin', email);
console.log(info.changes ? `${email} is now an admin.` : `No user found for ${email}.`);
