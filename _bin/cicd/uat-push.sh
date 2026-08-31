#!/bin/bash

# Post-deploy UAT for the push-notification pipeline.
#
# Answers one question against the live cluster, after a deploy has rolled out:
# would a real push get built, credentialed and accepted by FCM right now?
#
# It never delivers anything by default — every send is an FCM dry run
# (`validate_only`), so no handset buzzes and no user-visible state changes.
#
# WHAT IT CANNOT TELL YOU
#
# Link 5 of the delivery chain (APNS/Android accepting the push and the device
# rendering it) produces no server-side signal at all: APNS silently discards a
# push whose `apns-topic` is not the receiving app's bundle id, and FCM still
# returns a message id. Check 2 below covers that indirectly by pinning the
# topic each brand would address, which is the failure mode that has actually
# shipped. Genuine delivery confirmation needs a device to acknowledge receipt.
# See docs/PUSH_NOTIFICATIONS_DEBUGGING.md.
#
# THE CHECKS
#
#   1. Synthetic-token envelope check (no account, no handset required)
#      Sends a deliberately invalid device token through the *production* send
#      path with dryRun. A healthy pipeline rejects it with an invalid-token
#      error code and nothing else. That single assertion proves the service
#      booted, the brand's Firebase credentials parsed and authenticated, the
#      notification type is still routable, and firebase-admin accepted the
#      envelope — the last of which is where the August 2026 outage lived
#      (`data must only contain string values`, thrown client-side before the
#      request ever reached FCM).
#
#      This is an inverted assertion: the expected outcome is a *specific
#      failure*. Any other error code is a real regression. A success would
#      mean FCM accepted a token that cannot exist, so that fails too.
#
#   2. Brand routing check
#      Every brand still resolves to a Firebase project, and its `apns-topic` is
#      still a bundle id some iOS target builds. A brand silently falling back
#      to no project at all, or an `apns-topic` edited to something nothing
#      builds, both pass every other check and drop 100% of iOS pushes.
#
#   3. Real-account dry run (optional; needs UAT_USER_ID)
#      Resolves that user's registered device token server-side and validates a
#      real message against it. This is the only check that can catch a
#      credential/project mismatch or an expired APNS auth key, because those
#      require a genuine token to compare against. Requires the account to have
#      opened the app under the tested brand at least once.
#
# CONFIGURATION (environment)
#
#   THERR_API_HOST         default https://api.therr.com
#   UAT_BRAND              brand to test; default therr. Must match the JWT's
#                          own brand claim — the gateway rejects a mismatch.
#   UAT_SUPER_ADMIN_JWT    a SUPER_ADMIN access token, or:
#   UAT_SUPER_ADMIN_EMAIL  \ credentials to mint one at run time. Preferred in
#   UAT_SUPER_ADMIN_PASSWORD/ CI, since a JWT expires and a stored one goes stale.
#   UAT_USER_ID            enables check 3. Omit to skip it.
#   UAT_NOTIFICATION_TYPE  default new-like-received (see PushNotifications.Types)
#   UAT_ALLOW_REAL_SEND    set to "true" to make check 3 deliver for real. Off by
#                          default; this is what makes a phone buzz on every deploy.
#
# Exit codes: 0 all checks passed, 1 a check failed, 2 misconfigured.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/colorize.sh
source "$SCRIPT_DIR/../lib/colorize.sh"
# colorize.sh sets -e for its own callers; this script reports every failure
# rather than aborting on the first one, so undo it.
set +e

API_HOST="${THERR_API_HOST:-https://api.therr.com}"
BRAND="${UAT_BRAND:-therr}"
NOTIFICATION_TYPE="${UAT_NOTIFICATION_TYPE:-new-like-received}"
JWT="${UAT_SUPER_ADMIN_JWT:-}"

FAILURES=0
CHECKS_RUN=0

fail() {
    printMessageError "  FAIL: $1"
    FAILURES=$((FAILURES + 1))
}

pass() {
    printMessageSuccess "  PASS: $1"
}

command -v jq >/dev/null 2>&1 || { printMessageError "jq is required."; exit 2; }
command -v curl >/dev/null 2>&1 || { printMessageError "curl is required."; exit 2; }

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

