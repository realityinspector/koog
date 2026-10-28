#!/bin/zsh
# Stops the dev server (5173) and request inbox (5174). Leaves port 3000 alone.
for p in 5173 5174; do
  pid=$(lsof -tiTCP:$p -sTCP:LISTEN)
  [ -n "$pid" ] && kill $pid && echo "stopped :$p (pid $pid)" || echo ":$p not running"
done
