#!/usr/bin/env bash
# Mobile tsc baseline check.
#
# Why this exists: TherrMobile inherits a backlog of pre-existing TypeScript errors from the
# RN 0.83 upgrade (see ~/.claude memory: rn-0.83-upgrade.md); TherrMobile/.tsc-baseline is the
# authority on how many. Until those are paid down, `tsc --noEmit` cannot be a hard gate; CI
# would always fail. But ignoring tsc entirely means new errors slip in unnoticed.
#
# This script splits the difference: it fails when an error appears that is not already
# in the committed baseline.
#
# The baseline records error *identities*, not a count. A count-only baseline has a real
# hole: fix one pre-existing error and introduce a new one in the same change, and the
# total is unchanged, so the gate passes while a genuine regression lands. Identity
# matching catches that — the new signature is absent from the baseline regardless of
# what else was fixed.
#
# Signature format (one per line, sorted, tab-separated):
#     <file>	<TS code>	<message>
#
# Line and column are deliberately excluded. They shift whenever anything above the error
# is edited (adding an import moves every error in the file down), which would otherwise
# turn every unrelated edit into a false regression.
#
# Usage:
#   ./_bin/check-mobile-tsc-baseline.sh           # CI mode: exit non-zero on new errors
#   ./_bin/check-mobile-tsc-baseline.sh --update  # Rewrite the baseline from current state
#
# Baseline is stored at TherrMobile/.tsc-baseline.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_FILE="$REPO_ROOT/TherrMobile/.tsc-baseline"

MODE="${1:-check}"

if [[ "$MODE" != "check" && "$MODE" != "--update" ]]; then
    echo "Unknown argument: $MODE" >&2
    echo "Usage: $0 [--update]" >&2
    exit 2
fi

if [[ "$MODE" == "check" && ! -f "$BASELINE_FILE" ]]; then
    echo "Missing baseline file: $BASELINE_FILE" >&2
    echo "Create it with: ./_bin/check-mobile-tsc-baseline.sh --update" >&2
    exit 2
fi

# --pretty false keeps the output as one plain line per error with no ANSI codes, which is
# what the signature extraction below depends on.
tsc_output="$(cd "$REPO_ROOT" && npx tsc --noEmit -p TherrMobile/tsconfig.json --pretty false 2>&1 || true)"

# Extract signatures. Error lines look like:
#     TherrMobile/main/routes/index.tsx(172,9): error TS2322: Type 'X' is not assignable...
# Continuation/related-info lines are indented, so anchoring on a non-space first column
# drops them. Sorted so `comm` can diff the two sides.
current_sigs="$(printf '%s\n' "$tsc_output" \
    | grep -E '^[^[:space:]].*\([0-9]+,[0-9]+\): error TS[0-9]+:' \
    | sed -E 's/^([^(]+)\([0-9]+,[0-9]+\): error (TS[0-9]+): (.*)$/\1'$'\t''\2'$'\t''\3/' \
    | sort)"

# Drop "cannot find module" errors for packages that ARE declared in
# TherrMobile/package.json but are not installed here. `react-native-background-geolocation`
# is licensed and will not install without credentials, so on most dev machines it is absent
# and tsc reports TS2307 for every importer — errors CI never sees, because CI installs it.
# Left in, they read as new regressions and the tempting fix is `--update`, which erases the
# whole gate. The filter is narrow enough that a broken relative import, an undeclared
# package, or a dependency deleted from package.json all still gate; see the header of the
# filter for the exact conditions. Applied before --update too, so an uninstalled package
# can never be written into the baseline.
current_sigs="$(printf '%s\n' "$current_sigs" \
    | node "$REPO_ROOT/_bin/lib/filter-uninstallable-module-errors.js")"

current_count="$(printf '%s\n' "$current_sigs" | grep -c . || true)"

if [[ "$MODE" == "--update" ]]; then
    previous_count=0
    if [[ -f "$BASELINE_FILE" ]]; then
        previous_count="$(grep -c . "$BASELINE_FILE" || true)"
    fi
    printf '%s\n' "$current_sigs" | grep . > "$BASELINE_FILE" || true
    echo "Baseline updated: $previous_count → $current_count error signatures"
    exit 0
fi

# A legacy baseline holds a single integer. Signatures are tab-separated, so the absence of
# any tab means the file predates this format.
if ! grep -q $'\t' "$BASELINE_FILE"; then
    echo "❌ Baseline file is in the old count-only format." >&2
    echo "   Regenerate it: ./_bin/check-mobile-tsc-baseline.sh --update" >&2
    echo "   (Review the generated file before committing — it should list only errors" >&2
    echo "    that already existed on the target branch.)" >&2
    exit 2
fi

baseline_count="$(grep -c . "$BASELINE_FILE" || true)"

tmp_current="$(mktemp)"
tmp_baseline="$(mktemp)"
trap 'rm -f "$tmp_current" "$tmp_baseline"' EXIT

printf '%s\n' "$current_sigs" | grep . > "$tmp_current" || true
grep . "$BASELINE_FILE" | sort > "$tmp_baseline" || true

new_errors="$(comm -23 "$tmp_current" "$tmp_baseline")"
fixed_errors="$(comm -13 "$tmp_current" "$tmp_baseline")"

echo "Mobile tsc errors: current=$current_count baseline=$baseline_count"

if [[ -n "$new_errors" ]]; then
    new_count="$(printf '%s\n' "$new_errors" | grep -c . || true)"
    echo ""
    echo "❌ $new_count TypeScript error(s) not present in the baseline:" >&2
    echo "" >&2
    printf '%s\n' "$new_errors" | sed 's/^/   /' >&2
    echo "" >&2
    echo "   Fix them, or — only if they are inherited from a library upgrade —" >&2
    echo "   run ./_bin/check-mobile-tsc-baseline.sh --update and commit the baseline." >&2
    exit 1
fi

if [[ -n "$fixed_errors" ]]; then
    fixed_count="$(printf '%s\n' "$fixed_errors" | grep -c . || true)"
    echo ""
    echo "✅ No new errors. $fixed_count baseline error(s) no longer reproduce:"
    printf '%s\n' "$fixed_errors" | sed 's/^/   /'
    echo ""
    echo "   Lock the improvement in: ./_bin/check-mobile-tsc-baseline.sh --update"
    echo "   (run that and commit TherrMobile/.tsc-baseline alongside your fix.)"
    exit 0
fi

echo "✅ No new errors."
