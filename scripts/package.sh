#!/usr/bin/env bash
# Build the frontend and assemble a deploy/ directory that can be uploaded verbatim
# to the Cyon subdomain web root. Keep .env and storage/ OUTSIDE this directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building frontend"
(cd frontend && npm install && npm run build)   # emits to ./public (incl. .htaccess)

echo "==> Assembling deploy/"
rm -rf deploy
mkdir -p deploy
cp -a public/. deploy/            # index.html, assets/, .htaccess
cp -a api deploy/api             # PHP API at <docroot>/api
# .env and storage/ are intentionally NOT copied — provision them on the server.

echo "==> Done. Upload the contents of deploy/ to the vakaros.tying-the-knot.ch web root."
echo "    Then create <one-level-above-docroot>/.env and a writable storage/ directory,"
echo "    import api/db/migrations.sql, and run: php api/bin/create-user.php <email> <pw>"
