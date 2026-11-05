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
(cd "$ctx" && ln -s "$OLDPWD/node_modules" node_modules && node -e "import('./server/core.ts').then(()=>console.log('server context ok'))" ) || { echo "server context is missing a file; not deploying"; rm -rf "$ctx"; exit 1; }
rm -f "$ctx/node_modules"
cp server/package.json server/package-lock.json "$ctx/"
flyctl deploy "$ctx" --config "$ctx/fly.toml" --ha=false "$@"
rm -rf "$ctx"
