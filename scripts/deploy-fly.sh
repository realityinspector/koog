#!/bin/sh
# Build the web demo and deploy it (with the API and MCP server) to Fly.io.
# Only these go into the temp build context: dist-web, server/*.ts, three files from src/links, the instrument id aliases, and the server's package files.
# Nothing else from the repo (no private/, requests.json or backups) is uploaded.
set -e
cd "$(dirname "$0")/.."
npm run check:catalog
npm run build:web
ctx=$(mktemp -d)
cp deploy/Dockerfile deploy/nginx.conf deploy/entrypoint.sh deploy/fly.toml "$ctx/"
cp -R dist-web "$ctx/site"
mkdir -p "$ctx/server" "$ctx/src/links"
cp server/*.ts "$ctx/server/"
cp src/links/links.ts src/links/catalog.ts src/links/catalog.data.json "$ctx/src/links/"
# links.ts also imports the instrument id aliases (old ids keep working); the server needs that file too
mkdir -p "$ctx/src/features/synth-history/emu"
cp src/features/synth-history/emu/aliases.ts "$ctx/src/features/synth-history/emu/"
# fail before deploying if the server can't load in the copied context (catches a missing import like this one)
# check exactly what the Dockerfile copies (not the whole build context), so a missing COPY line also fails here
chk=$(mktemp -d); mkdir -p "$chk"
grep -E '^COPY (server|src)/' "$ctx/Dockerfile" | while read -r _ from to; do mkdir -p "$chk/$(dirname "$to")"; cp -R "$ctx/$from" "$chk/$to"; done
(cd "$chk" && ln -s "$OLDPWD/node_modules" node_modules && node -e "import('./server/core.ts').then(()=>console.log('server context ok'))" ) || { echo "the server image would be missing a file; not deploying"; rm -rf "$ctx" "$chk"; exit 1; }
rm -rf "$chk"
cp server/package.json server/package-lock.json "$ctx/"
flyctl deploy "$ctx" --config "$ctx/fly.toml" --ha=false "$@"
rm -rf "$ctx"
