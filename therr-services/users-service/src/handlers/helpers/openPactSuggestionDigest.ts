/**
 * The open-pact suggestion: one pass inside the daily habits digest.
 *
 * A creator whose invitees never answered has a pact that will never start. If someone else has an
 * open pact on the same habit, the creator is told once — by push when they have the Habits app
 * registered, by email otherwise — that they could ask to join it instead. Asking sends a request to
 * that pact's creator (handlers/pactJoinRequests.ts); nothing is joined automatically.
 *
 * Bounded so it stays a supplement rather than another stream of nudges:
 *   - only first-cycle pacts unanswered for OPEN_SUGGESTION_MIN_AGE_DAYS..MAX_AGE_DAYS;
 *   - only when an open pact on the same habit actually has room;
 *   - once per pact ever (the `openSuggestionSentAt` claim), and at most one per creator per run;
 *   - the push respects `settingsPushHabitReminders`, the email `settingsEmailReminders`.
 */

import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { IStalePendingPactRow } from '../../store/PactsStore';
import sendOpenPactSuggestionEmail from '../../api/email/for-social/sendOpenPactSuggestionEmail';
import { resolveReminderSchedule } from '../../utilities/localReminderSchedule';
import {
    getHabitMatchKey,
    OPEN_SUGGESTION_MAX_AGE_DAYS,
    OPEN_SUGGESTION_MIN_AGE_DAYS,
    openPactSuggestionDedupeKey,
} from '../../utilities/openPacts';
import translate from '../../utilities/translator';
import { QueueRecapFn } from './weeklyRecapDigest';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Kill switch. Defaults **on**: the volume is bounded at one message per unanswered pact, ever. It
 * stays a flag because it is still a send, and this is the lever that stops it without a deploy.
 */
export const areOpenPactSuggestionsEnabled = (): boolean => process.env.HABIT_OPEN_PACT_SUGGESTIONS_ENABLED !== 'false';

/** Upper bound per run. Reported via `stalePactsCapped` rather than silently truncated. */
export const OPEN_SUGGESTION_MAX_PACTS = 500;

/** How many candidate open pacts to read per stale pact. One with room is all the prompt needs. */
const OPEN_PACT_CANDIDATES = 5;

export interface IOpenPactSuggestionCounters {
    /** Unanswered first-cycle pacts in the window, not yet prompted about. */
    stalePactsEvaluated: number;
    /** No open pact on the same habit had room (or the creator had already asked every one). */
    suggestionsNoOpenMatch: number;
    suggestionsQueued: number;
    suggestionsEmailed: number;
    /** Claimed by an overlapping run, or already queued. A second run of the day lands here. */
    suggestionsDeduped: number;
    /** Neither channel reached them — no Habits device and no usable email, or both muted. */
    suggestionsNoChannel: number;
    /** A second unanswered pact by a creator already prompted this run; left for a later run. */
    suggestionsDeferredSameUser: number;
    suggestionErrors: number;
    stalePactsCapped: boolean;
}

export const EMPTY_OPEN_PACT_SUGGESTION_COUNTERS: IOpenPactSuggestionCounters = {
    stalePactsEvaluated: 0,
    suggestionsNoOpenMatch: 0,
    suggestionsQueued: 0,
    suggestionsEmailed: 0,
    suggestionsDeduped: 0,
    suggestionsNoChannel: 0,
    suggestionsDeferredSameUser: 0,
    suggestionErrors: 0,
    stalePactsCapped: false,
};

export interface IOpenPactSuggestionContext {
    /** Pinned by the digest. Selects both the device token and the email's host context. */
    brandVariation: BrandVariations;
    whiteLabelOrigin: string;
}

const canEmail = (pact: IStalePendingPactRow) => !!pact.email
    && !pact.isUnclaimed
    && pact.settingsEmailReminders !== false;

