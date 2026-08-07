#!/usr/bin/env bash
#
# Walk the push-notification delivery chain for one user and report where it breaks.
#
# Chains the three SUPER_ADMIN diagnostics endpoints so you don't have to remember
# which one answers which question. Full explanation of each link, and of the FCM
# error codes, is in docs/PUSH_NOTIFICATIONS_DEBUGGING.md.
#
# Usage:
#   ./_bin/push-debug.sh --user <userId> --token <jwt> [--brand habits] [--send] [--type <type>]
#   ./_bin/push-debug.sh --user <userId> --token <jwt> --device-token <fcmToken>   # target one handset
#
# By default the test send is a DRY RUN: FCM validates the token and credentials
# without delivering anything. Pass --send to make the handset actually buzz.

set -euo pipefail

API_HOST="${THERR_API_HOST:-https://api.therr.com}"
BRAND="therr"
USER_ID=""
JWT=""
DEVICE_TOKEN=""
TYPE="pact-invitation"
DRY_RUN="true"

usage() {
    sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) USER_ID="$2"; shift 2 ;;
        --token) JWT="$2"; shift 2 ;;
        --brand) BRAND="$2"; shift 2 ;;
        --device-token) DEVICE_TOKEN="$2"; shift 2 ;;
        --type) TYPE="$2"; shift 2 ;;
        --send) DRY_RUN="false"; shift ;;
        --host) API_HOST="$2"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown argument: $1" >&2; usage ;;
    esac
done

if [[ -z "$JWT" ]]; then
    echo "ERROR: --token <jwt> is required (a SUPER_ADMIN access token)." >&2
    exit 1
fi
if [[ -z "$USER_ID" && -z "$DEVICE_TOKEN" ]]; then
    echo "ERROR: pass --user <userId>, or --device-token <fcmToken> to skip straight to the send." >&2
    exit 1
fi

command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required." >&2; exit 1; }

HDRS=(-H "authorization: Bearer ${JWT}" -H "x-brand-variation: ${BRAND}" -H "x-localecode: en-us")

echo "==> Brand: ${BRAND}    Host: ${API_HOST}"
echo

# ---------------------------------------------------------------- link 3
echo "==> [3/5] Firebase routing for this brand"
ROUTING="$(curl -sS "${API_HOST}/v1/push-notifications-service/notifications/diagnostics" "${HDRS[@]}")"
echo "$ROUTING" | jq '{
    distinctFirebaseProjects,
    thisBrand: (.byBrand[] | select(.brandVariation == "'"${BRAND}"'"))
}'
echo

# ---------------------------------------------------------------- link 2
if [[ -n "$USER_ID" ]]; then
    echo "==> [2/5] Device-token registration for user ${USER_ID}"
    REG="$(curl -sS "${API_HOST}/v1/users-service/users/${USER_ID}/push-diagnostics" "${HDRS[@]}")"
    echo "$REG" | jq '{ requestedBrand, isRegisteredForRequestedBrand, brandsRegistered, deviceTokens, legacy }'

    if [[ "$(echo "$REG" | jq -r '.isRegisteredForRequestedBrand // false')" != "true" ]]; then
        echo
        echo "    !! No device token registered for brand '${BRAND}'."
        echo "       Either the app never registered (check OS notification permission),"
        echo "       or its CURRENT_BRAND_VARIATION differs from the brand sending the push."
        echo "       See docs/PUSH_NOTIFICATIONS_DEBUGGING.md, links 1-2."
    fi
    echo
fi

# ---------------------------------------------------------------- links 4-5
echo "==> [4/5] Test send (dryRun=${DRY_RUN}, type=${TYPE})"

if [[ -n "$DEVICE_TOKEN" ]]; then
    # Explicit token: addresses a specific handset, useful when a user has several.
    RESULT="$(curl -sS -X POST \
        "${API_HOST}/v1/push-notifications-service/notifications/diagnostics/send-test" \
        "${HDRS[@]}" \
        -H "content-type: application/json" \
        -d "{\"deviceToken\":\"${DEVICE_TOKEN}\",\"type\":\"${TYPE}\",\"dryRun\":${DRY_RUN}}")"
else
    # By user id: users-service resolves the brand-scoped token the same way the
    # real notification path does, so no token wrangling off the device.
    RESULT="$(curl -sS -X POST \
        "${API_HOST}/v1/users-service/users/${USER_ID}/push-diagnostics/send-test" \
        "${HDRS[@]}" \
        -H "content-type: application/json" \
        -d "{\"type\":\"${TYPE}\",\"dryRun\":${DRY_RUN}}")"

    if [[ "$(echo "$RESULT" | jq -r '.reason // ""')" == "no-device-token" ]]; then
        echo "$RESULT" | jq -r '"    " + .message'
        exit 0
    fi
fi

echo "$RESULT" | jq '{ result, apnsTopic: .envelope.apns.headers["apns-topic"], androidChannel: .envelope.android.notification.channelId }'
echo

if [[ "$(echo "$RESULT" | jq -r '.result.ok // false')" == "true" ]]; then
    echo "==> [5/5] FCM accepted the message."
    echo "    If nothing arrived on iOS, compare the apns-topic above against the"
    echo "    installed build's bundle id — APNS drops a mismatch silently and FCM"
    echo "    still reports success. That is the one failure no error code covers."
else
    echo "==> [4/5] FCM rejected the message:"
    echo "$RESULT" | jq -r '"    " + (.result.errorCode // "?") + ": " + (.result.errorMessage // "")'
    echo "    Error-code table: docs/PUSH_NOTIFICATIONS_DEBUGGING.md"
fi
