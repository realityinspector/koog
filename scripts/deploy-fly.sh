#!/bin/sh
# Build the web demo and deploy it to Fly.io. Only the built files are uploaded.
set -e
cd "$(dirname "$0")/.."
npm run build:web
ctx=$(mktemp -d)
cp deploy/Dockerfile deploy/nginx.conf deploy/fly.toml "$ctx/"
cp -R dist-web "$ctx/site"
flyctl deploy "$ctx" --config "$ctx/fly.toml" --ha=false "$@"
rm -rf "$ctx"
