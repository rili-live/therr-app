#!/usr/bin/env bash
# memsearch-index.sh — rebuild the local vector index from all memory sources.
#
# Usage:
#   scripts/memsearch-index.sh              # index memory + external docs
#   scripts/memsearch-index.sh --fetch      # fetch external docs first, then index
#   scripts/memsearch-index.sh --force      # re-embed everything (ignore cache)
#
# Run this after `git pull` to incorporate new session logs and external docs.
# The index lives at ~/.memsearch/milvus.db (machine-local, gitignored).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FETCH=false
FORCE_FLAG=""

for arg in "$@"; do
  case $arg in
    --fetch) FETCH=true ;;
    --force) FORCE_FLAG="--force" ;;
  esac
done

echo "=== memsearch index ==="
echo "Repo: $REPO_ROOT"
cd "$REPO_ROOT"

# --- preflight: memsearch installed? ---
# Exit 0, not 1: this script is called from .husky/post-merge and may run on a
# machine (or in CI) that never set the memory system up. A missing optional
# tool is not a failure.
if ! command -v memsearch >/dev/null 2>&1; then
  echo ""
  echo "⚠  memsearch is not on PATH — skipping index."
  echo "   Install:  pipx install 'memsearch[onnx]'"
  echo "   See:      docs/MEMORY_SYSTEM_SETUP.md → Prerequisites"
  exit 0
fi

# --- embedding provider guard ---
# memsearch 0.4.12+ ignores embedding.provider in the project-local
# .memsearch.toml (restricted trust boundary), silently falling back to the
# OpenAI default. With no API key that is a traceback; with one it would ship
# this repo's private memory to a third party and write 1536-dim vectors into an
# index built at bge-m3's 1024, corrupting retrieval. Fail loudly instead.
PROVIDER="$(memsearch config get embedding.provider 2>/dev/null | tail -1 || true)"
if [[ "$PROVIDER" != "onnx" ]]; then
  echo ""
  echo "⛔ Embedding provider is '${PROVIDER:-unknown}', expected 'onnx'."
  echo "   Set it once for this machine:  memsearch config set embedding.provider onnx"
  echo "   See: docs/MEMORY_SYSTEM_SETUP.md → Per-machine setup"
  exit 1
fi

# --- a live `memsearch watch` already owns the store ---
# Milvus Lite is single-process exclusive: while `memsearch watch` holds the
# lock on ~/.memsearch/milvus.db, any other memsearch invocation dies with a
# DataDirLockedError traceback. The watcher is already indexing these same
# paths on change, so the correct move is to skip, not to fail.
WATCH_PID="$(pgrep -f 'memsearch watch' 2>/dev/null | head -1 || true)"
if [[ -n "$WATCH_PID" ]]; then
  echo ""
  echo "⚠  A 'memsearch watch' is running (pid $WATCH_PID) and holds the store lock."
  echo "   It auto-indexes these paths on change, so this run is redundant — skipping."
  echo "   To force a full rebuild instead: kill $WATCH_PID && scripts/memsearch-index.sh --force"
  exit 0
fi

# --- single-writer lock ---
# Milvus Lite is an embedded single-writer store. Now that indexing is also
# triggered automatically by post-merge, a background run and a manual run can
# overlap; two writers against ~/.memsearch/milvus.db corrupt or deadlock it.
# mkdir is atomic on every filesystem we care about, so it is the lock.
LOCK_DIR="${HOME}/.memsearch/.index.lock"
mkdir -p "$(dirname "$LOCK_DIR")"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  lock_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
    echo ""
    echo "⚠  Another index run is already in progress (pid $lock_pid) — skipping."
    exit 0
  fi
  echo "⚠  Clearing stale lock (pid ${lock_pid:-unknown} is gone)"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
fi
echo "$$" > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

# --- optional: fetch external docs first ---
if [[ "$FETCH" == "true" ]]; then
  if [[ ! -f "scripts/fetch-external-docs.py" ]]; then
    echo "⚠  --fetch requested but scripts/fetch-external-docs.py not found — skipping"
  else
    echo ""
    echo "Fetching external docs..."
    python3 scripts/fetch-external-docs.py
  fi
fi

# --- build index path list ---
PATHS=()

# Always index committed session memory
if [[ -d "context/memory" ]]; then
  PATHS+=("context/memory")
fi

# Index transcripts if present (gitignored, machine-local)
if [[ -d "context/transcripts" ]] && compgen -G "context/transcripts/*.md" > /dev/null 2>&1; then
  PATHS+=("context/transcripts")
fi

# Index external docs if any markdown files exist
if [[ -d "context/external" ]] && compgen -G "context/external/**/*.md" "context/external/*.md" > /dev/null 2>&1; then
  PATHS+=("context/external")
fi

if [[ ${#PATHS[@]} -eq 0 ]]; then
  echo "Nothing to index yet — add markdown files to context/memory/ or context/external/"
  exit 0
fi

echo ""
echo "Indexing:"
for p in "${PATHS[@]}"; do
  echo "  • $p"
done
echo ""

memsearch index $FORCE_FLAG "${PATHS[@]}"

echo ""
echo "✓ Index updated. Test with: memsearch search \"your query\""
