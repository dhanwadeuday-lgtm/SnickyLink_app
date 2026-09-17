const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { id } = require('../utils/ids');
const { requireAuth, requireCouple } = require('../middleware/auth');

const dir = path.join(__dirname, '..', '..', 'uploads');
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _f, cb) => cb(null, dir),
    filename: (_req, file, cb) => cb(null, id('m_') + path.extname(file.originalname || '.jpg')),
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^image\/(jpe?g|png|webp|heic)$/.test(file.mimetype)),
});

const r = express.Router();
r.use(requireAuth, requireCouple);

// Engine 12. Files never get a permanent public URL — reads go through this
// route and are checked against couple membership.
r.post('/media', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });
  const mediaId = id('med_');
  db.prepare(
    `INSERT INTO media (id,couple_id,user_id,path,mime,created_at) VALUES (?,?,?,?,?,?)`
  ).run(mediaId, req.couple.id, req.user.id, req.file.filename, req.file.mimetype, Date.now());
  res.json({ mediaId });
});

r.get('/media/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id);
  if (!m || m.couple_id !== req.couple.id) return res.status(404).end();
  const p = path.join(dir, m.path);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.type(m.mime).sendFile(p);
});

module.exports = r;
