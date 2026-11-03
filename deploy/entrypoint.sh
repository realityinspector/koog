#!/bin/sh
# Start Node (API + MCP, as the unprivileged "node" user) and nginx (static files + proxy).
# If either one dies, stop the other and exit, so Fly restarts the whole machine.
su-exec node node /app/server/index.ts &
NODE_PID=$!
# wait (up to ~10 s) until Node answers, so the first request after a cold start doesn't get a 502
i=0; until wget -q -O /dev/null http://127.0.0.1:8787/healthz 2>/dev/null || [ $i -ge 50 ]; do sleep 0.2; i=$((i+1)); done
nginx -g 'daemon off;' &
NGINX_PID=$!

stop() { kill "$NODE_PID" "$NGINX_PID" 2>/dev/null; }
trap 'stop; exit 0' TERM INT

while kill -0 "$NODE_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do sleep 1; done
echo "a process exited; shutting down" >&2
stop
exit 1
