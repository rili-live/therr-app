#!/usr/bin/env bash
# Mobile tsc baseline check.
#
# Why this exists: TherrMobile inherits ~107 pre-existing TypeScript errors from the
# RN 0.83 upgrade (see ~/.claude memory: rn-0.83-upgrade.md). Until those are paid down,
# `tsc --noEmit` cannot be a hard gate; CI would always fail. But ignoring tsc entirely
# means new errors slip in unnoticed.
#
# This script splits the difference: it fails ONLY when the error count grows past the
# committed baseline. Anyone fixing one of the existing errors is expected to lower the
# baseline by the same amount in the same commit.
#
# Usage:
#   ./_bin/check-mobile-tsc-baseline.sh         # CI mode: exit non-zero on regression
#   ./_bin/check-mobile-tsc-baseline.sh --update  # Lower the baseline after fixing errors
#
# Baseline is stored at TherrMobile/.tsc-baseline (single integer).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_FILE="$REPO_ROOT/TherrMobile/.tsc-baseline"

if [[ ! -f "$BASELINE_FILE" ]]; then
    echo "Missing baseline file: $BASELINE_FILE" >&2
    echo "Create it with: ./_bin/check-mobile-tsc-baseline.sh --update" >&2
    exit 2
fi

baseline="$(cat "$BASELINE_FILE")"

# Run tsc and count errors. tsc emits "Found N errors in M files." or "Found N error in M files."
# at the end on stdout (not stderr). Parse that line so we don't depend on grep'ing every error
# line (which can vary by formatting).
tsc_output="$(cd "$REPO_ROOT" && npx tsc --noEmit -p TherrMobile/tsconfig.json 2>&1 || true)"

# Extract error count. Handles both "1 error" and "N errors" forms.
current="$(echo "$tsc_output" | grep -Eo 'Found [0-9]+ errors? in' | grep -Eo '[0-9]+' | head -n1)"

if [[ -z "$current" ]]; then
    # No "Found N errors" line means tsc reported zero errors (it omits the line entirely
    # in that case). Treat as 0.
    current=0
fi

if [[ "${1:-}" == "--update" ]]; then
    echo "$current" > "$BASELINE_FILE"
    echo "Baseline updated: $baseline → $current"
    exit 0
fi

echo "Mobile tsc errors: current=$current baseline=$baseline"

if (( current > baseline )); then
    echo ""
    echo "❌ Mobile tsc error count regressed: $current > $baseline" >&2
    echo "   New errors must be fixed before merging, or the baseline must be raised" >&2
    echo "   (only acceptable if the new errors are inherited from a library upgrade)." >&2
    echo ""
    echo "$tsc_output" | tail -50 >&2
    exit 1
fi

if (( current < baseline )); then
    echo ""
    echo "✅ Mobile tsc errors decreased ($baseline → $current). Lower the baseline:"
    echo "   ./_bin/check-mobile-tsc-baseline.sh --update"
    echo "   (run that and commit TherrMobile/.tsc-baseline alongside your fix.)"
    exit 0
fi

echo "✅ No regression."
