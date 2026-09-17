const express = require('express');
const db = require('../db');
const { requireAuth, requireCouple } = require('../middleware/auth');
const chat = require('../engines/chat');
const memory = require('../engines/memory');
const calendar = require('../engines/calendar');
const community = require('../engines/community');
const moderation = require('../engines/moderation');
const search = require('../engines/search');
const emoji = require('../engines/emoji');

const r = express.Router();
r.use(requireAuth, requireCouple);
const wrap = (fn) => (req, res) => {
  try { fn(req, res); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
};

// --- chat (engines 10, 11) ---
r.get('/messages', wrap((req, res) =>
  res.json({ items: chat.list(req.couple, { since: Number(req.query.since || 0) }) })));

r.post('/messages', wrap((req, res) =>
  res.json(chat.send({ couple: req.couple, user: req.user, ...req.body }))));

r.post('/messages/read', wrap((req, res) => res.json(chat.markRead(req.couple, req.user.id))));

// --- memories (engine 13) ---
r.get('/memories', wrap((req, res) => res.json({ items: memory.timeline(req.couple.id) })));
r.post('/memories', wrap((req, res) =>
  res.json(memory.create({ couple: req.couple, user: req.user, ...req.body }))));
r.delete('/memories/:id', wrap((req, res) =>
  res.json({ deleted: memory.remove(req.couple.id, req.params.id) })));

// --- calendar (engine 14) ---
r.get('/calendar', wrap((req, res) => res.json({ items: calendar.list(req.couple.id) })));
r.post('/calendar', wrap((req, res) =>
  res.json(calendar.create({ couple: req.couple, user: req.user, ...req.body }))));
r.delete('/calendar/:id', wrap((req, res) =>
  res.json({ deleted: calendar.remove(req.couple.id, req.params.id) })));

// --- community (engine 16) ---
r.get('/community/feed', wrap((req, res) => res.json({ items: community.feed(req.couple.id) })));
r.get('/community/ours', wrap((req, res) => res.json({ items: community.ourWall(req.couple.id) })));
r.post('/community/posts', wrap((req, res) => {
  const screened = moderation.screen(req.body?.body);
  const post = community.createPost({ couple: req.couple, user: req.user, ...req.body });
  if (screened.flagged && req.body.visibility === 'COMMUNITY') {
    // Flagged, not blocked: it goes live but lands in the review queue.
    moderation.report({
      user: { id: req.user.id }, targetType: 'post', targetId: post.id, reason: 'auto_filter',
    });
  }
  res.json(post);
}));
r.post('/community/posts/:id/react', wrap((req, res) =>
  res.json(community.react({
    postId: req.params.id, user: req.user, coupleId: req.couple.id, emoji: req.body?.emoji,
  }))));
r.delete('/community/posts/:id', wrap((req, res) =>
  res.json({ removed: community.removeOwn(req.params.id, req.couple.id) })));

// --- moderation (engine 17) ---
r.post('/reports', wrap((req, res) =>
  res.json(moderation.report({ user: req.user, ...req.body }))));
r.post('/blocks', wrap((req, res) =>
  res.json(moderation.block(req.couple.id, req.body?.coupleId))));
r.delete('/blocks/:coupleId', wrap((req, res) =>
  res.json(moderation.unblock(req.couple.id, req.params.coupleId))));

// --- search (engine 18) ---
r.get('/search', wrap((req, res) =>
  res.json(search.search({ coupleId: req.couple.id, q: req.query.q, scope: req.query.scope }))));

// --- emoji (engine 19) ---
r.get('/emojis', wrap((_req, res) => res.json({ items: emoji.list() })));

module.exports = r;
