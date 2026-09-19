import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';
import { Switch } from 'react-native-paper';

import {
    it, describe, expect, jest,
} from '@jest/globals';

/**
 * Per-habit notification switches.
 *
 * The rule worth a test is "absent means On". All four columns are NOT NULL
 * DEFAULT true server-side, so a habit row without them came from a response
 * predating the columns — not from a user who opted out. Rendering absent as Off
 * would tell someone their reminders are disabled while they keep arriving, and
 * the first toggle would then write the `false` the screen invented and make the
 * lie true. `routes/Settings/pushPreferences.ts` documents the same trap for the
 * account-wide columns; this is the per-habit half of it.
 *
 * The second is that a failed write reverts. An optimistic switch that sticks
 * after a rejection is worse than a slow one — it reports a setting the server
 * never took.
 */

import HabitNotificationSettings from '../../main/components/Habits/HabitNotificationSettings';
import { buildStyles as buildHabitStyles } from '../../main/styles/habits';

const themeHabits = buildHabitStyles('light');

const translate = (key: string) => key;

const baseHabit: any = {
    id: 'uh-1',
    habitGoalId: 'goal-1',
    goalName: 'Morning run',
    status: 'active',
};

const render = (props: any = {}) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <HabitNotificationSettings
                userHabit={baseHabit}
                onChange={jest.fn(() => Promise.resolve({})) as any}
                themeHabits={themeHabits as any}
                translate={translate}
                {...props}
            />,
        );
    });
    // @ts-ignore — assigned inside act
    return component as renderer.ReactTestRenderer;
};

const switchValues = (component: renderer.ReactTestRenderer) => component.root
    .findAllByType(Switch)
    .map((s) => s.props.value);

describe('HabitNotificationSettings', () => {
    it('renders a habit with no notify* fields as fully opted in', () => {
        const component = render();

        expect(switchValues(component)).toEqual([true, true, true, true]);
    });

    it('renders an explicit false as off, and leaves the others on', () => {
        const component = render({
            userHabit: { ...baseHabit, notifyPartnerActivity: false },
        });

        // Order is USER_HABIT_NOTIFICATION_CATEGORIES: reminders, streak alerts,
        // partner activity, pact updates.
        expect(switchValues(component)).toEqual([true, true, false, true]);
    });

    it('sends only the category that changed', async () => {
        const onChange = jest.fn(() => Promise.resolve({}));
        const component = render({ onChange: onChange as any });

        await act(async () => {
            component.root.findAllByType(Switch)[0].props.onValueChange();
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('notifyReminders', false);
    });

    it('reverts the flip when the write fails', async () => {
        // The store never took the value, so the switch must not claim it did.
        const onChange = jest.fn(() => Promise.reject(new Error('offline')));
        const component = render({ onChange: onChange as any });

        await act(async () => {
            component.root.findAllByType(Switch)[0].props.onValueChange();
        });

        expect(switchValues(component)).toEqual([true, true, true, true]);
    });

    it('keeps the new value after a successful write', async () => {
        // The parent re-renders from the store in the real app; here the prop is
        // unchanged, so this pins that a success does not leave a stale override
        // fighting whatever the store now says.
        const component = render({
            userHabit: { ...baseHabit, notifyReminders: false },
            onChange: jest.fn(() => Promise.resolve({})) as any,
        });

        await act(async () => {
            component.root.findAllByType(Switch)[0].props.onValueChange();
        });

        expect(switchValues(component)[0]).toBe(false);
    });

    it('renders nothing until the tracking row has loaded', () => {
        // This screen is a push deep-link target, so the first render regularly
        // has no tracking row. Switches with no id to address would be a lie.
        const component = render({ userHabit: undefined });

        expect(component.root.findAllByType(Switch)).toHaveLength(0);
    });
});