if [ -z "$JWT" ]; then
    if [ -z "${UAT_SUPER_ADMIN_EMAIL:-}" ] || [ -z "${UAT_SUPER_ADMIN_PASSWORD:-}" ]; then
        printMessageError "Set UAT_SUPER_ADMIN_JWT, or UAT_SUPER_ADMIN_EMAIL + UAT_SUPER_ADMIN_PASSWORD."
        exit 2
    fi

    printMessageNeutral "==> Authenticating as ${UAT_SUPER_ADMIN_EMAIL} (brand: ${BRAND})"
    # The token is minted under the brand of this request, and the gateway later
    # rejects any call whose x-brand-variation disagrees with the token's claim.
    LOGIN_BODY="$(jq -nc \
        --arg user "$UAT_SUPER_ADMIN_EMAIL" \
        --arg pass "$UAT_SUPER_ADMIN_PASSWORD" \
        '{userName: $user, password: $pass, rememberMe: false}')"

    LOGIN_RESPONSE="$(curl -sS -X POST "${API_HOST}/v1/users-service/auth" \
        -H 'content-type: application/json' \
        -H "x-brand-variation: ${BRAND}" \
        -H 'x-localecode: en-us' \
        -d "$LOGIN_BODY" 2>/dev/null)"

    JWT="$(printf '%s' "$LOGIN_RESPONSE" | jq -r '.idToken // empty' 2>/dev/null)"

    if [ -z "$JWT" ]; then
        printMessageError "Login failed. Response:"
        # Never echo the raw body — a login response carries the refresh token
        # and the full user record. Only the failure fields are of any use here.
        printf '%s' "$LOGIN_RESPONSE" | jq -c '{statusCode, message, errorCode}' 2>/dev/null \
            || echo "  (unparseable response)"
        exit 2
    fi
    printMessageSuccess "    Authenticated."
fi

HDRS=(
    -H "authorization: Bearer ${JWT}"
    -H "x-brand-variation: ${BRAND}"
    -H 'x-localecode: en-us'
    -H 'content-type: application/json'
)

# Issues a request and leaves the body in RESPONSE, the status in STATUS.
RESPONSE=""
STATUS=""
request() {
    local method="$1" url="$2" body="${3:-}"
    local args=(-sS --max-time 30 -X "$(printf '%s' "$method" | tr '[:lower:]' '[:upper:]')" "$url" "${HDRS[@]}" -w $'\n%{http_code}')
    [ -n "$body" ] && args+=(-d "$body")

    local raw rc=0
    raw="$(curl "${args[@]}" 2>/dev/null)" || rc=$?
    if [ "$rc" -ne 0 ]; then
        RESPONSE=""
        STATUS="000"
        return 1
    fi
    STATUS="$(printf '%s' "$raw" | tail -n1)"
    RESPONSE="$(printf '%s' "$raw" | sed '$d')"
    return 0
}

printMessageNeutral "==> Push UAT against ${API_HOST} (brand: ${BRAND}, type: ${NOTIFICATION_TYPE})"

# ---------------------------------------------------------------------------
# Check 1 — synthetic token through the production send path
# ---------------------------------------------------------------------------

printMessageNeutral "[1/3] Synthetic-token envelope check (production path, dry run)"
CHECKS_RUN=$((CHECKS_RUN + 1))

# Shaped like an FCM token (long, base64url-ish) so nothing rejects it before
# firebase-admin does, but not a real registration.
SYNTHETIC_TOKEN="uat-synthetic-token-$(date +%s)-$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)"

SEND_BODY="$(jq -nc \
    --arg token "$SYNTHETIC_TOKEN" \
    --arg type "$NOTIFICATION_TYPE" \
    '{deviceToken: $token, type: $type, dryRun: true, viaProductionPath: true}')"

if ! request POST "${API_HOST}/v1/push-notifications-service/notifications/diagnostics/send-test" "$SEND_BODY"; then
    fail "Could not reach the push diagnostics endpoint (network error or timeout)."
