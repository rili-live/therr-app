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
#
# --brand defaults to the JWT's own `brand` claim, because the gateway rejects any
# request whose x-brand-variation disagrees with it. A token is bound to the brand
# you logged in under, so a real test send for another brand needs that brand's login.

set -euo pipefail

API_HOST="${THERR_API_HOST:-https://api.therr.com}"
BRAND=""
BRAND_EXPLICIT="false"
USER_ID=""
JWT=""
DEVICE_TOKEN=""
TYPE="pact-invitation"
DRY_RUN="true"

usage() {
    sed -n '3,18p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) USER_ID="$2"; shift 2 ;;
        --token) JWT="$2"; shift 2 ;;
        --brand) BRAND="$2"; BRAND_EXPLICIT="true"; shift 2 ;;
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

# Read a claim out of the JWT payload without verifying it — we only need to know
# which brand the token was minted under, and the gateway does the real verifying.
jwt_claim() {
    local payload
    payload="$(printf '%s' "$JWT" | cut -d. -f2 | tr '_-' '/+')"
    while (( ${#payload} % 4 )); do payload="${payload}="; done
    printf '%s' "$payload" | base64 -d 2>/dev/null | jq -r ".${1} // empty" 2>/dev/null || true
}

# `authenticate.ts` binds every non-legacy JWT to the brand it was issued under and
# rejects any request whose x-brand-variation differs, with a 401 that reads
# "Token brand does not match request brand." Since the token already knows the
# answer, default to it rather than making the caller guess.
TOKEN_BRAND="$(jwt_claim brand)"

if [[ -z "$BRAND" ]]; then
    BRAND="${TOKEN_BRAND:-therr}"
    if [[ -n "$TOKEN_BRAND" ]]; then
        echo "==> No --brand given; using the token's own brand claim: ${BRAND}"
    fi
elif [[ -n "$TOKEN_BRAND" && "$BRAND" != "$TOKEN_BRAND" ]]; then
    echo "ERROR: --brand '${BRAND}' does not match this token's brand claim '${TOKEN_BRAND}'." >&2
    echo "       The gateway will reject every request below with 401" >&2
    echo "       \"Token brand does not match request brand.\" (therr-api-gateway authenticate.ts)" >&2
    echo >&2
    echo "       A token is bound to the brand you logged in under, so testing a send for" >&2
    echo "       '${BRAND}' needs a '${BRAND}' login — you cannot borrow a '${TOKEN_BRAND}' token." >&2
    echo "       Note links 2 and 3 report ALL brands regardless of this header, so" >&2
    echo "       re-running with --brand ${TOKEN_BRAND} still shows you the routing and" >&2
    echo "       registered device tokens for '${BRAND}'; only the [4/5] test send is" >&2
    echo "       genuinely brand-bound." >&2
    exit 1
fi

HDRS=(-H "authorization: Bearer ${JWT}" -H "x-brand-variation: ${BRAND}" -H "x-localecode: en-us")

# curl doesn't fail on an HTTP error status, and every error in this stack comes
# back as a JSON body ({ statusCode, message }) rather than the shape the jq
# filters below expect. Piping that straight into jq dies with an opaque
# "Cannot iterate over null" instead of showing the actual rejection, so capture
# the status alongside the body and report it ourselves.
RESPONSE=""
RESPONSE_STATUS=""

request() {
    # Method must reach the wire uppercase — Express matches verbs case-sensitively.
    local method url body args raw
    method="$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')"
    url="$2"
    body="${3:-}"
    args=(-sS -X "$method" "$url" "${HDRS[@]}" -w $'\n%{http_code}')
    if [[ -n "$body" ]]; then
        args+=(-H "content-type: application/json" -d "$body")
    fi

    local rc=0
    raw="$(curl "${args[@]}")" || rc=$?
    if (( rc != 0 )); then
        echo "    !! Could not reach ${url} (curl exit ${rc})." >&2
        echo "       Check --host, your network, and VPN access." >&2
        exit 1
    fi

    RESPONSE_STATUS="${raw##*$'\n'}"
    RESPONSE="${raw%$'\n'*}"
}

# Print the raw response plus what that status usually means here.
report_response() {
    local context="$1"
    echo "    !! ${context} (HTTP ${RESPONSE_STATUS})" >&2
    # Order matters: send stdout to the real stderr *before* silencing jq's own.
    echo "$RESPONSE" | jq . >&2 2>/dev/null || echo "    ${RESPONSE}" >&2
    case "$RESPONSE_STATUS" in
        401) echo "       401: the JWT is missing, malformed, or expired — or its 'brand' claim" >&2
             echo "            disagrees with x-brand-variation ('${BRAND}'). Grab a fresh token." >&2 ;;
        403) echo "       403: authenticated, but not SUPER_ADMIN. These endpoints are SUPER_ADMIN-only." >&2 ;;
        404) echo "       404: route not found on ${API_HOST}. The diagnostics endpoints ship via" >&2
             echo "            general -> stage -> main; check they are actually deployed there." >&2 ;;
        429) echo "       429: gateway rate limiter. Wait a minute and retry." >&2 ;;
        5*)  echo "       5xx: the service errored. Check push-notifications-service logs." >&2 ;;
    esac
    echo "       See docs/PUSH_NOTIFICATIONS_DEBUGGING.md" >&2
}

