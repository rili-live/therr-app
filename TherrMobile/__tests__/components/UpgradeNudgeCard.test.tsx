import 'react-native';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

import { logEvent } from '@react-native-firebase/analytics';
import UpgradeNudgeCard from '../../main/components/Habits/UpgradeNudgeCard';
import { buildStyles as buildHabitsStyles } from '../../main/styles/habits';

const themeHabits = buildHabitsStyles('light') as any;

const renderCard = (props: any = {}) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <UpgradeNudgeCard
                source="dashboard-capacity"
                title="All 5 free habits in use"
                body="Unlock unlimited habits and pacts, once, for life."
                onPress={() => {}}
                themeHabits={themeHabits}
                {...props}
            />,
        );
    });

    // @ts-ignore - assigned synchronously inside act
    return component as renderer.ReactTestRenderer;
};

const findButton = (component: renderer.ReactTestRenderer) => component.root.findAll(
    (node: any) => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function',
)[0];

/**
 * The one row every path to the paywall renders. What matters is that each
 * surface counts its impressions under its own name — click-through per
 * surface is the number the whole PR exists to produce — and that the row is
 * one tap with both lines announced.
 */
describe('UpgradeNudgeCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('logs one impression per mount, tagged with the surface', () => {
        const component = renderCard({ source: 'weekly-recap' });

        const impressions = (logEvent as jest.Mock).mock.calls
            .filter((call: any[]) => call[1] === 'habits_upgrade_nudge_view');
        expect(impressions).toHaveLength(1);
        expect(impressions[0][2]).toEqual({ source: 'weekly-recap' });

        // A re-render is not a second impression.
        act(() => {
            component.update(
                <UpgradeNudgeCard
                    source="weekly-recap"
                    title="changed"
                    body="changed"
                    onPress={() => {}}
                    themeHabits={themeHabits}
                />,
            );
        });
        expect((logEvent as jest.Mock).mock.calls
            .filter((call: any[]) => call[1] === 'habits_upgrade_nudge_view')).toHaveLength(1);
    });

    it('is one button that announces both lines and fires onPress', () => {
        const onPress = jest.fn();
        const component = renderCard({ onPress });
        const button = findButton(component);

        expect(button.props.accessibilityLabel)
            .toBe('All 5 free habits in use. Unlock unlimited habits and pacts, once, for life.');

        act(() => {
            button.props.onPress();
        });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('takes the standalone card surface only for the card variant', () => {
        const strip = findButton(renderCard()).props.style({ pressed: false });
        const card = findButton(renderCard({ variant: 'card' })).props.style({ pressed: false });

        expect(strip).toContain(themeHabits.styles.upgradeNudge);
        expect(strip).not.toContain(themeHabits.styles.upgradeNudgeCard);
        expect(card).toContain(themeHabits.styles.upgradeNudgeCard);
    });
});
