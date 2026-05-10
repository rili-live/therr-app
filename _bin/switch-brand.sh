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
#   3. Syncs Firebase config files for the target brand from the per-brand vault
#      at _bin/firebase/<brand>/ into the active build locations
#      (TherrMobile/android/app/google-services.json and
#      TherrMobile/ios/TherrMobile/GoogleService-Info.plist), validates the
#      Android JSON's package_name, and clears Gradle's generated
#      google-services resource directory so the next build re-derives it.
#   4. Kills any running Metro bundler process.
#   5. Clears Metro's temp caches.
#   6. Prints next commands to run.

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
        EXPECTED_PKG="com.therr.habits"
        ;;
    therr)
        EXPECTED_BRANCH="general"
        ENUM_KEY="THERR"
        EXPECTED_PKG="app.therrmobile"
        ;;
    teem)
        EXPECTED_BRANCH="niche/TEEM-general"
        ENUM_KEY="TEEM"
        EXPECTED_PKG="com.therr.teem"
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

# 3. Sync Firebase config files from the per-brand vault.
#    Source of truth: _bin/firebase/<brand>/{google-services.json,GoogleService-Info.plist}
#    See _bin/firebase/README.md for how to populate the vault.
FIREBASE_VAULT="$REPO_ROOT/_bin/firebase/$TARGET_LOWER"
ANDROID_GS_SRC="$FIREBASE_VAULT/google-services.json"
ANDROID_GS_DST="$REPO_ROOT/TherrMobile/android/app/google-services.json"
IOS_PLIST_SRC="$FIREBASE_VAULT/GoogleService-Info.plist"
IOS_PLIST_DST="$REPO_ROOT/TherrMobile/ios/TherrMobile/GoogleService-Info.plist"

# 3a. Android google-services.json
if [ -f "$ANDROID_GS_SRC" ]; then
    cp "$ANDROID_GS_SRC" "$ANDROID_GS_DST"
    printMessageSuccess "Copied $TARGET_LOWER google-services.json → TherrMobile/android/app/"
    if command -v jq >/dev/null 2>&1; then
        ACTUAL_PKGS=$(jq -r '.client[].client_info.android_client_info.package_name' "$ANDROID_GS_DST" | tr '\n' ' ')
        if echo " $ACTUAL_PKGS " | grep -q " $EXPECTED_PKG "; then
            printMessageNeutral "  package_name OK: $EXPECTED_PKG present"
            SHA1=$(jq -r --arg pkg "$EXPECTED_PKG" \
                '.client[] | select(.client_info.android_client_info.package_name==$pkg) | .oauth_client[0].android_info.certificate_hash // "(none registered)"' \
                "$ANDROID_GS_DST")
            printMessageNeutral "  registered SHA-1: $SHA1"
        else
            printMessageError "google-services.json has package_name(s) [$ACTUAL_PKGS] but expected [$EXPECTED_PKG]"
            printMessageError "Re-export the $TARGET_LOWER Android app from Firebase Console and save to $ANDROID_GS_SRC"
            exit 1
        fi
    else
        printMessageWarning "jq not installed — skipping google-services.json validation. Install jq to enable."
    fi
else
    printMessageWarning "No source file at $ANDROID_GS_SRC"
    if [ -f "$ANDROID_GS_DST" ] && command -v jq >/dev/null 2>&1; then
        DEST_PKGS=$(jq -r '.client[].client_info.android_client_info.package_name' "$ANDROID_GS_DST" | tr '\n' ' ')
        if echo " $DEST_PKGS " | grep -q " $EXPECTED_PKG "; then
            printMessageWarning "  Existing $ANDROID_GS_DST already contains $EXPECTED_PKG — proceeding."
        else
            printMessageError "Existing $ANDROID_GS_DST has package_name(s) [$DEST_PKGS] but $TARGET_LOWER build expects [$EXPECTED_PKG]."
            printMessageError "Populate $ANDROID_GS_SRC from Firebase Console (see _bin/firebase/README.md) before building."
            exit 1
        fi
    else
        printMessageWarning "  Android build for $TARGET_LOWER will use whatever is currently at $ANDROID_GS_DST"
        printMessageWarning "  See _bin/firebase/README.md and docs/SECRETS_AND_LOCAL_BOOTSTRAP.md to populate the vault."
    fi
fi

# 3b. iOS GoogleService-Info.plist (only Therr ships iOS today; absent for niches is OK)
if [ -f "$IOS_PLIST_SRC" ]; then
    cp "$IOS_PLIST_SRC" "$IOS_PLIST_DST"
    printMessageSuccess "Copied $TARGET_LOWER GoogleService-Info.plist → TherrMobile/ios/TherrMobile/"
elif [ "$TARGET_LOWER" = "therr" ]; then
    printMessageWarning "No source file at $IOS_PLIST_SRC — iOS Therr build will use whatever is currently at $IOS_PLIST_DST"
fi

# 3c. Invalidate Gradle's generated google-services resources so the next build
#     re-derives strings.xml (default_web_client_id, etc.) from the new JSON.
GRADLE_GEN_DIR="$REPO_ROOT/TherrMobile/android/app/build/generated/res/google-services"
if [ -d "$GRADLE_GEN_DIR" ]; then
    rm -rf "$GRADLE_GEN_DIR"
    printMessageNeutral "Cleared Gradle's generated google-services resources."
fi

# 4. Kill Metro (tolerant of no-match).
if pgrep -f "react-native.*start" >/dev/null 2>&1; then
    printMessageNeutral "Killing running Metro bundler..."
    pkill -f "react-native.*start" || true
    sleep 1
else
    printMessageNeutral "No Metro bundler running."
fi

# 5. Clear Metro caches.
printMessageNeutral "Clearing Metro / Haste caches..."
rm -rf "${TMPDIR}"metro-* 2>/dev/null || true
rm -rf "${TMPDIR}"haste-map-* 2>/dev/null || true
rm -rf "${TMPDIR}"react-native-packager-cache-* 2>/dev/null || true

printMessageSuccess "Switched to brand: $ENUM_KEY"
echo ""
echo "Next commands (two terminals):"
echo "  Terminal 1:  cd TherrMobile && npm start"
echo "  Terminal 2:  cd TherrMobile && npm run android:${TARGET_LOWER}"
