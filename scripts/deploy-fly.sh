#!/bin/sh
# Build the web demo and deploy it (with the API and MCP server) to Fly.io.
# Only these go into the temp build context: dist-web, server/*.ts, three files from src/links, and the server's package files.
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
cp server/package.json server/package-lock.json "$ctx/"
flyctl deploy "$ctx" --config "$ctx/fly.toml" --ha=false "$@"
rm -rf "$ctx"
