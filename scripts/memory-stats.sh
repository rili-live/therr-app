#!/usr/bin/env bash
# memory-stats.sh — health dashboard for the Claude Code memory system.
#
# Usage: scripts/memory-stats.sh
#
# Shows memory utilization, session log cadence, external doc coverage,
# vector index size, and estimated token cost injected at each session start.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Colours (disabled when not a TTY)
if [[ -t 1 ]]; then
  BOLD="\033[1m"; RESET="\033[0m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; DIM="\033[2m"
else
  BOLD=""; RESET=""; GREEN=""; YELLOW=""; RED=""; DIM=""
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

chars_of() { wc -c < "$1" 2>/dev/null || echo 0; }
lines_of() { wc -l < "$1" 2>/dev/null || echo 0; }

bar() {
  local used=$1 cap=$2 width=20
  local filled=$(( used * width / (cap > 0 ? cap : 1) ))
  [[ $filled -gt $width ]] && filled=$width
  local empty=$(( width - filled ))
  local pct=$(( used * 100 / (cap > 0 ? cap : 1) ))
  local colour="$GREEN"
  [[ $pct -ge 70 ]] && colour="$YELLOW"
  [[ $pct -ge 90 ]] && colour="$RED"
  local bar_filled="" bar_empty=""
  [[ $filled -gt 0 ]] && bar_filled="$(printf '#%.0s' $(seq 1 $filled))"
  [[ $empty  -gt 0 ]] && bar_empty="$(printf  '.%.0s' $(seq 1 $empty))"
  printf "${colour}%s${RESET}%s  %d%%" "$bar_filled" "$bar_empty" "$pct"
}

# ---------------------------------------------------------------------------
# Section 1 — Working memory
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}=== Memory System Health ===${RESET}"
echo ""
echo -e "${BOLD}Working memory${RESET}"

MEMORY_FILE="context/MEMORY.md"
USER_FILE="context/USER.md"
MEMORY_CAP=2500
USER_CAP=1375

if [[ -f "$MEMORY_FILE" ]]; then
  MEMORY_CHARS=$(chars_of "$MEMORY_FILE")
  printf "  MEMORY.md   %5d / %d chars  " "$MEMORY_CHARS" "$MEMORY_CAP"
  bar "$MEMORY_CHARS" "$MEMORY_CAP"
  echo ""
else
  echo -e "  MEMORY.md   ${RED}missing${RESET} — run setup from docs/MEMORY_SYSTEM_SETUP.md"
fi

if [[ -f "$USER_FILE" ]]; then
  USER_CHARS=$(chars_of "$USER_FILE")
  printf "  USER.md     %5d / %d chars  " "$USER_CHARS" "$USER_CAP"
  bar "$USER_CHARS" "$USER_CAP"
  echo ""
else
  echo -e "  USER.md     ${RED}missing${RESET}"
fi

# ---------------------------------------------------------------------------
# Section 2 — Session logs
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}Session logs${RESET}"

LOG_DIR="context/memory"
if [[ -d "$LOG_DIR" ]]; then
  LOG_COUNT=$(find "$LOG_DIR" -name "*.md" | wc -l)
  if [[ $LOG_COUNT -gt 0 ]]; then
    OLDEST=$(find "$LOG_DIR" -name "*.md" | sort | head -1 | xargs basename .md 2>/dev/null || echo "unknown")
    NEWEST=$(find "$LOG_DIR" -name "*.md" | sort | tail -1 | xargs basename .md 2>/dev/null || echo "unknown")
    NEWEST_LINES=$(find "$LOG_DIR" -name "*.md" | sort | tail -1 | xargs lines_of)
    echo "  Daily logs: ${LOG_COUNT} file(s)  (${OLDEST} → ${NEWEST})"
    echo "  Last log:   ${NEWEST} — ${NEWEST_LINES} line(s)"
  else
    echo -e "  Daily logs: ${DIM}none yet — logs appear after first session${RESET}"
  fi
else
  echo -e "  ${RED}context/memory/ missing${RESET}"
fi

# ---------------------------------------------------------------------------
# Section 3 — Transcripts (machine-local)
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}Transcripts${RESET} ${DIM}(machine-local, gitignored)${RESET}"

TRANSCRIPT_DIR="context/transcripts"
if [[ -d "$TRANSCRIPT_DIR" ]]; then
  T_COUNT=$(find "$TRANSCRIPT_DIR" -name "*.md" | wc -l)
  if [[ $T_COUNT -gt 0 ]]; then
    T_LATEST=$(find "$TRANSCRIPT_DIR" -name "*.md" | sort | tail -1 | xargs basename .md 2>/dev/null || echo "unknown")
    T_TOTAL_KB=$(du -sk "$TRANSCRIPT_DIR" 2>/dev/null | awk '{print $1}' || echo 0)
    echo "  Captures:  ${T_COUNT} file(s), ${T_TOTAL_KB} KB total"
    echo "  Latest:    ${T_LATEST}"
  else
    echo -e "  ${DIM}None yet — transcripts appear after first session response${RESET}"
  fi
