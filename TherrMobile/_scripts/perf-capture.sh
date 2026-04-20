#!/usr/bin/env bash
# Capture a perf snapshot for app.therrmobile from the attached adb device.
# Intended to validate the "laggy after short use" hypothesis (content-slice
# bloat driving redux-persist write amplification).
#
# Workflow:
#   1. Launch the app (debug or release).
#   2. ./_scripts/perf-capture.sh snapshot       # baseline, fresh launch
#   3. ./_scripts/perf-capture.sh reset          # zero gfxinfo counters
#   4. Exercise the laggy flow (Map pan → Nearby → back, repeat ~2 min).
#   5. ./_scripts/perf-capture.sh snapshot       # post-use
#   6. diff the two summary.txt files.
#
# Hermes CPU profile: not automated here. Use Chrome at chrome://inspect
# while a debug build is running, open the Hermes target, and record a
# ~10s profile under Performance → Save → .cpuprofile.

set -euo pipefail
PKG=app.therrmobile
MODE=${1:-snapshot}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! adb get-state >/dev/null 2>&1; then
    echo "No adb device attached. Connect device or start the emulator first." >&2
    exit 1
fi

case "$MODE" in
    reset)
        adb shell dumpsys gfxinfo "$PKG" reset
        echo "gfxinfo reset. Exercise the app, then run: $0 snapshot"
        ;;
    snapshot)
        TS=$(date +%Y%m%dT%H%M%S)
        DIR=".perf/$TS"
        mkdir -p "$DIR"

        adb shell dumpsys gfxinfo "$PKG" framestats > "$DIR/gfxinfo.txt" 2>&1 || true
        adb shell dumpsys meminfo "$PKG"           > "$DIR/meminfo.txt" 2>&1 || true

        # AsyncStorage (RN community lib) uses SQLite at databases/RKStorage.
        # run-as only works on a debuggable build, so this is dev-only.
        adb shell "run-as $PKG sh -c '
            cd databases 2>/dev/null || exit 1
            echo === files ===
            ls -la RKStorage* 2>/dev/null
            echo === per-key sizes ===
            if command -v sqlite3 >/dev/null 2>&1; then
                sqlite3 RKStorage \"SELECT key, length(value) AS bytes FROM catalystLocalStorage ORDER BY bytes DESC LIMIT 20;\"
            else
                echo \"(sqlite3 not on device — top-key breakdown unavailable; file size only)\"
            fi
        '" > "$DIR/asyncstorage.txt" 2>&1 || echo "(run-as failed — release build or package missing)" > "$DIR/asyncstorage.txt"

        {
            echo "=== Summary ($TS) ==="
            grep -E '^[[:space:]]*TOTAL PSS|Native Heap|Dalvik Heap' "$DIR/meminfo.txt" | head -5 || true
            echo ""
            grep -E 'Total frames|Janky frames|percentile|Number Slow' "$DIR/gfxinfo.txt" | head -10 || true
            echo ""
            echo "=== AsyncStorage file ==="
            grep -E 'RKStorage' "$DIR/asyncstorage.txt" | head -5 || true
        } > "$DIR/summary.txt"

        cat "$DIR/summary.txt"
        echo ""
        echo "Full dumps in $DIR/"
        ;;
    *)
        echo "Usage: $0 {reset|snapshot}" >&2
        exit 2
        ;;
esac
