/**
 * Open pacts — the rules for which pacts strangers may ask to join, and what "the same habit" is.
 *
 * Kept as pure functions so the handler, the store query and the digest's suggestion pass cannot
 * disagree about either question. See migrations 20261005000001-3 for the schema.
 */

/**
 * The most people an open pact can hold, counting the creator and every invite still pending. The
 * same ceiling the invite flow already implies (the creator plus MAX_BULK_INVITEES): a pact is an
 * accountability circle, and a stranger-filled pact of twenty is a group chat, not a pact.
 */
export const MAX_OPEN_PACT_MEMBERS = 6;

/** Unanswered requests one user may have outstanding at a time — enough to shop around, not to spam. */
export const MAX_PENDING_JOIN_REQUESTS_PER_USER = 3;

/** Pacts that can still take a new member. An ended cycle cannot, however its flag was left. */
export const JOINABLE_PACT_STATUSES = ['pending', 'active'];

/** Upper bound on one listing. The surface is a short list of suggestions, not a directory. */
export const OPEN_PACTS_LIST_LIMIT = 20;

export interface IHabitMatchKey {
    /** The template the habit is (or was cloned from). Language-neutral, so it matches across locales. */
    templateKey: string | null;
    /** Lower-cased, trimmed, whitespace-collapsed name. Matches custom habits, and clones made before
     * `sourceTemplateKey` existed. Empty when the goal has no name, which matches nothing. */
    normalizedName: string;
}

export const normalizeHabitName = (name?: string | null): string => (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * What "the same habit" means for a goal. A template row matches on its own key; a clone on the key
 * of the template it came from; anything else on its name. Two goals match when their template keys
 * are equal, or their normalized names are (see PactsStore.getOpenPacts).
 */
export const getHabitMatchKey = (goal: {
    name?: string | null;
    templateKey?: string | null;
    sourceTemplateKey?: string | null;
}): IHabitMatchKey => ({
    templateKey: goal.templateKey || goal.sourceTemplateKey || null,
    normalizedName: normalizeHabitName(goal.name),
});

export const isPactJoinable = (pact: {
    isOpen?: boolean | null;
    status?: string;
    endDate?: Date | string | null;
}, now: Date = new Date()): boolean => {
    if (!pact.isOpen || !JOINABLE_PACT_STATUSES.includes(pact.status || '')) {
        return false;
    }
    if (!pact.endDate) {
        return true;
    }
    return new Date(pact.endDate).getTime() > now.getTime();
};

/**
 * Which unanswered pacts the digest prompts about. A pact whose invites have sat unanswered for
 * three days is unlikely to be answered at all — most accepts land within a day — but three weeks on
 * the creator has moved on, and a prompt about it reads as spam rather than help.
 */
export const OPEN_SUGGESTION_MIN_AGE_DAYS = 3;
export const OPEN_SUGGESTION_MAX_AGE_DAYS = 21;

/** Once per pact, ever: the claim on `openSuggestionSentAt` enforces it, and the key mirrors it. */
export const openPactSuggestionDedupeKey = (pactId: string): string => `open-pact-suggestion:${pactId}`;
