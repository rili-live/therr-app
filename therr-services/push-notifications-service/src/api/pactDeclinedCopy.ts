/**
 * Which `pactDeclined` copy to render.
 *
 * Split out of `firebaseAdmin.ts` for the same reason as `weeklyRecapCopy.ts`: the rule can
 * then be tested without importing firebase-admin, which initializes a credential at module
 * load.
 *
 * One type carries two stories. An invitee saying no ends the invitation, so "invite someone
 * else" is the right next step. An active group member leaving does not end the pact — the
 * rest of the group is still carrying it — and telling the creator to "invite someone else to
 * keep the goal alive" reads as if it had died.
 *
 * They share a type rather than each having one because the type is what the installed apps
 * route on: a new one would reach every existing install with no tap route (Layout.tsx
 * answers `null` for a type it does not know) until a new build shipped. Reusing
 * `pactDeclined` keeps its intent action, channel and tap route, and changes only the words.
 *
 * An unrecognised reason — an older users-service, a hand-made request — falls back to the
 * decline copy, which is what this type always said.
 */

export const PACT_DECLINE_REASONS = ['memberLeft'] as const;

export type PactDeclineReason = typeof PACT_DECLINE_REASONS[number];

const KNOWN_REASONS = new Set<string>(PACT_DECLINE_REASONS);

const COPY_KEYS: Record<PactDeclineReason, string> = {
    memberLeft: 'pactMemberLeft',
};

export const selectPactDeclinedCopyKey = (reason: unknown): string => (
    typeof reason === 'string' && KNOWN_REASONS.has(reason)
        ? COPY_KEYS[reason as PactDeclineReason]
        : 'pactDeclined'
);
