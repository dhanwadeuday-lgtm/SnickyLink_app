const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const admin = require('../engines/admin');
const moderation = require('../engines/moderation');
const analytics = require('../engines/analytics');

const r = express.Router();
r.use(requireAuth, (req, res, next) => {
  const row = db.prepare('SELECT role FROM users WHERE id=?').get(req.user.id);
  if (!row || row.role !== 'admin') return res.status(403).json({ error: 'admin_only' });
  next();
});
const wrap = (fn) => (req, res) => {
  try { fn(req, res); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
};

r.get('/overview', wrap((_req, res) => res.json(admin.overview())));
r.get('/analytics/funnel', wrap((req, res) =>
  res.json(analytics.funnel(Number(req.query.days || 30)))));
r.get('/analytics/retention', wrap((_req, res) => res.json(analytics.retention())));

r.get('/catalog', wrap((_req, res) => res.json({ items: admin.listCatalog() })));
r.post('/catalog', wrap((req, res) =>
  res.json(admin.addCatalogSnick({ adminId: req.user.id, ...req.body }))));
r.delete('/catalog/:id', wrap((req, res) =>
  res.json(admin.removeCatalogSnick(req.user.id, req.params.id))));

r.get('/reports', wrap((_req, res) => res.json({ items: moderation.queue() })));
r.post('/reports/:id/resolve', wrap((req, res) =>
  res.json(moderation.resolve({
    reportId: req.params.id, adminId: req.user.id, action: req.body?.action,
  }))));

r.post('/users/:id/suspend', wrap((req, res) =>
  res.json(admin.suspendUser(req.user.id, req.params.id, req.body?.reason))));

r.get('/flags', wrap((_req, res) => res.json(admin.flags())));
r.post('/flags', wrap((req, res) =>
  res.json(admin.setFlag(req.user.id, req.body?.key, req.body?.value))));

r.get('/actions', wrap((_req, res) => res.json({ items: admin.actions() })));

module.exports = r;
