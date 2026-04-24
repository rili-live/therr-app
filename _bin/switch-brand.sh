#!/bin/bash
#
# switch-brand.sh — switch TherrMobile dev context between brand variations.
#
# Usage:
#   ./_bin/switch-brand.sh habits | therr | teem
#
# What it does:
#   1. Warns (does not block) if current git branch doesn't match target brand.
#   2. Rewrites CURRENT_BRAND_VARIATION in TherrMobile/main/config/brandConfig.ts
#      if it doesn't already match the target.
#   3. Kills any running Metro bundler process.
#   4. Clears Metro's temp caches.
#   5. Prints next commands to run.

set -e

pushd "$(dirname "$0")" >/dev/null
source ./lib/colorize.sh 2>/dev/null || {
    # Minimal fallback if colorize.sh is unavailable
    printMessageNeutral() { echo "-- $1"; }
    printMessageSuccess() { echo "++ $1"; }
    printMessageWarning() { echo "!! $1"; }
    printMessageError()   { echo "XX $1" >&2; }
}
popd >/dev/null

TARGET_RAW="${1:-}"
if [ -z "$TARGET_RAW" ]; then
    printMessageError "Usage: ./_bin/switch-brand.sh habits|therr|teem"
    exit 1
fi

# Normalize input: allow "habits", "HABITS", "Habits"
TARGET_LOWER=$(echo "$TARGET_RAW" | tr '[:upper:]' '[:lower:]')
TARGET_UPPER=$(echo "$TARGET_RAW" | tr '[:lower:]' '[:upper:]')

case "$TARGET_LOWER" in
    habits)
        EXPECTED_BRANCH="niche/HABITS-general"
        ENUM_KEY="HABITS"
        ;;
    therr)
        EXPECTED_BRANCH="general"
        ENUM_KEY="THERR"
        ;;
    teem)
        EXPECTED_BRANCH="niche/TEEM-general"
        ENUM_KEY="TEEM"
        ;;
    *)
        printMessageError "Unknown brand: $TARGET_RAW"
        printMessageError "Supported: habits, therr, teem"
        exit 1
        ;;
esac

REPO_ROOT=$(git rev-parse --show-toplevel)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BRAND_CONFIG="$REPO_ROOT/TherrMobile/main/config/brandConfig.ts"

# 1. Branch-match check (warn only).
if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
    printMessageWarning "Current branch is '$CURRENT_BRANCH' but '$ENUM_KEY' brand usually lives on '$EXPECTED_BRANCH'."
    printMessageWarning "Continuing anyway. Run 'git checkout $EXPECTED_BRANCH' first if that wasn't intentional."
fi

# 2. Rewrite brandConfig.ts if needed.
if [ ! -f "$BRAND_CONFIG" ]; then
    printMessageError "brandConfig.ts not found at $BRAND_CONFIG"
    exit 1
fi

CURRENT_ENUM=$(grep -E '^export const CURRENT_BRAND_VARIATION' "$BRAND_CONFIG" | sed -E 's/.*BrandVariations\.([A-Z]+).*/\1/')

if [ "$CURRENT_ENUM" = "$ENUM_KEY" ]; then
    printMessageNeutral "brandConfig.ts already set to $ENUM_KEY — no rewrite needed."
else
    printMessageNeutral "Rewriting brandConfig.ts: $CURRENT_ENUM → $ENUM_KEY"
    # macOS sed requires -i '' for in-place edits
    sed -i '' -E "s/(export const CURRENT_BRAND_VARIATION = BrandVariations\.)[A-Z]+;/\1${ENUM_KEY};/" "$BRAND_CONFIG"
fi

# 3. Kill Metro (tolerant of no-match).
if pgrep -f "react-native.*start" >/dev/null 2>&1; then
    printMessageNeutral "Killing running Metro bundler..."
    pkill -f "react-native.*start" || true
    sleep 1
else
    printMessageNeutral "No Metro bundler running."
fi

# 4. Clear Metro caches.
printMessageNeutral "Clearing Metro / Haste caches..."
rm -rf "${TMPDIR}"metro-* 2>/dev/null || true
rm -rf "${TMPDIR}"haste-map-* 2>/dev/null || true
rm -rf "${TMPDIR}"react-native-packager-cache-* 2>/dev/null || true

printMessageSuccess "Switched to brand: $ENUM_KEY"
echo ""
echo "Next commands (two terminals):"
echo "  Terminal 1:  cd TherrMobile && npm start"
echo "  Terminal 2:  cd TherrMobile && npm run android:${TARGET_LOWER}"
