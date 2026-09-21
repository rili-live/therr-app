/**
 * Decides whether a rejected API call's own message is fit to show a user.
 *
 * The axios interceptor rejects with the response body verbatim, so `error.message` is
 * whatever the service put in it. For a 4xx that is deliberate, localized copy — "Only the
 * person who created this pact can send a nudge", "This pact has already been renewed" —
 * and it beats anything a screen could say, because it names the actual reason.
 *
 * For a 5xx it is not copy at all. Every handler in users-service funnels its server
 * errors through `handleHttpError({ err, res, message: 'SQL:<ROUTE>:ERROR' })`, where that
 * token is a grep handle for the logs, not a sentence. Screens that fell back with
 * `err?.message || translate(...)` showed it: on 2026-09-20 every check-in put
 * "SQL:HABIT_CHECKINS_ROUTES:ERROR" in a toast under "Oops! Something went wrong."
 *
 * So the rule is the status code, not the presence of a string:
 *   - no `statusCode`  → the request never reached the API (offline, DNS, timeout)
 *   - 5xx              → the server broke; that is our problem to describe, not the user's
 *                        to read
 *   - 4xx              → the API is working and is telling the user something
 *
 * Two shapes are rejected even on a 4xx, because both have reached users in this app
 * before and neither is a sentence:
 *   - an internal token (`SQL:HABIT_CHECKINS_ROUTES:ERROR`)
 *   - an unresolved dictionary path (`errorMessages.habitGoals.nameRequired`) —
 *     `configureTranslator` returns the key itself on a miss, and seven such keys were
 *     undefined in every locale until 7070c93d9 defined them
 */

/** `SQL:HABIT_CHECKINS_ROUTES:ERROR` and anything else SHOUTING_IN:COLONS. */
const INTERNAL_TOKEN = /^[A-Z][A-Z0-9_]*(:[A-Z0-9_]+)+$/;

/** `errorMessages.habitGoals.nameRequired` — a dotted path with no whitespace. */
const UNRESOLVED_DICTIONARY_KEY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;

/**
 * The API's own message when it is safe to render, otherwise an empty string — which lets a
 * call site keep its existing `getApiErrorMessage(err) || translate('...')` shape and fall
 * back to its own copy.
 */
export const getApiErrorMessage = (error: any): string => {
    const statusCode = Number(error?.statusCode);
    const message = typeof error?.message === 'string' ? error.message.trim() : '';

    if (!statusCode || !message) {
        return '';
    }

    if (statusCode < 400 || statusCode >= 500) {
        return '';
    }

    if (INTERNAL_TOKEN.test(message) || UNRESOLVED_DICTIONARY_KEY.test(message)) {
        return '';
    }

    return message;
};

export default getApiErrorMessage;
