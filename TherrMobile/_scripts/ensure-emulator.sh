#!/usr/bin/env bash
# Boot the default AVD when no Android device is attached, then hand off.
#
# Without this, `react-native run-android` with nothing connected boots
# `emulator -list-avds | head -1` — alphabetical, so Pixel_8 (6GB /data, too
# small for a debug build: INSTALL_FAILED_INSUFFICIENT_STORAGE) wins over
# Pixel_9. Its `--device` flag takes an adb serial, not an AVD name, so it
# cannot express "launch this AVD" either.
#
# Usage:
#   ./_scripts/ensure-emulator.sh            # Pixel_9, or $ANDROID_AVD
#   ./_scripts/ensure-emulator.sh Pixel_8    # a specific AVD
#
# A connected device or already-running emulator is left alone.

set -euo pipefail

AVD="${1:-${ANDROID_AVD:-Pixel_9}}"
# Ports the app expects to reach on the host (API gateway, websocket, Metro).
REVERSE_PORTS=(7770 7743 8081)

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
EMULATOR="$SDK/emulator/emulator"

if adb devices | grep -q $'\tdevice$'; then
    exit 0
fi

[ -x "$EMULATOR" ] || { echo "emulator not found at $EMULATOR (set ANDROID_HOME)" >&2; exit 1; }
"$EMULATOR" -list-avds | grep -qx "$AVD" || {
    echo "No such AVD: $AVD. Available:" >&2
    "$EMULATOR" -list-avds >&2
    exit 1
}

echo "==> No device attached; booting $AVD"
nohup "$EMULATOR" -avd "$AVD" >/dev/null 2>&1 &

adb wait-for-device
for _ in $(seq 1 90); do
    [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 2
done
[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] || {
    echo "$AVD did not finish booting in time." >&2
    exit 1
}

for p in "${REVERSE_PORTS[@]}"; do
    adb reverse "tcp:$p" "tcp:$p" >/dev/null
done
echo "==> $AVD ready"