else
    ERROR_CODE="$(printf '%s' "$RESPONSE" | jq -r '.result.errorCode // empty' 2>/dev/null)"
    RESULT_OK="$(printf '%s' "$RESPONSE" | jq -r '.result.ok // empty' 2>/dev/null)"
    SEND_PATH="$(printf '%s' "$RESPONSE" | jq -r '.sendPath // empty' 2>/dev/null)"

    if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
        fail "Auth rejected (HTTP ${STATUS}). The account needs SUPER_ADMIN, and the JWT's brand claim must equal '${BRAND}'."
    elif [ "$SEND_PATH" != "production" ]; then
        # An older image that ignores viaProductionPath would answer 'raw' — and a
        # raw-path pass is exactly the false green this check exists to avoid.
        fail "Response reports sendPath='${SEND_PATH:-none}', expected 'production'. The deployed push-notifications-service predates viaProductionPath; this check would not prove anything."
    elif [ "$RESULT_OK" = "true" ]; then
        fail "FCM accepted a synthetic token that cannot correspond to any device. Expected rejection."
    else
        case "$ERROR_CODE" in
            messaging/invalid-registration-token|messaging/invalid-argument|messaging/registration-token-not-registered)
                pass "Envelope built, credentials authenticated, type routable; FCM rejected the fake token as expected (${ERROR_CODE})."
                ;;
            notification-type-not-routed)
                fail "Type '${NOTIFICATION_TYPE}' is no longer in SENDABLE_NOTIFICATION_TYPES — production would silently drop every one of these."
                ;;
            unsupported-notification-type)
                fail "Type '${NOTIFICATION_TYPE}' has no case in createMessage — nothing would ever be sent for it."
                ;;
            app/invalid-credential|messaging/third-party-auth-error|messaging/mismatched-credential|messaging/authentication-error)
                fail "Firebase credentials are broken for brand '${BRAND}' (${ERROR_CODE}). Every push for this brand is failing."
                ;;
            "")
                fail "No FCM error code in the response (HTTP ${STATUS}). Body: $(printf '%s' "$RESPONSE" | head -c 400)"
                ;;
            *)
                # Notably catches `data must only contain string values`, the
                # August 2026 outage — firebase-admin throws that client-side.
                fail "Unexpected error code '${ERROR_CODE}'. Message: $(printf '%s' "$RESPONSE" | jq -r '.result.errorMessage // "none"' 2>/dev/null | head -c 300)"
                ;;
        esac
    fi
fi

# ---------------------------------------------------------------------------
# Check 2 — brand routing
# ---------------------------------------------------------------------------

printMessageNeutral "[2/3] Brand routing and apns-topic"
CHECKS_RUN=$((CHECKS_RUN + 1))

# The only bundle id TherrMobile.xcodeproj builds. Niche branches change
# brandConfig.ts / app.json / build.gradle and leave PRODUCT_BUNDLE_IDENTIFIER
# alone, so every brand's iOS pushes must be addressed here until a brand ships
# an iOS target of its own. Kept in step with the unit test that reads the Xcode
# project directly (push-notifications-service tests/unit/api/brandRouting.test.ts);
# update both in the commit that adds the target.
EXPECTED_APNS_TOPIC="${UAT_EXPECTED_APNS_TOPIC:-com.therr.mobile.Therr}"

if ! request GET "${API_HOST}/v1/push-notifications-service/notifications/diagnostics"; then
    fail "Could not reach the routing diagnostics endpoint."
elif [ "$STATUS" != "200" ]; then
    fail "Routing diagnostics returned HTTP ${STATUS}."
else
    PROJECT_COUNT="$(printf '%s' "$RESPONSE" | jq -r '.distinctFirebaseProjects | length' 2>/dev/null)"
    BRANDS_NO_PROJECT="$(printf '%s' "$RESPONSE" | jq -r '[.byBrand[] | select(.firebaseProjectId == "")] | length' 2>/dev/null)"
    BAD_TOPICS="$(printf '%s' "$RESPONSE" \
        | jq -r --arg expected "$EXPECTED_APNS_TOPIC" \
            '[.byBrand[] | select(.iosApnsTopic != $expected) | .brandVariation] | join(", ")' 2>/dev/null)"

    if [ "${PROJECT_COUNT:-0}" -lt 1 ]; then
        fail "No Firebase project resolved for any brand. Credentials are missing or unparseable."
    elif [ "${BRANDS_NO_PROJECT:-0}" -gt 0 ]; then
        fail "${BRANDS_NO_PROJECT} brand(s) resolved to no Firebase project: $(printf '%s' "$RESPONSE" | jq -r '[.byBrand[] | select(.firebaseProjectId == "") | .brandVariation] | join(", ")')"
    elif [ -n "$BAD_TOPICS" ]; then
        fail "apns-topic is not '${EXPECTED_APNS_TOPIC}' for: ${BAD_TOPICS}. iOS pushes for those brands will be dropped by APNS with no error."
    else
        pass "All brands resolve to a Firebase project; every apns-topic is '${EXPECTED_APNS_TOPIC}'."
    fi
