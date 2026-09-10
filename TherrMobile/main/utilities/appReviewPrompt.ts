import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Decides when to ask the user for an app-store review.
 *
 * Two halves, deliberately separated: `isEligibleForReviewPrompt` is a pure function of
 * persisted state and the current time (unit tested), and everything else is a thin,
 * failure-tolerant AsyncStorage wrapper around it. Storage errors are always swallowed —
 * a review prompt is the least important thing in the app and must never break the flow
 * that recorded the signal (posting a moment, claiming a reward).
 *
 * Sentiment first, store second: the modal asks whether the user is enjoying the app before
 * it mentions a review, and only the "yes" branch links out to the store. That ordering is
 * why this uses store deep links rather than the native in-app review APIs — both Apple's
 * SKStoreReviewController and Google's In-App Review API forbid gating their prompt behind a
 * satisfaction question, and Google additionally throttles its own quota invisibly. See
 * `appStoreReviewLink.ts` for the link side.
 */

export const APP_REVIEW_PROMPT_STORAGE_KEY = 'appReviewPromptState';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Delight moments the user has to hit before we are willing to ask for anything. */
export const MIN_POSITIVE_SIGNALS = 3;
/**
 * Time from the *first* delight moment before the first prompt. A user who posts three
 * moments in their first ten minutes is exploring, not yet attached, and an install-day
 * prompt is the classic way to earn a one-star review.
 */
export const MIN_DAYS_SINCE_FIRST_SIGNAL = 3;
/** Quiet period after any prompt the user did not act on. */
export const DAYS_BETWEEN_PROMPTS = 90;
/** Total times we will ever ask someone who keeps deferring. */
export const MAX_LIFETIME_PROMPTS = 3;

export type AppReviewPromptStatus =
    /** Still askable. */
    | 'pending'
    /** Sent to the store listing — never ask again on this install. */
    | 'reviewed'
    /** Said they are not enjoying the app, or opted out — never ask again on this install. */
    | 'declined';

export interface IAppReviewPromptState {
    /** Epoch ms of the first recorded delight moment; anchors the "not on install day" gate. */
    firstSignalAt: number;
    positiveSignalCount: number;
    promptCount: number;
    /** Epoch ms the modal was last shown, absent until the first prompt. */
    lastPromptedAt?: number;
    /** Most recent delight moment, kept so a support session can tell why a prompt appeared. */
    lastSignal?: AppReviewSignal;
    status: AppReviewPromptStatus;
}

/**
 * Signal names are recorded for analytics/debugging only — every signal counts the same.
 * Keep these to moments the user chose and completed, not to passive engagement.
 */
export type AppReviewSignal = 'momentShared' | 'achievementClaimed';

const buildInitialState = (nowMs: number): IAppReviewPromptState => ({
    firstSignalAt: nowMs,
    positiveSignalCount: 0,
    promptCount: 0,
    status: 'pending',
});

/**
 * Whether the modal may be shown right now, given persisted state.
 *
 * Undefined state means no delight moment has been recorded yet, which is not eligible —
 * that is also what a failed or corrupt read degrades to.
 */
export const isEligibleForReviewPrompt = (
    state: IAppReviewPromptState | undefined,
    nowMs: number,
): boolean => {
    if (!state || state.status !== 'pending') {
        return false;
    }

    if (state.promptCount >= MAX_LIFETIME_PROMPTS) {
        return false;
    }

    if (state.positiveSignalCount < MIN_POSITIVE_SIGNALS) {
        return false;
    }

    if (nowMs - state.firstSignalAt < MIN_DAYS_SINCE_FIRST_SIGNAL * DAY_MS) {
        return false;
    }

    // A negative gap means the stored stamp is in the future — a device clock that moved
    // backwards (NTP correction, or a user winding it forward and back). Suppressing on that
    // would silence the prompt until the bogus date arrives, so treat it as elapsed instead;
    // MAX_LIFETIME_PROMPTS still bounds how often a drifting clock can be asked.
    const msSinceLastPrompt = state.lastPromptedAt === undefined ? undefined : nowMs - state.lastPromptedAt;
    if (msSinceLastPrompt !== undefined
        && msSinceLastPrompt >= 0
        && msSinceLastPrompt < DAYS_BETWEEN_PROMPTS * DAY_MS) {
        return false;
    }

    return true;
};

