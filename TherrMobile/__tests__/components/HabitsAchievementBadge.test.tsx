import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';
import { achievementClassesByBrand } from 'therr-js-utilities/config';
import { Circle, Path, Stop } from 'react-native-svg';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';

import HabitsAchievementBadge, {
    CLASS_ART,
    FALLBACK_ART,
    getClassArt,
} from '../../main/components/Achievements/HabitsAchievementBadge';
import ChameleonFace from '../../main/components/Chameleon/ChameleonFace';
import { buildStyles as buildAchievementStyles } from '../../main/styles/achievements';

/**
 * The card art for every Friends with Habits achievement. What has to hold:
 *
 *  - every class the brand can earn has art of its own, so no class silently falls
 *    back to the generic star the way it used to fall back to the explorer's compass;
 *  - the colours are the theme's, not literals;
 *  - the chameleon is placed from the card's measured size, and an unearned card is
 *    dimmed rather than hidden.
 */
const theme = buildAchievementStyles('light');

const render = (element: React.ReactElement) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(element);
    });
    return tree!;
};

const layOut = (tree: renderer.ReactTestRenderer, testID: string, width: number, height: number) => {
    act(() => {
        tree.root.findByProps({ testID }).props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
    });
};

const flattenStyle = (style: any) => (Array.isArray(style) ? Object.assign({}, ...style.map(flattenStyle)) : style || {});

describe('HabitsAchievementBadge', () => {
    it('has art for every achievement class the Habits brand can earn', () => {
        const habitsClasses = Array.from(achievementClassesByBrand[BrandVariations.HABITS]);

        expect(habitsClasses.length).toBeGreaterThan(0);
        habitsClasses.forEach((achievementClass) => {
            expect({ achievementClass, art: CLASS_ART[achievementClass] }).toEqual({
                achievementClass,
                art: expect.objectContaining({ icon: expect.any(String), color: expect.any(String) }),
            });
        });
    });

    it('never paints two classes the same colour', () => {
        const colours = Object.values(CLASS_ART).map((art) => art.color);

        expect(new Set(colours).size).toBe(colours.length);
    });

    it('falls back to a generic card for a class it has no art for', () => {
        expect(getClassArt('somethingNew')).toBe(FALLBACK_ART);

        const tree = render(<HabitsAchievementBadge achievementClass="somethingNew" isComplete theme={theme} />);

        expect(tree.root.findByType(FontAwesome5Icon).props.name).toBe(FALLBACK_ART.icon);
    });

    it.each(Object.keys(CLASS_ART))('paints "%s" with its glyph and its theme colour', (achievementClass) => {
        const art = CLASS_ART[achievementClass];
        const tree = render(<HabitsAchievementBadge achievementClass={achievementClass} isComplete theme={theme} />);

        const glyph = tree.root.findByType(FontAwesome5Icon);
        expect(glyph.props.name).toBe(art.icon);
        expect(glyph.props.color).toBe(art.ink === 'dark' ? theme.colors.brandingBlack : theme.colors.brandingWhite);

        const groundStops = tree.root.findAllByType(Stop).map((stop) => stop.props.stopColor);
        expect(groundStops[0]).toBe(theme.colors[art.color]);
    });

    it('places the chameleon from the measured card and hangs its mouth over the edge', () => {
        const tree = render(<HabitsAchievementBadge achievementClass="habitBuilder" isComplete theme={theme} />);
        const testID = 'habits-achievement-badge-habitBuilder';

        // Nothing to place until the card has a size.
        expect(tree.root.findAllByType(ChameleonFace)).toHaveLength(0);

        layOut(tree, testID, 72, 92);

        const face = tree.root.findByType(ChameleonFace);
        const frame = flattenStyle(face.parent!.props.style);
        expect(frame.width).toBeCloseTo(72 * 0.62, 5);
        expect(frame.height).toBeCloseTo(frame.width * (580 / 800), 5);
        // Below the edge by a fraction of its own height, so the eyes stay on the card.
        expect(frame.bottom).toBeCloseTo(-frame.height * 0.3, 5);
        // Sticker outline so the face reads on a ground close to its own skin.
        expect(face.props.outline).toBe(theme.colors.brandingWhite);
    });

    it('dims a card that has not been earned yet', () => {
        const earned = render(<HabitsAchievementBadge achievementClass="consistency" isComplete theme={theme} />);
        const unearned = render(<HabitsAchievementBadge achievementClass="consistency" isComplete={false} theme={theme} />);
        const testID = 'habits-achievement-badge-consistency';

        expect(flattenStyle(earned.root.findByProps({ testID }).props.style).opacity).toBe(1);
        expect(flattenStyle(unearned.root.findByProps({ testID }).props.style).opacity).toBeLessThan(1);
    });
});

describe('ChameleonFace', () => {
    it('draws the logo in the theme palette with the brand skin by default', () => {
        const tree = render(<ChameleonFace theme={theme} />);
        const shapes = tree.root.findAll((node) => node.type === Path || node.type === Circle);
        const fills = shapes.map((shape) => shape.props.fill);

        expect(fills.filter((fill) => fill === theme.colors.brand)).toHaveLength(3);
        expect(fills).toContain(theme.colors.accent);
        expect(fills).toContain(theme.colors.brandingWhite);
        expect(fills).toContain(theme.colors.brandingBlack);
    });

    it('takes a skin colour and a sticker outline', () => {
        const tree = render(<ChameleonFace skin="#123456" outline="#ffffff" theme={theme} />);
        const paths = tree.root.findAllByType(Path);

        expect(paths.some((path) => path.props.fill === '#123456')).toBe(true);
        expect(paths.some((path) => path.props.stroke === '#ffffff' && path.props.strokeWidth > 0)).toBe(true);
    });
});
