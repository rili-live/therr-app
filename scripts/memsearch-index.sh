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
