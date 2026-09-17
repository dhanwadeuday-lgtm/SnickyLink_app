# SnickyLink

Backend (Node + Express + SQLite) aur Expo app, blueprint ke 22 engines ke
against build kiya hua.

## Daily loop

**3 Snicks** har din — 10am, 3pm, 8pm. Har ek ka 2-hour window.
**4th Snick Mystery hai** aur teenon complete hone ke baad hi unlock hota hai.
Uska window unlock ke moment se 2 ghante ka hota hai, yani reward turant milta
hai. Completion rate me Mystery tab hi count hota hai jab wo actually unlock ho.

## Engine status

| # | Engine | Status |
|---|---|---|
| 1 | Auth & Identity | Register, password login, OTP login, refresh, logout, sessions |
| 2 | Couple | 8-char invite, join, ACTIVE state, couple-scoped authorization |
| 3 | Snick | 3 daily + earned Mystery, windows, full state machine |
| 4 | Personalization | Weighted picker: recency + category balance + randomness (rule-based) |
| 5 | Verification | Text, photo, partner-confirm; server decides final status |
| 6 | AI | **Stub** — aapne bola filhaal rehne do. `runAiCheck()` random confidence deta hai |
| 7 | XP & Gamification | Idempotent ledger, levels, Legendary sub-tiers, Surprise Bonus |
| 8 | Leaderboard | Couple XP ranking |
| 9 | Stats | XP, completion rate, streak, category progress, milestones |
| 10 | Chat | Server ciphertext store karta hai, plaintext column hai hi nahi — **par cipher placeholder hai, neeche padho** |
| 11 | Disappearing messages | TTL per message, auto-delete sweep, manual unsend nahi |
| 12 | Media | Upload, couple-scoped read, koi public URL nahi |
| 13 | Memory | Manual keepsakes, media linking, timeline |
| 14 | Calendar | Anniversary/birthday/date/plan, yearly recurrence, reminder sweep |
| 15 | Notifications | In-app rows, loss-framed copy (FCM wiring baaki) |
| 16 | Community | PRIVATE_COUPLE / COMMUNITY visibility server pe enforce, reactions |
| 17 | Moderation | Reports, auto-hide at 3 reports, blocks, admin resolve queue |
| 18 | Search | Sirf do scope: public feed aur apna private data |
| 19 | Custom emoji | Stable IDs, seeded core pack |
| 20 | Analytics | Domain events se auto-mirror, funnel + retention |
| 21 | Audit & Event | Har domain event persist, engines usi pe subscribe |
| 22 | Admin | Overview, catalog CRUD, report queue, suspend, feature flags, action log |

## Do cheezein jo launch se pehle theek karni hain

### 1. Chat ka encryption abhi asli nahi hai

`app/src/crypto.ts` me jo hai wo **XOR + base64 hai, encryption nahi.**
Server ka hissa sahi bana hai — wahan sirf opaque blob jaata hai — par cipher
device pe hona chahiye aur React Native me AES built-in nahi aata.

Isliye:
- App ki UI me kahin bhi "end-to-end encrypted" mat likho jab tak ye replace na ho
- Replace karne ke liye `react-native-libsodium` (crypto_secretbox) ya
  `react-native-quick-crypto` (AES-256-GCM) use karo
- Seam jaan-boojh kar chhota rakha hai: sirf `encrypt()` aur `decrypt()`
  badalne hain, baaki koi file ko pata hi nahi chalega

Key exchange bhi pending hai. Abhi couple key `coupleId` se banti hai, jo server
ko bhi pata hai — matlab server chahe to decrypt kar sakta hai. Asli build me
X25519 handshake chahiye, ya kam se kam ek passphrase jo partners aapas me
bataayein, API se kabhi na jaaye.

### 2. AI verification pass-through hai

`backend/src/engines/verification.js` → `runAiCheck()` random confidence lautata
hai, yani **har photo pass ho jaati hai**. Job ka shape sahi hai (async →
result + confidence), bas andar real model call daalna hai jab ready ho.

## Chalane ka tareeka

### Backend
```bash
cd backend
cp .env.example .env          # JWT_SECRET badal lo
npm install
npm start
```
Apna LAN IP nikalo (`ipconfig` / `ifconfig`), phone usi Wi-Fi pe ho.

`better-sqlite3` native module hai — install fail ho to Node 20 LTS try karo.

### App
```bash
cd app
npm install
npx expo install --fix
npx expo start
```
App khulte hi **Server settings** me apna IP daalo, "Save & test" dabao.

### Do accounts
Account A → "Generate my code". Account B → wo code daalo → paired.
OTP login me code SMS nahi jaata, backend console me print hota hai.

### Admin banao
```bash
cd backend
node make-admin.js you@example.com
```
Uske baad `/admin/*` endpoints us account ke token se khulenge. Admin ka koi
app screen nahi hai — abhi API-only hai, Postman ya curl se use karo.

### APK
```bash
cd app
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```
`eas.json` me preview profile already APK output pe set hai.

Local build: `npx expo prebuild -p android && cd android && ./gradlew assembleRelease`

## Production checklist

1. `usesCleartextTraffic: true` hatao, backend HTTPS pe host karo
2. `JWT_SECRET` real random value
3. SQLite → Postgres (schema plain SQL hai, migration seedha)
4. OTP ko real SMS/email provider se jodo (`routes/auth.routes.js` ka `console.log`)
5. Chat crypto replace karo (upar wala point 1)
6. AI verification replace karo (upar wala point 2)
7. Rate limiting auth endpoints pe
8. Uploads local disk se S3 pe
9. Moderation ka word filter sirf pre-filter hai — human queue hi asli hai

## Snick catalog

`backend/src/engines/catalog.js` me 19 seed Snicks hain, sirf pehli baar insert
hote hain. Apne Snicks daalne ke do tareeke:
- Array extend karo aur `backend/data/snickylink.db` delete kar do, ya
- Admin API: `POST /admin/catalog`

`RARE` / `LEGENDARY` rarity wale sirf Mystery slot me aate hain.

## API

```
GET    /health
POST   /auth/register | /auth/login | /auth/otp/start | /auth/otp/verify
POST   /auth/refresh  | /auth/logout
GET    /me
GET    /couples/status
POST   /couples/invite | /couples/join

GET    /daily-snicks | /snicks/:id
POST   /snicks/:id/submit
POST   /submissions/:id/confirm
GET    /stats | /leaderboard | /notifications

GET    /messages?since= | POST /messages | POST /messages/read
GET    /memories  | POST /memories  | DELETE /memories/:id
GET    /calendar  | POST /calendar  | DELETE /calendar/:id
GET    /community/feed | /community/ours
POST   /community/posts | /community/posts/:id/react | DELETE /community/posts/:id
POST   /reports | /blocks | DELETE /blocks/:coupleId
GET    /search?q=&scope=all|private|community
GET    /emojis
POST   /media (multipart, field: file) | GET /media/:id

admin only:
GET    /admin/overview | /admin/analytics/funnel | /admin/analytics/retention
GET    /admin/catalog  | POST /admin/catalog | DELETE /admin/catalog/:id
GET    /admin/reports  | POST /admin/reports/:id/resolve
POST   /admin/users/:id/suspend
GET    /admin/flags    | POST /admin/flags
GET    /admin/actions
```
