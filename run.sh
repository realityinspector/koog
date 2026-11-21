#!/bin/zsh
# Koog desktop. Never touches port 3000, or the web app on :5173 and :5174.
#   ./run.sh start              build the window if needed, then open Koog
#   ./run.sh stop               quit that Koog
#   ./run.sh start --monitor    start, then follow the log (Ctrl-C only stops watching)
cd "$(dirname "$0")" || exit 1

PIDFILE=.desktop.pid
LOG=.desktop.log
ELECTRON=node_modules/electron/dist/Electron.app/Contents/MacOS/Electron

usage() {
  cat <<'EOF'
Usage:
  ./run.sh start              open the Koog desktop app
  ./run.sh stop               quit the Koog desktop app
  ./run.sh start --monitor    start, then follow the log (Ctrl-C leaves Koog running)
EOF
}

deps() {
  if [[ ! -d node_modules || package.json -nt node_modules/.package-lock.json || package-lock.json -nt node_modules/.package-lock.json ]]; then
    echo "Installing packages..."
    npm install --no-audit --no-fund || { echo "npm install failed; run it by hand"; return 1 }
  fi
  if [[ ! -x $ELECTRON ]]; then
    echo "Fetching the Electron app..."
    node node_modules/electron/install.js || { echo "Electron did not install." >&2; return 1 }
  fi
  if [[ ! -x $ELECTRON ]]; then
    echo "Electron is missing from node_modules." >&2
    return 1
  fi
}

stale_dist() {
  [[ -f dist/index.html ]] || return 0
  local paths=(src desktop index.html vite.config.ts) newer
  [[ -d public ]] && paths+=(public)
  newer=$(find "${paths[@]}" -type f -newer dist/index.html -print -quit 2>/dev/null)
  [[ -n $newer ]]
}

desktop_pid() {
  [[ -f $PIDFILE ]] || return 1
  local pid
  pid=$(<"$PIDFILE")
  [[ $pid == <-> ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  print -r -- "$pid"
}

focus_desktop() {
  local pid=$1
  osascript -e "tell application \"System Events\" to set frontmost of (first process whose unix id is $pid) to true" >/dev/null 2>&1 || true
}

build_dist() {
  echo "Building the desktop window..."
  npx vite build || { echo "The desktop build failed." >&2; return 1 }
}

cmd_start() {
  local pid
  deps || return 1
  if pid=$(desktop_pid); then
    echo "Koog desktop already running (pid $pid)"
    focus_desktop "$pid"
    return 0
  fi
  rm -f "$PIDFILE"
  if stale_dist; then
    build_dist || return 1
  fi
  : >"$LOG"
  nohup "$ELECTRON" . >>"$LOG" 2>&1 &
  pid=$!
  print -r -- "$pid" >"$PIDFILE"
  local i
  for i in {1..24}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Koog desktop exited. See $LOG" >&2
      tail -30 "$LOG" >&2
      rm -f "$PIDFILE"
      return 1
    fi
    sleep 0.25
  done
  echo "Koog desktop is open (pid $pid, log: $LOG)"
  focus_desktop "$pid"
}

cmd_stop() {
  local pid i
  if ! pid=$(desktop_pid); then
    rm -f "$PIDFILE"
    echo "Koog desktop not running"
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  for i in {1..20}; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.25
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
  echo "stopped Koog desktop (pid $pid)"
}

cmd_monitor() {
  local tail_pid up pid
  pid=$(desktop_pid || true)
  echo
  echo "desktop  ${pid:+pid $pid}${pid:-down}"
  echo "log      $LOG"
  echo "Ctrl-C stops watching. Koog keeps running. ./run.sh stop quits it."
  echo
  touch "$LOG"
  tail -n 25 -F "$LOG" &
  tail_pid=$!
  up=$(desktop_pid >/dev/null && echo 1 || echo 0)
  {
    while :; do
      sleep 2
      if desktop_pid >/dev/null; then
        if [[ $up == 0 ]]; then
          echo "[monitor] Koog desktop is back (pid $(desktop_pid))"
          up=1
        fi
      elif [[ $up == 1 ]]; then
        echo "[monitor] Koog desktop is down — see $LOG"
        up=0
      fi
    done
  } &
  local health_pid=$!
  trap 'kill $tail_pid $health_pid 2>/dev/null; wait $tail_pid $health_pid 2>/dev/null
    echo
    echo "Stopped watching. Koog is still running."
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
