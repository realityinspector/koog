#!/bin/zsh
# Koog locally. Never touches port 3000 (another project).
#   ./run.sh start              app on :5173 and ideas inbox on :5174
#   ./run.sh stop               stop both
#   ./run.sh start --monitor    start, then follow the logs (Ctrl-C only stops watching)
cd "$(dirname "$0")" || exit 1

APP_URL=http://localhost:5173
INBOX_URL=http://127.0.0.1:5174
APP_LOG=.dev-server.log
INBOX_LOG=.requests-server.log

usage() {
  cat <<'EOF'
Usage:
  ./run.sh start              start the app (:5173) and ideas inbox (:5174)
  ./run.sh stop               stop both (never touches port 3000)
  ./run.sh start --monitor    start, then follow the logs (Ctrl-C leaves the servers running)
EOF
}

listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

pids_on() {
  local p=$1
  print -r -- ${(f)"$(lsof -nP -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null)"}
}

deps() {
  if [[ ! -d node_modules || package.json -nt node_modules/.package-lock.json || package-lock.json -nt node_modules/.package-lock.json ]]; then
    echo "Installing packages..."
    npm install --no-audit --no-fund || { echo "npm install failed; run it by hand"; return 1 }
  fi
}

wait_listen() {
  local port=$1 i
  for i in {1..40}; do
    listening "$port" && return 0
    sleep 0.5
  done
  return 1
}

wait_http() {
  local i
  for i in {1..40}; do
    curl -sf -o /dev/null -m 2 "$APP_URL/" && return 0
    sleep 0.5
  done
  return 1
}

start_one() {
  local port=$1 name=$2 log=$3
  shift 3
  if listening "$port"; then
    echo "$name already running on :$port (pid $(pids_on "$port" | paste -sd, -))"
    return 0
  fi
  : >"$log"
  nohup "$@" >>"$log" 2>&1 &
  echo "started $name (log: $log)"
  if wait_listen "$port"; then
    echo "$name is up on :$port (pid $(pids_on "$port" | paste -sd, -))"
    return 0
  fi
  echo "$name did not start; see $log" >&2
  tail -20 "$log" >&2
  return 1
}

cmd_start() {
  deps || return 1
  start_one 5173 "app" "$APP_LOG" npm run dev || return 1
  start_one 5174 "ideas inbox" "$INBOX_LOG" node scripts/requests-server.mjs || return 1
  if wait_http; then
    echo "Koog is running: $APP_URL"
    return 0
  fi
  echo "Koog did not answer at $APP_URL; see $APP_LOG" >&2
  tail -20 "$APP_LOG" >&2
  return 1
}

cmd_stop() {
  local p line pids
  for p in 5173 5174; do
    pids=()
    while IFS= read -r line; do
      [[ -n $line ]] && pids+=("$line")
    done < <(lsof -nP -tiTCP:$p -sTCP:LISTEN 2>/dev/null)
    if (( ${#pids} )); then
      if kill -- $pids 2>/dev/null; then
        echo "stopped :$p (pid ${(j:,:)pids})"
      else
        echo "could not stop :$p (pid ${(j:,:)pids})" >&2
      fi
    else
      echo ":$p not running"
    fi
  done
}

cmd_monitor() {
  local tail_pid health_pid app_up inbox_up
  echo
  echo "app    $APP_URL          $(listening 5173 && echo "pid $(pids_on 5173 | paste -sd, -)" || echo down)"
  echo "inbox  $INBOX_URL        $(listening 5174 && echo "pid $(pids_on 5174 | paste -sd, -)" || echo down)"
  echo "logs   $APP_LOG  $INBOX_LOG"
  echo "Ctrl-C stops watching. The servers keep running. ./run.sh stop stops them."
  echo

  touch "$APP_LOG" "$INBOX_LOG"
  tail -n 25 -F "$APP_LOG" "$INBOX_LOG" &
  tail_pid=$!

  app_up=$(listening 5173 && echo 1 || echo 0)
  inbox_up=$(listening 5174 && echo 1 || echo 0)
  {
    while :; do
      sleep 2
      if listening 5173; then
        if [[ $app_up == 0 ]]; then
          echo "[monitor] app is back on :5173 (pid $(pids_on 5173 | paste -sd, -))"
          app_up=1
        fi
      elif [[ $app_up == 1 ]]; then
        echo "[monitor] app on :5173 is down — see $APP_LOG"
        app_up=0
      fi
      if listening 5174; then
        if [[ $inbox_up == 0 ]]; then
          echo "[monitor] ideas inbox is back on :5174 (pid $(pids_on 5174 | paste -sd, -))"
          inbox_up=1
        fi
      elif [[ $inbox_up == 1 ]]; then
        echo "[monitor] ideas inbox on :5174 is down — see $INBOX_LOG"
        inbox_up=0
      fi
    done
  } &
  health_pid=$!

  trap 'kill $tail_pid $health_pid 2>/dev/null; wait $tail_pid $health_pid 2>/dev/null
    echo
    echo "Stopped watching. Servers are still running."
    echo "  $APP_URL"
    echo "  ./run.sh stop"
    exit 0' INT TERM
  wait $tail_pid
}

main() {
  local cmd=${1:-} monitor=0 arg
  [[ -n $cmd ]] && shift
  case $cmd in
    start)
      for arg in "$@"; do
        case $arg in
          --monitor) monitor=1 ;;
          *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
        esac
      done
      cmd_start || exit 1
      if (( monitor )); then
        cmd_monitor
      fi
      ;;
    stop)
      if (( $# )); then
        echo "Unknown option: $1" >&2; usage >&2; exit 2
      fi
      cmd_stop
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
