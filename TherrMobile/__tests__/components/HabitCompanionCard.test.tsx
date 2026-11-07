import 'react-native';
import React from 'react';
// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';
// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';
import { Path } from 'react-native-svg';
import HabitCompanionCard from '../../main/components/HabitCompanion/HabitCompanionCard';
import { COMPANION_STAGES } from '../../main/utilities/companionGrowth';
import { buildStyles as buildAchievementStyles } from '../../main/styles/achievements';
import translator from '../../main/utilities/translator';

/**
 * Renders the habit companion card the way the Achievements screen does and checks what a
 * user sees: the stage name, what the next stage needs, and that tapping the chameleon
 * recolors it.
 */

const themeAchievements = buildAchievementStyles();
const translate = (key: string, params?: any) => translator('en-us', key, params);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const completed = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [
    `a${i}`,
    { id: `a${i}`, achievementClass: 'habitBuilder', completedAt: daysAgo(1) },
]));

const render = (achievementCount: number, ageDays: number) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(
            <HabitCompanionCard
                achievements={completed(achievementCount)}
                accountCreatedAt={daysAgo(ageDays)}
                brandVariation={BrandVariations.HABITS}
                themeAchievements={themeAchievements}
                translate={translate}
            />,
        );
    });
    return tree!;
};

const allText = (tree: renderer.ReactTestRenderer) => tree.root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string);

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('HabitCompanionCard', () => {
    it('shows an egg and what it takes to hatch for a brand-new account', () => {
        const tree = render(0, 0);
        const text = allText(tree);
        expect(text).toContain('Egg');
        expect(text).toContain('Stage 1 of 5');
        expect(text).toContain('Next: Hatchling');
        expect(text).toContain('Achievements: 0 / 1');
        // Hatching has no age floor, so no days requirement is shown.
        expect(text.some((t) => t.startsWith('Days together'))).toBe(false);
        act(() => tree.unmount());
    });

    it('shows both requirements once the next stage has an age floor', () => {
        const tree = render(2, 3);
        const text = allText(tree);
        expect(text).toContain('Hatchling');
        expect(text).toContain('Next: Little Climber');
        expect(text).toContain('Achievements: 2 / 4');
        expect(text).toContain('Days together: 3 / 7');
        act(() => tree.unmount());
    });

    it('drops the requirements at the final stage', () => {
        const final = COMPANION_STAGES[COMPANION_STAGES.length - 1];
        const tree = render(final.minAchievements, final.minAccountAgeDays + 1);
        const text = allText(tree);
        expect(text).toContain('Rainbow Legend');
        expect(text).toContain(translate('components.habitCompanion.fullyGrown'));
        expect(text.some((t) => t.startsWith('Next:'))).toBe(false);
        act(() => tree.unmount());
    });

    it('changes color when the chameleon is tapped', () => {
        const tree = render(1, 1);
        const bodyColors = () => tree.root.findAllByType(Path).map((p) => p.props.fill).sort().join(',');
        const before = bodyColors();
        act(() => {
            // The sprite is the card's only button.
            tree.root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0]
                .props.onPress();
        });
        expect(bodyColors()).not.toBe(before);
        act(() => tree.unmount());
    });
});
