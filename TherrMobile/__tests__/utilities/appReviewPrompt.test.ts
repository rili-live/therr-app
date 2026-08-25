// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach } from '@jest/globals';

import {
    DAYS_BETWEEN_PROMPTS,
    IAppReviewPromptState,
    MAX_LIFETIME_PROMPTS,
    MIN_DAYS_SINCE_FIRST_SIGNAL,
    MIN_POSITIVE_SIGNALS,
    isEligibleForReviewPrompt,
    markReviewPromptCompleted,
    markReviewPromptDeclined,
    markReviewPromptShown,
    readReviewPromptState,
    recordPositiveSignal,
    resetReviewPromptStateForTesting,
    shouldShowReviewPrompt,
} from '../../main/utilities/appReviewPrompt';

/**
 * App Review Prompt Tests
 *
 * `components/Layout.tsx` shows the review modal purely on the verdict of these rules, so
 * the failure this file guards is a prompt that appears too early, too often, or after the
 * user already told us where they stand. An over-eager prompt is not a cosmetic bug: it is
 * the reliable way to collect one-star reviews.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 24);

const buildState = (overrides: Partial<IAppReviewPromptState> = {}): IAppReviewPromptState => ({
    firstSignalAt: NOW - ((MIN_DAYS_SINCE_FIRST_SIGNAL + 1) * DAY_MS),
    positiveSignalCount: MIN_POSITIVE_SIGNALS,
    promptCount: 0,
    status: 'pending',
    ...overrides,
});

describe('isEligibleForReviewPrompt', () => {
    it('is eligible once the signal count and the waiting period are both satisfied', () => {
        expect(isEligibleForReviewPrompt(buildState(), NOW)).toBe(true);
    });

    it('is not eligible before any delight moment has been recorded', () => {
        // Also the shape a failed or corrupt storage read degrades to.
        expect(isEligibleForReviewPrompt(undefined, NOW)).toBe(false);
    });

    it('is not eligible below the signal threshold', () => {
        expect(isEligibleForReviewPrompt(
            buildState({ positiveSignalCount: MIN_POSITIVE_SIGNALS - 1 }),
            NOW,
        )).toBe(false);
    });

    it('is not eligible on the same day as the first delight moment', () => {
        // A user posting three moments in their first ten minutes is exploring, not attached.
        expect(isEligibleForReviewPrompt(
            buildState({ firstSignalAt: NOW, positiveSignalCount: 10 }),
            NOW,
        )).toBe(false);
    });

    it('is not eligible until the full waiting period has elapsed', () => {
        const oneHourShort = NOW - (MIN_DAYS_SINCE_FIRST_SIGNAL * DAY_MS) + (60 * 60 * 1000);

        expect(isEligibleForReviewPrompt(buildState({ firstSignalAt: oneHourShort }), NOW)).toBe(false);
        expect(isEligibleForReviewPrompt(
            buildState({ firstSignalAt: NOW - (MIN_DAYS_SINCE_FIRST_SIGNAL * DAY_MS) }),
            NOW,
        )).toBe(true);
    });

    it('stays quiet for the full re-prompt interval after a prompt was shown', () => {
        expect(isEligibleForReviewPrompt(
            buildState({ promptCount: 1, lastPromptedAt: NOW - DAY_MS }),
            NOW,
        )).toBe(false);
        expect(isEligibleForReviewPrompt(
            buildState({ promptCount: 1, lastPromptedAt: NOW - ((DAYS_BETWEEN_PROMPTS - 1) * DAY_MS) }),
            NOW,
        )).toBe(false);
        expect(isEligibleForReviewPrompt(
            buildState({ promptCount: 1, lastPromptedAt: NOW - (DAYS_BETWEEN_PROMPTS * DAY_MS) }),
            NOW,
        )).toBe(true);
    });

    it('stops asking after the lifetime cap, however long ago the last prompt was', () => {
        expect(isEligibleForReviewPrompt(
            buildState({
                promptCount: MAX_LIFETIME_PROMPTS,
                lastPromptedAt: NOW - (10 * DAYS_BETWEEN_PROMPTS * DAY_MS),
            }),
            NOW,
        )).toBe(false);
    });

    it('never asks again once the user has reviewed or opted out', () => {
        expect(isEligibleForReviewPrompt(buildState({ status: 'reviewed' }), NOW)).toBe(false);
        expect(isEligibleForReviewPrompt(buildState({ status: 'declined' }), NOW)).toBe(false);
    });

    it('is not silenced permanently by a stored prompt date in the future', () => {
        // A device clock that moved backwards would otherwise suppress the prompt until the
        // bogus date arrives. The lifetime cap still bounds how often it can be asked.
        expect(isEligibleForReviewPrompt(
            buildState({ promptCount: 1, lastPromptedAt: NOW + (365 * DAY_MS) }),
            NOW,
        )).toBe(true);
    });
});

describe('review prompt state persistence', () => {
    beforeEach(async () => {
        await resetReviewPromptStateForTesting();
    });

    it('counts signals and anchors the waiting period on the first one', async () => {
        const firstAt = NOW - (10 * DAY_MS);

        await recordPositiveSignal('momentShared', firstAt);
        await recordPositiveSignal('achievementClaimed', NOW);
        const state = await readReviewPromptState();

        expect(state?.positiveSignalCount).toBe(2);
        expect(state?.firstSignalAt).toBe(firstAt);
        expect(state?.lastSignal).toBe('achievementClaimed');
        expect(state?.status).toBe('pending');
    });

    it('re-anchors when the stored first-signal date is in the future', async () => {
        await recordPositiveSignal('momentShared', NOW + (365 * DAY_MS));
        await recordPositiveSignal('momentShared', NOW);

        expect((await readReviewPromptState())?.firstSignalAt).toBe(NOW);
    });

    it('does not surface a prompt until the rules are met, then does', async () => {
        const firstAt = NOW - ((MIN_DAYS_SINCE_FIRST_SIGNAL + 1) * DAY_MS);

        await recordPositiveSignal('momentShared', firstAt);
        expect(await shouldShowReviewPrompt(NOW)).toBe(false);

        for (let i = 1; i < MIN_POSITIVE_SIGNALS; i += 1) {
            await recordPositiveSignal('momentShared', firstAt);
        }

        expect(await shouldShowReviewPrompt(NOW)).toBe(true);
    });

    it('starts the quiet period when the prompt is shown, not when it is answered', async () => {
        await recordPositiveSignal('momentShared', NOW - (30 * DAY_MS));
        await markReviewPromptShown(NOW);

        const state = await readReviewPromptState();
        expect(state?.promptCount).toBe(1);
        expect(state?.lastPromptedAt).toBe(NOW);
        expect(state?.status).toBe('pending');
    });

    it('never asks again after the user is sent to the store', async () => {
        await recordPositiveSignal('momentShared', NOW - (30 * DAY_MS));
        await markReviewPromptCompleted(NOW);

        expect((await readReviewPromptState())?.status).toBe('reviewed');
        expect(await shouldShowReviewPrompt(NOW + (10 * 365 * DAY_MS))).toBe(false);
    });

    it('never asks again after the user says they are not enjoying the app', async () => {
        await recordPositiveSignal('momentShared', NOW - (30 * DAY_MS));
        await markReviewPromptDeclined(NOW);

        expect((await readReviewPromptState())?.status).toBe('declined');
        expect(await shouldShowReviewPrompt(NOW + (10 * 365 * DAY_MS))).toBe(false);
    });

    it('does not let later signals revive a terminal status', async () => {
        await recordPositiveSignal('momentShared', NOW - (30 * DAY_MS));
        await markReviewPromptDeclined(NOW);
        await recordPositiveSignal('momentShared', NOW);

        const state = await readReviewPromptState();
        expect(state?.status).toBe('declined');
        expect(state?.positiveSignalCount).toBe(1);
    });
});