fi

# ---------------------------------------------------------------------------
# Check 3 — real registered device (optional)
# ---------------------------------------------------------------------------

if [ -z "${UAT_USER_ID:-}" ]; then
    printMessageWarning "[3/3] Real-account dry run SKIPPED (UAT_USER_ID not set)."
    printMessageWarning "      Without it, a credential/project mismatch or an expired APNS key is not covered:"
    printMessageWarning "      both need a genuine device token to detect."
else
    REAL_DRY_RUN="true"
    [ "${UAT_ALLOW_REAL_SEND:-false}" = "true" ] && REAL_DRY_RUN="false"

    if [ "$REAL_DRY_RUN" = "true" ]; then
        printMessageNeutral "[3/3] Real-account check (dry run — no notification is delivered)"
    else
        printMessageWarning "[3/3] Real-account check (UAT_ALLOW_REAL_SEND=true — this WILL deliver a push)"
    fi
    CHECKS_RUN=$((CHECKS_RUN + 1))

    USER_SEND_BODY="$(jq -nc \
        --arg type "$NOTIFICATION_TYPE" \
        --argjson dry "$REAL_DRY_RUN" \
        '{type: $type, dryRun: $dry, viaProductionPath: true}')"

    if ! request POST "${API_HOST}/v1/users-service/users/${UAT_USER_ID}/push-diagnostics/send-test" "$USER_SEND_BODY"; then
        fail "Could not reach the user push diagnostics endpoint."
    else
        SENT="$(printf '%s' "$RESPONSE" | jq -r '.sent // empty' 2>/dev/null)"
        REASON="$(printf '%s' "$RESPONSE" | jq -r '.reason // empty' 2>/dev/null)"
        USER_OK="$(printf '%s' "$RESPONSE" | jq -r '.result.ok // empty' 2>/dev/null)"
        USER_ERROR="$(printf '%s' "$RESPONSE" | jq -r '.result.errorCode // empty' 2>/dev/null)"

        if [ "$REASON" = "no-device-token" ]; then
            # A UAT account with no registration cannot answer the question this
            # check is asking, so it is a configuration failure rather than a
            # pipeline failure — but it must not pass silently either.
            fail "No device token registered for user ${UAT_USER_ID} under brand '${BRAND}'. Open the app on that account once, or point UAT_USER_ID at an account that has."
        elif [ "$SENT" != "true" ]; then
            fail "Send did not run (HTTP ${STATUS}). Body: $(printf '%s' "$RESPONSE" | head -c 300)"
        elif [ "$USER_OK" = "true" ]; then
            if [ "$REAL_DRY_RUN" = "true" ]; then
                pass "FCM validated a real message against a real registered token."
            else
                pass "FCM accepted a real delivery. Confirm the handset actually shows it — FCM acceptance is not delivery."
            fi
        else
            case "$USER_ERROR" in
                messaging/registration-token-not-registered)
                    fail "The registered token is stale (app reinstalled or data cleared). Reopen the app on that device to re-register."
                    ;;
                messaging/mismatched-credential)
                    fail "The service account belongs to a different Firebase project than the device token. Every push to this brand is failing."
                    ;;
                messaging/third-party-auth-error)
                    fail "Firebase has no valid APNS auth key for this iOS app, or it has expired. All iOS pushes are failing."
                    ;;
                *)
                    fail "Real-token send failed with '${USER_ERROR:-unknown}': $(printf '%s' "$RESPONSE" | jq -r '.result.errorMessage // "none"' 2>/dev/null | head -c 300)"
                    ;;
            esac
        fi
    fi
fi

echo
if [ "$FAILURES" -gt 0 ]; then
    printMessageError "Push UAT FAILED — ${FAILURES} of ${CHECKS_RUN} checks failed."
    printMessageError "Runbook: docs/PUSH_NOTIFICATIONS_DEBUGGING.md"
    exit 1
fi

printMessageSuccess "Push UAT passed (${CHECKS_RUN} checks)."
printMessageWarning "Reminder: none of this proves a device rendered a notification. Link 5 (APNS/OS"
printMessageWarning "acceptance) reports nothing back through FCM and is not observable server-side."
exit 0