else
  echo -e "  ${DIM}Directory not created yet${RESET}"
fi

# ---------------------------------------------------------------------------
# Section 4 — External docs
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}External docs${RESET} ${DIM}(context/external/, git-tracked)${RESET}"

EXT_DIR="context/external"
if [[ -d "$EXT_DIR" ]]; then
  EXT_TOTAL=$(find "$EXT_DIR" -name "*.md" ! -name ".gitkeep" | wc -l)
  if [[ $EXT_TOTAL -gt 0 ]]; then
    for source_dir in "$EXT_DIR"/*/; do
      [[ -d "$source_dir" ]] || continue
      source_name=$(basename "$source_dir")
      count=$(find "$source_dir" -name "*.md" | wc -l)
      echo "  ${source_name}: ${count} file(s)"
    done
  else
    echo -e "  ${DIM}No external docs yet${RESET}"
    echo -e "  ${DIM}Run: scripts/memsearch-index.sh --fetch  (after configuring env vars)${RESET}"
    echo -e "  ${DIM}See: docs/MEMORY_SYSTEM_SETUP.md → External docs ingestion${RESET}"
  fi
else
  echo -e "  ${RED}context/external/ missing${RESET}"
fi

# ---------------------------------------------------------------------------
# Section 5 — Vector index
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}Vector index${RESET} ${DIM}(machine-local, .memsearch/)${RESET}"

STATS_OUTPUT=$(memsearch stats 2>/dev/null || echo "")
if echo "$STATS_OUTPUT" | grep -q "^Total indexed chunks:"; then
  CHUNK_COUNT=$(echo "$STATS_OUTPUT" | grep "^Total indexed chunks:" | awk '{print $NF}')
  echo "  Chunks indexed: ${CHUNK_COUNT}"
  # Show last-modified time of the milvus DB file if it exists
  DB_FILE=$(python3 -c "
import os, pathlib
p = pathlib.Path('~/.memsearch/milvus.db').expanduser()
if p.exists():
    import datetime
    mtime = datetime.datetime.fromtimestamp(p.stat().st_mtime)
    print(mtime.strftime('%Y-%m-%d %H:%M'))
" 2>/dev/null || echo "")
  [[ -n "$DB_FILE" ]] && echo "  Last indexed:   ${DB_FILE}"
else
  echo -e "  ${DIM}Not indexed yet — run: scripts/memsearch-index.sh${RESET}"
fi

# ---------------------------------------------------------------------------
# Section 6 — Estimated inject cost
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}Estimated inject cost per session${RESET}"

TOTAL_CHARS=0
BREAKDOWN=""

if [[ -f "$MEMORY_FILE" ]]; then
  C=$(chars_of "$MEMORY_FILE")
  TOTAL_CHARS=$(( TOTAL_CHARS + C ))
  BREAKDOWN+="  MEMORY.md:   ~$(( C / 4 )) tokens\n"
fi

if [[ -f "$USER_FILE" ]]; then
  C=$(chars_of "$USER_FILE")
  TOTAL_CHARS=$(( TOTAL_CHARS + C ))
  BREAKDOWN+="  USER.md:     ~$(( C / 4 )) tokens\n"
fi

TODAY=$(date +%Y-%m-%d)
TODAY_LOG="context/memory/${TODAY}.md"
if [[ -f "$TODAY_LOG" ]]; then
  C=$(chars_of "$TODAY_LOG")
  TOTAL_CHARS=$(( TOTAL_CHARS + C ))
  BREAKDOWN+="  Today's log: ~$(( C / 4 )) tokens\n"
fi

if [[ $TOTAL_CHARS -gt 0 ]]; then
  echo -e "$BREAKDOWN"
  echo "  ─────────────────────────────"
  printf "  Total inject: ~%d tokens  (chars ÷ 4, rough estimate)\n" "$(( TOTAL_CHARS / 4 ))"
  echo ""
  echo -e "  ${DIM}Budget: 3,000 tokens target. Claude's context window: 200k tokens.${RESET}"
  echo -e "  ${DIM}Memory overhead: ~$(( TOTAL_CHARS * 100 / 800000 ))% of available context.${RESET}"
else
  echo -e "  ${DIM}No memory files found — nothing injected yet${RESET}"
fi

echo ""
