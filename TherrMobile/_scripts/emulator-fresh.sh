#!/usr/bin/env bash
# Cold-boot an Android emulator with a wiped data partition.
#
# Solves: "INSTALL FAILED ... Requested internal only, but not enough space".
# The emulator's /data fills with the Play Store system image plus Google Play
# services updates, and a RN debug APK (~160MB) needs several times its own size
# to stage, extract native libs, and run oat compilation. `adb uninstall` and
# `pm trim-caches` reclaim ~nothing when the culprit is system-side, so the only
# reliable reset is -wipe-data.
#
# Usage:
#   ./_scripts/emulator-fresh.sh                  # wipe + boot the default AVD
#   ./_scripts/emulator-fresh.sh Pixel_8          # ...a specific AVD
#   ./_scripts/emulator-fresh.sh --keep-overlays  # don't delete qcow2 host files
#
# State is intentionally discarded on every run: this is for a disposable dev
# device, not one you sign into and keep.

set -euo pipefail

DEFAULT_AVD=Pixel_9
# Minimum guest /data free space (MB) to install a debug build without the
# PackageInstaller low-storage reserve rejecting the session.
MIN_FREE_MB=2048
# Ports the app expects to reach on the host (API gateway, websocket, Metro).
REVERSE_PORTS=(7770 7743 8081)

AVD=""
KEEP_OVERLAYS=0
for arg in "$@"; do
    case "$arg" in
        --keep-overlays) KEEP_OVERLAYS=1 ;;
        -*) echo "Unknown flag: $arg" >&2; exit 2 ;;
        *) AVD="$arg" ;;
    esac
done
AVD="${AVD:-$DEFAULT_AVD}"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
EMULATOR="$SDK/emulator/emulator"
AVD_DIR="$HOME/.android/avd/$AVD.avd"

[ -x "$EMULATOR" ] || { echo "emulator not found at $EMULATOR (set ANDROID_HOME)" >&2; exit 1; }
[ -d "$AVD_DIR" ] || {
    echo "No such AVD: $AVD" >&2
    echo "Available:" >&2
    "$EMULATOR" -list-avds >&2
    exit 1
}

# A 6GB partition cannot hold the android-36 playstore image plus this app.
PART=$(sed -n 's/^disk\.dataPartition\.size=//p' "$AVD_DIR/config.ini" 2>/dev/null || true)
case "$PART" in
    [1-7]G|[0-9]M|[0-9][0-9][0-9]M)
        echo "WARNING: $AVD has disk.dataPartition.size=$PART."
        echo "  The system image alone uses ~4.7GB. Raise it to 16G in:"
        echo "  $AVD_DIR/config.ini"
        echo ""
        ;;
esac

echo "==> Shutting down any running emulator"
adb emu kill >/dev/null 2>&1 || true
for _ in $(seq 1 30); do
    adb devices | grep -q emulator || break
    sleep 1
done
# The qemu process can outlive the adb handshake; make sure the AVD lock is gone.
pkill -f "qemu-system.*-avd $AVD" 2>/dev/null || true
sleep 2

if [ "$KEEP_OVERLAYS" -eq 0 ]; then
    echo "==> Reclaiming host disk (qcow2 overlays)"
    du -ch "$AVD_DIR"/*.qcow2 2>/dev/null | tail -1 || true
    rm -f "$AVD_DIR"/*.qcow2 "$AVD_DIR"/snapshots/* 2>/dev/null || true
fi

echo "==> Cold booting $AVD with wiped data"
# -no-snapshot: never save on exit either, so the overlay stops growing.
nohup "$EMULATOR" -avd "$AVD" -no-snapshot -wipe-data >/dev/null 2>&1 &

echo "==> Waiting for boot"
adb wait-for-device
for _ in $(seq 1 90); do
    [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 5
done
[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] || {
    echo "Emulator did not finish booting in time." >&2
    exit 1
}

echo "==> Forwarding host ports"
for p in "${REVERSE_PORTS[@]}"; do
    adb reverse "tcp:$p" "tcp:$p" >/dev/null
done

FREE_MB=$(adb shell df /data 2>/dev/null | awk 'NR==2 {print int($4/1024)}')
echo ""
adb shell df -h /data
echo ""
if [ -n "$FREE_MB" ] && [ "$FREE_MB" -lt "$MIN_FREE_MB" ]; then
    echo "WARNING: only ${FREE_MB}MB free on /data after a full wipe."
    echo "  This AVD's data partition is too small for a debug build."
    echo "  Raise disk.dataPartition.size in $AVD_DIR/config.ini and re-run."
    exit 1
fi
echo "$AVD ready — ${FREE_MB}MB free on /data. Ports ${REVERSE_PORTS[*]} forwarded."
