/**
 * Reading a failed send to push-notifications-service.
 *
 * WHY THIS EXISTS
 *
 * The push service's single-send route answers 502 whenever FCM's result is not
 * ok, and puts FCM's own reason in the body: `{ errorCode, errorMessage }`. The
 * notification queue used to store only the axios message, so for months every
 * failed habits row read "Request failed with status code 502" whatever FCM had
 * actually said. On 2026-10-28 that was 712 failed rows in 30 days with no way to
 * tell a dead token from a credentials outage from a payload bug without going to
 * the push service's logs. The body is the diagnosis; this keeps it.
 */

export interface IPushSendError {
    /** HTTP status of the push-service response, when there was one. */
    status?: number;
    /** FCM's error code (`messaging/...`) or the push service's own routing code. */
    errorCode?: string;
    errorMessage?: string;
    /** What the queue stores in `lastError`. Bounded to the column's working size. */
    summary: string;
}

const MAX_SUMMARY_LENGTH = 500;

export const describePushSendError = (err: any): IPushSendError => {
    const status: number | undefined = typeof err?.response?.status === 'number' ? err.response.status : undefined;
    const body = err?.response?.data;
    const errorCode = typeof body?.errorCode === 'string' && body.errorCode ? body.errorCode : undefined;
    const errorMessage = typeof body?.errorMessage === 'string' && body.errorMessage ? body.errorMessage : undefined;

    // Without a structured body (push service unreachable, timeout, a 500 from its
    // error handler) the axios message is all there is, so it is kept verbatim —
    // including the "status code 502" wording, which the runbook's SQL matches on.
    const fallback = String(err?.message || err || 'unknown error');
    const summary = errorCode
        ? `push ${status ?? '?'} ${errorCode}${errorMessage ? `: ${errorMessage}` : ''}`
        : fallback;

    return {
        status,
        errorCode,
        errorMessage,
        summary: summary.slice(0, MAX_SUMMARY_LENGTH),
    };
};

/**
 * Is this a send FCM refused because the device token itself is dead?
 *
 * The answer that matters for the queue: a dead token fails identically on every
 * retry, so retrying it only burns attempts and buries real failures, and the
 * registration should go so the next row skips as 'no-device-token'.
 *
 * `messaging/invalid-argument` is deliberately narrowed to a message that names
 * the registration token. FCM returns INVALID_ARGUMENT for a malformed *message*
 * too (a bad Android colour, an oversize payload), and a payload bug reaching
 * every recipient would otherwise delete every recipient's token in one digest
 * run. The push service's own cleanup applies the same rule — see
 * `isInvalidTokenError` in push-notifications-service/src/api/firebaseAdmin.ts.
 */
const ALWAYS_DEAD_TOKEN_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
]);

export const isDeadDeviceTokenError = ({ errorCode, errorMessage }: Pick<IPushSendError, 'errorCode' | 'errorMessage'>): boolean => {
    if (!errorCode) return false;
    if (ALWAYS_DEAD_TOKEN_CODES.has(errorCode)) return true;
    return errorCode === 'messaging/invalid-argument' && /registration token/i.test(errorMessage || '');
};
