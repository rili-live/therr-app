import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest } from '@jest/globals';

import { AndroidChannelIds, getAndroidChannelFromClickActionId } from '../../main/constants';

// Notifee reaches for its native module at import time, which throws under Jest.
// Only the importance enum is read at module scope in main/constants.
// babel-plugin-jest-hoist lifts this above the import above.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {},
    AndroidImportance: {
        NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4,
    },
}));

/**
 * Channel routing for the HABITS push notifications.
 *
 * Every HABITS notification used to fall through to the `default` channel ("General"),
 * because `REMINDER_ACTION_KEYS` / `REWARD_ACTION_KEYS` only listed the Therr social
 * actions. The three habit-specific channels the app creates — "Habit Reminders",
 * "Streak Updates", "Friend Activity" — existed but nothing was ever routed to them,
 * so streak-at-risk and pact invites posted silently alongside everything else.
 *
 * Unlike the older pushNotifications suite (which re-implements the mapping inline),
 * this imports the real function, so a regression here fails the build.
 */

const habitsAction = (key: string) => `com.therr.mobile.habits.${key}`;
const therrAction = (key: string) => `app.therrmobile.${key}`;

describe('getAndroidChannelFromClickActionId — HABITS actions', () => {
    describe('time-sensitive nudges route to the reminders channel', () => {
        it.each([
            'STREAK_AT_RISK',
            'PACT_INVITATION',
            'PACT_NUDGE',
            'PACT_EXPIRING',
            // These three used to be OS-rendered display notifications, which
            // named their own `channelId` in the FCM payload and so never
            // reached this function. dailyHabitReminder moved to data-only so
            // Notifee could render its "Check In" action button — the display
            // path cannot carry one — which handed the channel decision here.
            // Without these entries the daily reminder posts on the
            // DEFAULT-importance "General" channel with no heads-up banner,
            // which is the whole retention loop silently degraded.
            'DAILY_HABIT_REMINDER',
            'MORNING_MOTIVATION',
            'EVENING_CHECK_IN',
        ])('%s', (key) => {
            expect(getAndroidChannelFromClickActionId(habitsAction(key)).id)
                .toBe(AndroidChannelIds.reminders);
        });
    });

    describe('milestones route to the rewardUpdates ("Streak Updates") channel', () => {
        it.each([
            'STREAK_MILESTONE',
            'NEW_PERSONAL_RECORD',
            'LEADERBOARD_RANK_MILESTONE',
        ])('%s', (key) => {
            expect(getAndroidChannelFromClickActionId(habitsAction(key)).id)
                .toBe(AndroidChannelIds.rewardUpdates);
        });
    });

    describe('partner activity routes to the contentDiscovery ("Friend Activity") channel', () => {
        it.each([
            'PARTNER_CHECKED_IN',
            'PARTNER_MISSED_DAY',
            'PARTNER_CELEBRATED',
            'PACT_ACCEPTED',
            'PACT_COMPLETED',
        ])('%s', (key) => {
            expect(getAndroidChannelFromClickActionId(habitsAction(key)).id)
                .toBe(AndroidChannelIds.contentDiscovery);
        });
    });

    it('classifies by action suffix, so a key resolves identically across brand prefixes', () => {
        expect(getAndroidChannelFromClickActionId(habitsAction('NEW_DIRECT_MESSAGE')).id)
            .toBe(getAndroidChannelFromClickActionId(therrAction('NEW_DIRECT_MESSAGE')).id);
    });

    it('still falls back to the default channel for an unrecognized action', () => {
        expect(getAndroidChannelFromClickActionId(habitsAction('SOMETHING_NEW')).id)
            .toBe(AndroidChannelIds.default);
    });

    it('tolerates a missing or malformed click action', () => {
        expect(getAndroidChannelFromClickActionId('').id).toBe(AndroidChannelIds.default);
        expect(getAndroidChannelFromClickActionId(undefined as any).id).toBe(AndroidChannelIds.default);
    });

    it('carries the channel\'s declared importance through, rather than a flat default', () => {
        // sendForegroundNotification now creates the channel with this importance instead
        // of overriding it, so a wrong value here silences the retention loop.
        const reminders = getAndroidChannelFromClickActionId(habitsAction('STREAK_AT_RISK'));
        const partnerActivity = getAndroidChannelFromClickActionId(habitsAction('PARTNER_CHECKED_IN'));

        expect(reminders.importance).toBeGreaterThan(partnerActivity.importance as number);
    });
});