# Same, but fatal — for links whose failure makes everything after them meaningless.
fail_response() {
    report_response "$1"
    exit 1
}

echo "==> Brand: ${BRAND}    Host: ${API_HOST}"
echo

# ---------------------------------------------------------------- link 3
echo "==> [3/5] Firebase routing for this brand"
request get "${API_HOST}/v1/push-notifications-service/notifications/diagnostics"
ROUTING="$RESPONSE"

if [[ "$(echo "$ROUTING" | jq -r 'if type == "object" and has("byBrand") then "ok" else "no" end' 2>/dev/null)" != "ok" ]]; then
    fail_response "Routing diagnostics did not return a brand list"
fi

# `first(...)` over `.byBrand[] | select(...)` yields an empty stream when no
# brand matches, which would silently drop the key from the output object;
# wrapping in an array and defaulting turns a bad --brand into a visible answer.
echo "$ROUTING" | jq '{
    distinctFirebaseProjects,
    thisBrand: ([first(.byBrand[] | select(.brandVariation == "'"${BRAND}"'"))][0]
        // "NOT FOUND — no brand \"'"${BRAND}"'\" in BrandVariations")
}'
echo

# ---------------------------------------------------------------- link 2
if [[ -n "$USER_ID" ]]; then
    echo "==> [2/5] Device-token registration for user ${USER_ID}"
    request get "${API_HOST}/v1/users-service/users/${USER_ID}/push-diagnostics"
    REG="$RESPONSE"

    if [[ "$(echo "$REG" | jq -r 'if type == "object" and has("deviceTokens") then "ok" else "no" end' 2>/dev/null)" != "ok" ]]; then
        # Non-fatal on purpose: links 4-5 send through a different route and do not
        # depend on this one, so a broken link 2 should narrow the report, not end it.
        report_response "Device-token diagnostics failed for user ${USER_ID}"
        if [[ "$RESPONSE_STATUS" == "403" ]]; then
            echo "       If [3/5] above succeeded with this same token, you DO have SUPER_ADMIN" >&2
            echo "       and this is the unanchored public-profile matcher in the gateway's" >&2
            echo "       unauthenticated-path list swallowing /users/:id/push-diagnostics," >&2
            echo "       so authenticate never ran. Fixed on general; needs a deploy." >&2
        fi
        echo "    Continuing to the test send — links 4-5 do not depend on this." >&2
        echo
    else
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
fi

# ---------------------------------------------------------------- links 4-5
echo "==> [4/5] Test send (dryRun=${DRY_RUN}, type=${TYPE})"

if [[ -n "$DEVICE_TOKEN" ]]; then
    # Explicit token: addresses a specific handset, useful when a user has several.
    request post \
        "${API_HOST}/v1/push-notifications-service/notifications/diagnostics/send-test" \
        "{\"deviceToken\":\"${DEVICE_TOKEN}\",\"type\":\"${TYPE}\",\"dryRun\":${DRY_RUN}}"
    RESULT="$RESPONSE"
else
    # By user id: users-service resolves the brand-scoped token the same way the
    # real notification path does, so no token wrangling off the device.
    request post \
        "${API_HOST}/v1/users-service/users/${USER_ID}/push-diagnostics/send-test" \
        "{\"type\":\"${TYPE}\",\"dryRun\":${DRY_RUN}}"
    RESULT="$RESPONSE"

    if [[ "$(echo "$RESULT" | jq -r '.reason // ""' 2>/dev/null)" == "no-device-token" ]]; then
        echo "$RESULT" | jq -r '"    " + .message'
        exit 0
    fi
fi

# A 502 here is a real answer, not a transport failure — it carries the FCM
# rejection in `.result`. Anything without a `result` is not from this endpoint.
if [[ "$(echo "$RESULT" | jq -r 'if type == "object" and has("result") then "ok" else "no" end' 2>/dev/null)" != "ok" ]]; then
    fail_response "Test send did not return an FCM result"
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
