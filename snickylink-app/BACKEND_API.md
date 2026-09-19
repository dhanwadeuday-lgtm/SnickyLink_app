# SnickyLink Backend API

Connect any frontend — React, Next.js, Flutter, native, plain `fetch`.

```
URL              https://fwaslanxcoyplpmpfcdn.supabase.co
Publishable key  sb_publishable_h3R7KLIseiONpWwQ6RTrkQ_r3rLD-_H
```

## How to call it

Everything is a Postgres function exposed at `POST /rest/v1/rpc/<name>`.
The client never reads or writes tables directly — Row Level Security blocks
that, and the RPCs are the only way in.

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fwaslanxcoyplpmpfcdn.supabase.co',
  'sb_publishable_h3R7KLIseiONpWwQ6RTrkQ_r3rLD-_H'
)

await supabase.auth.signInWithPassword({ email, password })
const { data, error } = await supabase.rpc('daily_snicks_list')
```

Raw HTTP equivalent:

```bash
curl -X POST https://fwaslanxcoyplpmpfcdn.supabase.co/rest/v1/rpc/daily_snicks_list \
  -H "apikey: sb_publishable_h3R7KLIseiONpWwQ6RTrkQ_r3rLD-_H" \
  -H "Authorization: Bearer <user_access_token>" \
  -H "Content-Type: application/json" -d '{}'
```

**Every RPC requires a signed-in user.** Anonymous callers have no execute
permission on any function, so an unauthenticated call returns a permission
error rather than data.

## Functions

### Identity & couple
| RPC | Params | Returns |
|---|---|---|
| `me` | — | `{ user: {id,name,email}, couple: {id,state} }` |
| `couple_status` | — | `{ state, coupleId, members[], partner, inviteCode }` |
| `couple_invite` | `p_tz_offset` (minutes, e.g. 330) | `{ code, coupleId, expiresInDays }` |
| `couple_join` | `p_code` | couple state |

### Snicks — 5 per day
4 scheduled Snicks with 2-hour windows (10:00, 13:00, 16:00, 19:00 local) plus
1 mystery Snick that unlocks once the other four are verified.

| RPC | Params | Returns |
|---|---|---|
| `daily_snicks_list` | — | `{ date, total: 5, snicks: [...] }` — also creates the day if needed |
| `snick_detail` | `p_snick_id` | one Snick plus its `submission` |
| `snick_submit` | `p_snick_id`, `p_text`, `p_media_id` | `{ submissionId, status }` |
| `snick_confirm` | `p_submission_id` | `{ status: 'VERIFIED' }` |

Snick states: `LOCKED` → `ACTIVE` → `SUBMITTED` → `VERIFIED`, or `EXPIRED`
once the window passes. Verification is `text`, `photo` or `partner`:
text and photo verify immediately, partner waits for the other person.

Submission objects carry `isMine` and `canConfirm` — use those flags rather
than comparing user ids yourself.

### Progress
| RPC | Returns |
|---|---|
| `stats_for_couple` | XP, level, streaks, completion rate, per-category counts |
| `leaderboard_list` | `{ myRank, entries: [{rank, xp, streak, completed, isMe}] }` |

### Chat (E2EE)
The server stores ciphertext and delivery metadata only. Encrypt client-side.

| RPC | Params |
|---|---|
| `key_put` | `p_public_key` |
| `key_get` | `p_user_id` |
| `chat_send` | `p_ciphertext`, `p_nonce`, `p_kind`, `p_media_id`, `p_emoji_id`, `p_ttl_seconds` |
| `chat_list` | `p_since` (sequence number) |
| `chat_mark_read` | — |

Messages with `p_ttl_seconds` are deleted by a cron job every 5 minutes.
There is no manual unsend — expiry is automatic, by design.

### Media
Private bucket, no public URLs.

1. Upload to `media` at path `<coupleId>/<filename>`. The storage policy
   rejects any other folder.
2. Call `media_register(p_path, p_mime)` → returns a media id.
3. Read back with `media_resolve(p_media_id)` or a signed URL.

### Memories, calendar, community
`memories_list`, `memory_create`, `memory_delete`,
`calendar_list`, `calendar_create`, `calendar_delete`,
`community_feed`, `community_ours`, `community_post_create`,
`community_post_delete`, `community_post_react`,
`report_create`, `block_create`, `block_delete`,
`notifications_list`, `notifications_mark_read`, `emojis_list`, `search_all`.

Community posts are `PRIVATE_COUPLE` or `COMMUNITY`; the backend enforces it.

### Admin
`admin_overview`, `admin_catalog_list/add/delete`, `admin_reports_list`,
`admin_report_resolve`, `admin_user_suspend`, `admin_flags_list`,
`admin_flag_set`, `admin_analytics_funnel`, `admin_analytics_retention`,
`admin_actions_list`.

Each one calls `assert_admin()` first, so they are safe to expose to signed-in
users — a non-admin gets `admin_only`. Grant admin with:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

## Realtime

`messages`, `notifications` and `daily_snicks` are published. Subscribe to
Postgres changes to drive live chat, partner alerts and Snick state updates
instead of polling.

## Error codes

`no_active_couple`, `already_paired`, `invalid_code`, `window_not_active`,
`media_required`, `text_required`, `cannot_confirm_own`, `not_found`,
`forbidden`, `admin_only`.

## Security notes

- Internal engine helpers (`snick_award_xp`, `snick_pass`, `emit`,
  `notify_push` and others) have **no execute permission** for `anon` or
  `authenticated`. They run only inside other functions. A client cannot mint
  XP or verify its own Snick.
- XP goes through an idempotency-keyed ledger, so retries never double-award.
- All couple data is isolated by `couple_id` through RLS.
- Enable leaked-password protection in the Supabase dashboard
  (Authentication → Policies) — it is still off.