export const runOpenPactSuggestionPass = async (
    queuePush: QueueRecapFn,
    context: IOpenPactSuggestionContext,
    now: Date = new Date(),
): Promise<IOpenPactSuggestionCounters> => {
    const counters: IOpenPactSuggestionCounters = { ...EMPTY_OPEN_PACT_SUGGESTION_COUNTERS };

    if (!areOpenPactSuggestionsEnabled()) {
        return counters;
    }

    const stalePacts = await Store.pacts.getStalePendingForOpenSuggestion(
        new Date(now.getTime() - OPEN_SUGGESTION_MIN_AGE_DAYS * MS_PER_DAY),
        new Date(now.getTime() - OPEN_SUGGESTION_MAX_AGE_DAYS * MS_PER_DAY),
        OPEN_SUGGESTION_MAX_PACTS,
    );
    counters.stalePactsEvaluated = stalePacts.length;
    counters.stalePactsCapped = stalePacts.length >= OPEN_SUGGESTION_MAX_PACTS;
    if (!stalePacts.length) {
        return counters;
    }

    // One prompt per creator per run: the rows are oldest first, so their oldest unanswered pact
    // goes now and any other waits for a later run (each is still prompted about at most once).
    const seenCreators = new Set<string>();
    const firstPerCreator = stalePacts.filter((pact) => {
        if (seenCreators.has(pact.creatorUserId)) {
            counters.suggestionsDeferredSameUser += 1;
            return false;
        }
        seenCreators.add(pact.creatorUserId);
        return true;
    });

    const creatorIds = firstPerCreator.map((pact) => pact.creatorUserId);
    const [preferencesByUserId, deviceTokens] = await Promise.all([
        Store.users.getHabitReminderPreferences(creatorIds),
        Store.userDeviceTokens.getTokensForUsers(context.brandVariation, creatorIds),
    ]);
    const creatorsWithDevice = new Set((deviceTokens || []).map((row: any) => row.userId));

    // Sequential rather than concurrent: each pact does a read and a claim, and the population is
    // small. It also keeps the claim order deterministic for a reader of the logs.
    // eslint-disable-next-line no-restricted-syntax
    for (const pact of firstPerCreator) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const candidates = await Store.pacts.getOpenPacts(pact.creatorUserId, getHabitMatchKey({
                name: pact.habitGoalName,
                templateKey: pact.templateKey,
                sourceTemplateKey: pact.sourceTemplateKey,
            }), OPEN_PACT_CANDIDATES);
            const available = candidates.filter((candidate) => !candidate.hasPendingJoinRequest);
            if (!available.length) {
                counters.suggestionsNoOpenMatch += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            const preferences = preferencesByUserId[pact.creatorUserId] || {};
            const canPush = creatorsWithDevice.has(pact.creatorUserId)
                && preferences.settingsPushHabitReminders !== false;
            if (!canPush && !canEmail(pact)) {
                counters.suggestionsNoChannel += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            const claimed = await Store.pacts.claimOpenSuggestion(pact.pactId);
            if (!claimed) {
                counters.suggestionsDeduped += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            if (canPush) {
                const schedule = resolveReminderSchedule(preferences, now);
                // eslint-disable-next-line no-await-in-loop
                const outcome = await queuePush(
                    pact.creatorUserId,
                    PushNotifications.Types.openPactSuggestion,
                    openPactSuggestionDedupeKey(pact.pactId),
                    {
                        pactId: pact.pactId,
                        habitGoalId: pact.habitGoalId,
                        habitName: pact.habitGoalName || '',
                    },
                    schedule.morningAt,
                );
                if (outcome === 'queued') {
                    counters.suggestionsQueued += 1;
                } else if (outcome === 'duplicate') {
                    counters.suggestionsDeduped += 1;
                } else {
                    counters.suggestionErrors += 1;
                }
                // eslint-disable-next-line no-continue
                continue;
            }

            const locale = pact.settingsLocale || 'en-us';
            // eslint-disable-next-line no-await-in-loop
            await sendOpenPactSuggestionEmail({
                subject: translate(locale, 'emails.openPactSuggestion.subject', { habitName: pact.habitGoalName || '' }),
                locale,
                toAddresses: [pact.email as string],
                agencyDomainName: context.whiteLabelOrigin,
                brandVariation: context.brandVariation,
            }, {
                toName: pact.firstName || pact.userName || '',
                habitName: pact.habitGoalName || '',
            });
            counters.suggestionsEmailed += 1;
        } catch (err: any) {
            counters.suggestionErrors += 1;
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Habits digest: failed to suggest an open pact'],
                traceArgs: {
                    'user.id': pact.creatorUserId,
                    'pact.id': pact.pactId,
                    'pushNotification.brandVariation': String(context.brandVariation),
                },
            });
        }
    }

    return counters;
};