const isValidState = (parsed: any): parsed is IAppReviewPromptState => !!parsed
    && typeof parsed.firstSignalAt === 'number'
    && typeof parsed.positiveSignalCount === 'number'
    && typeof parsed.promptCount === 'number';

export const readReviewPromptState = async (): Promise<IAppReviewPromptState | undefined> => {
    try {
        const raw = await AsyncStorage.getItem(APP_REVIEW_PROMPT_STORAGE_KEY);
        if (!raw) {
            return undefined;
        }

        const parsed = JSON.parse(raw);

        return isValidState(parsed) ? parsed : undefined;
    } catch {
        // Unreadable or corrupt: treat as "no signals yet" rather than surfacing an error.
        return undefined;
    }
};

const writeReviewPromptState = async (state: IAppReviewPromptState): Promise<void> => {
    try {
        await AsyncStorage.setItem(APP_REVIEW_PROMPT_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Best effort. Losing a write costs at most one deferred prompt.
    }
};

const updateReviewPromptState = async (
    apply: (state: IAppReviewPromptState) => IAppReviewPromptState,
    nowMs: number,
): Promise<IAppReviewPromptState | undefined> => {
    const existing = await readReviewPromptState();
    // A terminal status is never revived — not by later signals, not by a reinstalled
    // listener. Only clearing app storage resets it.
    if (existing && existing.status !== 'pending') {
        return existing;
    }

    const next = apply(existing || buildInitialState(nowMs));
    await writeReviewPromptState(next);

    return next;
};

/**
 * Record a moment the user is likely to feel good about. Cheap and fire-and-forget:
 * call sites should not await this or branch on it.
 */
export const recordPositiveSignal = (
    signal: AppReviewSignal,
    nowMs: number = Date.now(),
): Promise<IAppReviewPromptState | undefined> => updateReviewPromptState((state) => ({
    ...state,
    // Re-anchor if the stored stamp is in the future, so a clock that moved backwards cannot
    // hold the "not on install day" gate closed forever.
    firstSignalAt: Math.min(state.firstSignalAt, nowMs),
    positiveSignalCount: state.positiveSignalCount + 1,
    lastSignal: signal,
}), nowMs);

/** Whether the prompt should be shown at this moment. */
export const shouldShowReviewPrompt = async (nowMs: number = Date.now()): Promise<boolean> => {
    const state = await readReviewPromptState();

    return isEligibleForReviewPrompt(state, nowMs);
};

/** The modal was displayed. Starts the quiet period whether or not the user acts on it. */
export const markReviewPromptShown = (nowMs: number = Date.now()): Promise<IAppReviewPromptState | undefined> => (
    updateReviewPromptState((state) => ({
        ...state,
        promptCount: state.promptCount + 1,
        lastPromptedAt: nowMs,
    }), nowMs)
);

/** The user was sent to the store listing. Terminal — never ask again on this install. */
export const markReviewPromptCompleted = (nowMs: number = Date.now()): Promise<IAppReviewPromptState | undefined> => (
    updateReviewPromptState((state) => ({
        ...state,
        status: 'reviewed',
    }), nowMs)
);

/** The user said they are not enjoying the app, or opted out. Terminal. */
export const markReviewPromptDeclined = (nowMs: number = Date.now()): Promise<IAppReviewPromptState | undefined> => (
    updateReviewPromptState((state) => ({
        ...state,
        status: 'declined',
    }), nowMs)
);

/** Test helper — clears persisted state so a suite can start from a known point. */
export const resetReviewPromptStateForTesting = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(APP_REVIEW_PROMPT_STORAGE_KEY);
    } catch {
        // no-op
    }
};
