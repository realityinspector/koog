#!/bin/zsh
# Keep the latest Koog running on http://localhost:5173 (the dev server serves the working copy with live reload,
# so every saved change is live). Safe to run any time: it only starts what isn't running.
#   ./run.sh            make sure it's up (installs packages if they changed), then open it in Chrome
#   ./run.sh --watch    the same, then keep checking every 10 s and restart anything that died (Ctrl-C to stop)
#   ./run.sh --no-open  don't open Chrome
# Never touches port 3000 (another project).
cd "$(dirname "$0")" || exit 1
WATCH=0; OPEN=1
for a in "$@"; do case $a in --watch) WATCH=1 ;; --no-open) OPEN=0 ;; esac; done

up() { curl -s -o /dev/null -m 2 "$1"; }

deps() { # reinstall only when package.json or the lockfile is newer than the last install
  if [[ ! -d node_modules || package.json -nt node_modules/.package-lock.json || package-lock.json -nt node_modules/.package-lock.json ]]; then
    echo "Installing packages..."; npm install --no-audit --no-fund >/dev/null 2>&1 || echo "npm install failed; run it by hand"
  fi
}

ensure() {
  if ! lsof -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
    nohup npm run dev > .dev-server.log 2>&1 &
    echo "$(date +%H:%M:%S) started the app server (log: .dev-server.log)"
  fi
  if ! lsof -iTCP:5174 -sTCP:LISTEN >/dev/null 2>&1; then
    nohup node scripts/requests-server.mjs >> .requests-server.log 2>&1 &
    echo "$(date +%H:%M:%S) started the ideas inbox (log: .requests-server.log)"
  fi
}

deps
ensure
for i in {1..40}; do up http://localhost:5173/ && break; sleep 0.5; done
if up http://localhost:5173/; then echo "Koog is running: http://localhost:5173"; else echo "Koog did not start; see .dev-server.log"; tail -20 .dev-server.log; exit 1; fi
(( OPEN )) && open -a "Google Chrome" http://localhost:5173

if (( WATCH )); then
  echo "Watching (Ctrl-C to stop)..."
  while sleep 10; do deps; ensure; done
fi
