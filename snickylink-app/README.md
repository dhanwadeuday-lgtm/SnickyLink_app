# SnickyLink — Flutter app

Daily Snicks for couples. Flutter client on a Supabase backend.

## Build the APK without installing anything

1. Create an empty GitHub repo and push this folder:

```bash
git init
git add .
git commit -m "SnickyLink app"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

2. GitHub Actions starts automatically. Open the **Actions** tab, wait for
   *Build APK* to finish, then download the `snickylink-release-apk`
   artifact from the run summary. Unzip it and install `app-release.apk`.

You can also trigger it by hand: Actions → Build APK → *Run workflow*.

### Building locally instead

```bash
flutter create --org com --project-name snickylink --platforms=android .
cp -r android_overlay/res/* android/app/src/main/res/
cp android_overlay/AndroidManifest.xml android/app/src/main/AndroidManifest.xml
flutter pub get
flutter build apk --release
```

### Why `android/` is not in the repo

The Android project is generated in CI by `flutter create`. That keeps the
Gradle wrapper binary out of git and means the build always matches whichever
Flutter version CI uses, instead of breaking on a version mismatch. The
SnickyLink icons and manifest live in `android_overlay/` and are copied over
the generated project.

### Signing

`flutter build apk --release` with no signing config falls back to debug keys.
That installs fine for testing but the Play Store will reject it. For a real
release, add your upload keystore and a `signingConfigs` block in
`android/app/build.gradle`. If this app ever replaces an existing Play Store
listing, you must reuse the original upload key, or the update is rejected.

## Backend

| | |
|---|---|
| Project | `SnickyLink` |
| URL | `https://fwaslanxcoyplpmpfcdn.supabase.co` |
| Publishable key | `sb_publishable_h3R7KLIseiONpWwQ6RTrkQ_r3rLD-_H` |
| Region | ap-south-1 · Postgres 17 |

Both values are compile-time constants with defaults in `lib/backend.dart`, so
you can point a build at a different project without editing code:

```bash
flutter build apk --release \
  --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
  --dart-define=SUPABASE_KEY=sb_publishable_xxxx
```

The publishable key is meant to ship inside clients. It grants nothing on its
own: every table has Row Level Security, and the whole API surface is RPCs that
check `auth.uid()`. See `BACKEND_API.md` to connect any other frontend.

## Project layout

```
lib/backend.dart            all RPC calls, storage upload, realtime, error text
lib/theme.dart              Wine & Peach palette, light + dark
lib/main.dart               auth gate → couple gate → app
lib/screens/                auth, pairing, daily Snicks, detail, stats,
                            leaderboard, profile
android_overlay/            launcher icons, notification icon, manifest
.github/workflows/          APK build
```

## What this build covers

Auth, couple pairing by invite code, the 5-a-day Snick loop (4 timed 2-hour
windows plus the mystery Snick), text / photo / partner verification, XP,
streaks, stats and the leaderboard. Photo Snicks upload to the private `media`
bucket under the couple's own folder.

Not wired into the UI yet, though the backend RPCs exist and are documented:
E2EE chat, memories, calendar, community feed and push notifications.

## Known issue with the launcher icon

The logo is a detailed illustration — moon texture, cross-hatching, water
reflection, thin railings. At 48×48 and 72×72 those collapse into a dark blob
and the two figures stop reading. It looks great at 512 px and up.

Keep this artwork for the splash, onboarding and store listing, and get a
simplified mark drawn for the launcher icon: bridge arc, two figures, moon
circle, heavier strokes, no texture.
