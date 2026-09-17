// Everything stored is epoch-ms UTC. Local date comes from the couple's tz
// offset so "today" means the same day for both partners.
const localDate = (ts, tzOffsetMin) =>
  new Date(ts + tzOffsetMin * 60000).toISOString().slice(0, 10);

const localDayStart = (localDateStr, tzOffsetMin) =>
  Date.parse(localDateStr + 'T00:00:00Z') - tzOffsetMin * 60000;

// Three slots a day, each with a 2-hour completion window. The fourth Snick
// is the Mystery one and has no fixed hour — it unlocks only after all three
// are done, and its window starts at that moment.
const SLOT_HOURS = [10, 15, 20];
const WINDOW_MS = 2 * 60 * 60 * 1000;

module.exports = { localDate, localDayStart, SLOT_HOURS, WINDOW_MS };
