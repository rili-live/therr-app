import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { normalizeContentAlgorithm } from 'therr-js-utilities/content-ranking';
import { clearDistributorRun } from '../store/redisClient';
import { resetThoughtRelevance } from '../api/reactions';

/**
 * Rebuilds a user's stream after they switch content algorithms.
 *
 * Two things have to happen, and neither may fail the settings save that triggered them:
 *
 *  1. **Discard the old scores.** A relevance score is only comparable within the profile
 *     that produced it — PULSE weights the hot term at 1.0 while FOCUS weights it at 0.3 and
 *     adds an interest term — so the previously-activated rows are reset to NULL rather than
 *     interleaved with new ones. The feed read path already sorts NULLs last, so they sink
 *     below freshly-scored activations instead of disappearing.
 *  2. **Release the distributor gate.** That gate throttles the distributor to one run per
 *     user per window so it does not fire on every notifications poll. Immediately after a
 *     switch the throttle is exactly wrong — the user is waiting to see the new algorithm
 *     take effect — so the window is released and the next poll re-seeds.
 *
 * Called for its side effects and deliberately not awaited. Worst case on failure is a stale
 * ordering that the next distributor run corrects on its own, which is a far better outcome
 * than 500ing a profile save because Redis blipped.
 */
const handleContentAlgorithmChange = (
    headers: InternalConfigHeaders,
    userId: string,
    previousValue: any,
    requestedValue: any,
): void => {
    // `undefined` means the request did not touch this setting at all — every other field on
    // the settings screen submits alongside it, so a no-op save must not reset the stream.
    if (!userId || requestedValue === undefined || requestedValue === null) {
        return;
    }

    // Compare normalized, so a legacy NULL column reading as the default does not register as
    // a change when the user re-saves the default they were already on.
    if (normalizeContentAlgorithm(requestedValue) === normalizeContentAlgorithm(previousValue)) {
        return;
    }

    const onFailure = (issue: string) => (err: any) => {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, issue],
            traceArgs: {
                'user.id': userId,
                'content.algorithm': String(requestedValue),
            },
        });
    };

    Promise.resolve(resetThoughtRelevance(headers))
        .catch(onFailure('Failed to reset thought relevance scores after a content algorithm change'));

    // clearDistributorRun swallows its own errors, so this catch is belt-and-braces against a
    // future change making it throw synchronously.
    Promise.resolve(clearDistributorRun(userId))
        .catch(onFailure('Failed to clear the thought distributor gate after a content algorithm change'));
};

export default handleContentAlgorithmChange;
