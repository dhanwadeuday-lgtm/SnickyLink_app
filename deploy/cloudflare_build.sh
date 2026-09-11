#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${API_BASE_URL:=https://api.snickylink.app}"

install_flutter() {
  if command -v flutter >/dev/null 2>&1; then
    return
  fi
  echo "Flutter SDK not found; installing stable Flutter SDK for this build..."
  mkdir -p "$ROOT/.tooling"
  if [ ! -x "$ROOT/.tooling/flutter/bin/flutter" ]; then
    curl -fsSL https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json \
      -o "$ROOT/.tooling/releases_linux.json"
    FLUTTER_URL=$(python3 - <<'PY'
import json, os
p=os.path.join(os.getcwd(), '.tooling', 'releases_linux.json')
data=json.load(open(p))
base='https://storage.googleapis.com/flutter_infra_release/releases/'
stable=data['current_release']['stable']
for r in data['releases']:
    if r['hash'] == stable:
        print(base + r['archive'])
        break
else:
    raise SystemExit('Could not locate Flutter stable archive')
PY
)
    curl -fL "$FLUTTER_URL" -o "$ROOT/.tooling/flutter.tar.xz"
    tar -xJf "$ROOT/.tooling/flutter.tar.xz" -C "$ROOT/.tooling"
    rm -f "$ROOT/.tooling/flutter.tar.xz"
  fi
  export PATH="$ROOT/.tooling/flutter/bin:$PATH"
}

install_flutter
flutter --version
flutter config --enable-web

cd "$ROOT/frontend"
# Generate the native/web Flutter scaffolding if this source package does not
# already contain it. This preserves the existing Dart code and assets.
if [ ! -f web/index.html ]; then
  flutter create --platforms=web .
fi

flutter pub get
flutter analyze --no-fatal-infos || true
flutter build web --release --dart-define="API_BASE_URL=${API_BASE_URL}"

# Cloudflare Pages/Workers should serve index.html for client-side routes.
cat > build/web/_redirects <<'REDIRECTS'
/* /index.html 200
REDIRECTS

echo "Cloudflare web build ready: $ROOT/frontend/build/web"
