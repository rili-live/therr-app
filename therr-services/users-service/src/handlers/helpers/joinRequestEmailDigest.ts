/**
 * The join-request email: one pass inside the daily habits digest.
 *
 * Asking to join an open pact (handlers/pactJoinRequests.ts) tells the creator in-app and by a
 * `pactJoinRequested` push, and that is all. A push to someone who has turned notifications off,
 * or who has stopped opening the app, reports success and is never seen — and the requester, who
 * is waiting on that answer, gives up. A stranger asking to do a habit with you is a strong reason
 * to come back, and it was being spent on a channel we cannot tell is dead.
 *
 * So this emails the creator about requests still unanswered a day later. The delay is the
 * signal: we cannot see whether a push was displayed, but a creator who saw it usually answers
 * within the day, and one who answered is never emailed.
 *
 * Bounded so it stays a fallback rather than another stream of mail:
 *   - only pending requests JOIN_REQUEST_EMAIL_MIN_AGE_HOURS..MAX_AGE_DAYS old, on pacts that can
 *     still take the requester;
 *   - once per request ever (the `emailReminderSentAt` claim), and one email per creator per run
 *     however many requests it covers;
 *   - only creators with a usable email who have not turned off `settingsEmailReminders`.
 */

import { BrandVariations } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { IUnansweredJoinRequestRow } from '../../store/PactJoinRequestsStore';
import sendPactJoinRequestEmail from '../../api/email/for-social/sendPactJoinRequestEmail';
import { JOINABLE_PACT_STATUSES } from '../../utilities/openPacts';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Long enough that the push has had its chance; a creator who saw it usually answers within the day. */
export const JOIN_REQUEST_EMAIL_MIN_AGE_HOURS = 24;

/**
 * A request older than this is not worth an email: the requester has likely moved on. It also
 * bounds the first run after deploy, when every request ever made is still unclaimed.
 */
export const JOIN_REQUEST_EMAIL_MAX_AGE_DAYS = 7;

/** Upper bound per run. Reported via `requestsCapped` rather than silently truncated. */
export const JOIN_REQUEST_EMAIL_MAX_REQUESTS = 500;

/**
 * Kill switch. Defaults **on**: the volume is bounded at one email per unanswered request. It stays
 * a flag because it is still a send, and this is the lever that stops it without a deploy.
 */
export const areJoinRequestEmailsEnabled = (): boolean => process.env.HABIT_JOIN_REQUEST_EMAILS_ENABLED !== 'false';

export interface IJoinRequestEmailCounters {
    /** Unanswered requests in the window, not yet emailed about. */
    requestsEvaluated: number;
    creatorsEmailed: number;
    /** Requests covered by the emails sent. Higher than `creatorsEmailed` when requests were rolled up. */
    requestsEmailed: number;
    /** The creator has no usable email, or turned email reminders off. Left unclaimed. */
    requestsNoChannel: number;
    /** Claimed by an overlapping run, or answered between the read and the claim. */
    requestsDeduped: number;
    emailErrors: number;
    requestsCapped: boolean;
}

export const EMPTY_JOIN_REQUEST_EMAIL_COUNTERS: IJoinRequestEmailCounters = {
    requestsEvaluated: 0,
    creatorsEmailed: 0,
    requestsEmailed: 0,
    requestsNoChannel: 0,
    requestsDeduped: 0,
    emailErrors: 0,
    requestsCapped: false,
};

export interface IJoinRequestEmailContext {
    /** Pinned by the digest. Selects the email's host context. */
    brandVariation: BrandVariations;
    whiteLabelOrigin: string;
}

const canEmail = (row: IUnansweredJoinRequestRow) => !!row.creatorEmail
    && !row.creatorIsUnclaimed
    && row.creatorSettingsEmailReminders !== false;

/** Groups rows by creator, keeping the read's oldest-first order within and across groups. */
const groupByCreator = (rows: IUnansweredJoinRequestRow[]) => rows.reduce((groups, row) => {
    const group = groups.get(row.creatorUserId) || [];
    group.push(row);
    groups.set(row.creatorUserId, group);
    return groups;
}, new Map<string, IUnansweredJoinRequestRow[]>());

export const runJoinRequestEmailPass = async (
    context: IJoinRequestEmailContext,
    now: Date = new Date(),
): Promise<IJoinRequestEmailCounters> => {
    const counters: IJoinRequestEmailCounters = { ...EMPTY_JOIN_REQUEST_EMAIL_COUNTERS };

    if (!areJoinRequestEmailsEnabled()) {
        return counters;
    }

    const rows = await Store.pactJoinRequests.getUnansweredForEmailReminder(
        new Date(now.getTime() - JOIN_REQUEST_EMAIL_MIN_AGE_HOURS * MS_PER_HOUR),
        new Date(now.getTime() - JOIN_REQUEST_EMAIL_MAX_AGE_DAYS * MS_PER_DAY),
        JOINABLE_PACT_STATUSES,
        JOIN_REQUEST_EMAIL_MAX_REQUESTS,
        now,
    );
    counters.requestsEvaluated = rows.length;
    counters.requestsCapped = rows.length >= JOIN_REQUEST_EMAIL_MAX_REQUESTS;

    // Sequential rather than concurrent: each creator is a claim and a send, and the population is
    // small. It also keeps the claim order deterministic for a reader of the logs.
    // eslint-disable-next-line no-restricted-syntax
    for (const [creatorUserId, requests] of groupByCreator(rows)) {
        const [first] = requests;
        if (!canEmail(first)) {
            counters.requestsNoChannel += requests.length;
            // eslint-disable-next-line no-continue
            continue;
        }

        try {
            // Claimed before sending, so a failed send is not retried: one missing email costs less
            // than a creator emailed twice about the same person.
            // eslint-disable-next-line no-await-in-loop
            const claimedIds = new Set(await Store.pactJoinRequests.claimEmailReminders(
                requests.map((request) => request.requestId),
            ));
            const claimed = requests.filter((request) => claimedIds.has(request.requestId));
            counters.requestsDeduped += requests.length - claimed.length;
            if (!claimed.length) {
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            await sendPactJoinRequestEmail({
                locale: first.creatorSettingsLocale || 'en-us',
                toAddresses: [first.creatorEmail as string],
                agencyDomainName: context.whiteLabelOrigin,
                brandVariation: context.brandVariation,
            }, {
                toName: first.creatorFirstName || first.creatorUserName || '',
                requests: claimed.map((request) => ({
                    requesterUserName: request.requesterUserName || '',
                    habitName: request.habitGoalName || '',
                })),
            });
            counters.creatorsEmailed += 1;
            counters.requestsEmailed += claimed.length;
        } catch (err: any) {
            counters.emailErrors += 1;
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Habits digest: join request email failed'],
                traceArgs: { 'user.id': creatorUserId, requestCount: requests.length },
            });
        }
    }

    return counters;
};
