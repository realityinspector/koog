#!/bin/zsh
# One-command restart: starts the dev server (5173) and request inbox (5174) if they
# aren't already running, runs pre-flight, then opens the app in Chrome.
cd "$(dirname "$0")/.."
if ! lsof -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup npm run dev > .dev-server.log 2>&1 &
  echo "started dev server (log: .dev-server.log)"
else echo "dev server already running on :5173"; fi
if ! lsof -iTCP:5174 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup node scripts/requests-server.mjs > .requests-server.log 2>&1 &
  echo "started request inbox (log: .requests-server.log)"
else echo "request inbox already running on :5174"; fi
for i in {1..20}; do curl -s -o /dev/null http://localhost:5173 && break; sleep 0.5; done
npm run -s preflight
open -a "Google Chrome" http://localhost:5173
