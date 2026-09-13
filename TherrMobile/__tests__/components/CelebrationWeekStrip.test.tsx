import React from 'react';
import {
    it, describe, expect,
} from '@jest/globals';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import WeekStrip, { FROZEN_COLOR } from '../../main/components/Celebrations/WeekStrip';
import { getTheme } from '../../main/styles/themes';

/**
 * The week strip is the only place a user sees *why* a week was not perfect. A frozen day has
 * to be visually distinct from both an upheld day and a missed one — same as the rule that
 * makes it not count toward a perfect week — so these tests pin the icon and colour per status
 * rather than just "it rendered".
 */

const colors = getTheme('light').colors;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const day = (dow: number, status: string, isToday = false) => ({
    date: `2026-09-${String(7 + dow).padStart(2, '0')}`,
    dow,
    status,
    isToday,
}) as any;

const render = (days: any[]) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <WeekStrip days={days} dayLabels={DAY_LABELS} colors={colors} />,
        );
    });
    return component!;
};

const iconNames = (component: renderer.ReactTestRenderer) => component.root
    .findAllByType(MaterialIcon)
    .map((node) => node.props.name);

describe('WeekStrip', () => {
    it('renders one labelled column per day of the week', () => {
        const component = render(DAY_LABELS.map((_, dow) => day(dow, 'upheld')));

        // Icons render as <Text> too (react-native-vector-icons draws a glyph), so filter to
        // the plain string children — those are the weekday labels.
        const labels = component.root
            .findAllByType(Text)
            .map((node) => node.props.children)
            .filter((child) => typeof child === 'string');
        expect(labels).toEqual(DAY_LABELS);
    });

    it('marks upheld days with a check and frozen days with a shield', () => {
        const component = render([
            day(0, 'upheld'),
            day(1, 'frozen'),
            day(2, 'missed'),
            day(3, 'pending', true),
            day(4, 'future'),
            day(5, 'future'),
            day(6, 'future'),
        ]);

        // Only the two days that actually happened carry an icon; missed, pending and future
        // are empty circles that differ by fill and opacity.
        expect(iconNames(component)).toEqual(['check', 'shield']);
    });

    it('gives a frozen day its own colour rather than the upheld one', () => {
        const component = render([day(0, 'upheld'), day(1, 'frozen')]);

        const flatten = (style: any): any[] => (Array.isArray(style) ? style.flatMap(flatten) : [style]);
        const backgrounds = component.root
            .findAllByType(MaterialIcon)
            .map((icon) => flatten(icon.parent!.props.style)
                .filter(Boolean)
                .reduce((acc: any, entry: any) => ({ ...acc, ...entry }), {}).backgroundColor);

        expect(backgrounds[0]).toBe(colors.brand);
        expect(backgrounds[1]).toBe(FROZEN_COLOR);
        expect(backgrounds[0]).not.toBe(backgrounds[1]);
    });
});
