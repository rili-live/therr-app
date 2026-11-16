import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';
import { achievementClassesByBrand, achievementsByClass } from 'therr-js-utilities/config';
import Svg, { Circle, Path, Rect, Stop } from 'react-native-svg';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';

import HabitsAchievementBadge, {
    BADGE_ASPECT,
    CLASS_ART,
    FALLBACK_ART,
    getBadgeGlyph,
    getClassArt,
} from '../../main/components/Achievements/HabitsAchievementBadge';
import { getBadgeTone } from '../../main/styles/achievements/badgePalette';
import ChameleonFace from '../../main/components/Chameleon/ChameleonFace';
import {
    EYE_SOCKET_RADIUS,
    FACE_VIEW_BOX,
    getOutlinedFaceBox,
    LEFT_EYE,
    RIGHT_EYE,
} from '../../main/components/Chameleon/geometry';

const fontAwesomeMeta = require('react-native-vector-icons/glyphmaps/FontAwesome5Free_meta.json');
import { buildStyles as buildAchievementStyles } from '../../main/styles/achievements';

/**
 * The card art for every Friends with Habits achievement. What has to hold:
 *
 *  - every class the brand can earn has art of its own, so no class silently falls
 *    back to the generic star the way it used to fall back to the explorer's compass;
 *  - every glyph named is one the bundled icon font actually has — a missing name
 *    renders a "?" on device with no error anywhere;
 *  - the three states (earned, in progress, locked) differ in what is drawn, not only
 *    in how strongly, and the level a card marks is on the card.
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

const flattenStyle = (style: any) => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flattenStyle)) : style || {});
const glyphOf = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(FontAwesome5Icon)[0];
const hostNodes = (tree: renderer.ReactTestRenderer, testID: string) => tree.root.findAll(
    (node) => typeof node.type === 'string' && node.props.testID === testID,
);

describe('HabitsAchievementBadge', () => {
    it('has art for every achievement class the Habits brand can earn', () => {
        const habitsClasses = Array.from(achievementClassesByBrand[BrandVariations.HABITS]);

        expect(habitsClasses.length).toBeGreaterThan(0);
        habitsClasses.forEach((achievementClass) => {
            expect({ achievementClass, art: CLASS_ART[achievementClass] }).toEqual({
                achievementClass,
                art: expect.objectContaining({ icon: expect.any(String) }),
            });
        });
    });

    it('only names glyphs the bundled FontAwesome 5 solid font has', () => {
        const names = [FALLBACK_ART, ...Object.values(CLASS_ART)]
            .flatMap((art) => [art.icon, ...Object.values(art.tracks || {})]);

        names.forEach((name) => {
            expect({ name, inFont: fontAwesomeMeta.solid.includes(name) }).toEqual({ name, inFont: true });
        });
    });

    it('only gives a ladder its own glyph where the class has that ladder', () => {
        Object.keys(CLASS_ART).forEach((achievementClass) => {
            const tiers = new Set(Object.values(achievementsByClass[achievementClass]).map((config) => config.tier));

            Object.keys(CLASS_ART[achievementClass].tracks || {}).forEach((track) => {
                expect({ achievementClass, track, exists: tiers.has(track) }).toEqual({ achievementClass, track, exists: true });
            });
        });
    });

    it('never paints two classes the same colour', () => {
        const colours = Object.keys(CLASS_ART).map((achievementClass) => getBadgeTone(achievementClass, theme.colors).from);

        expect(new Set(colours).size).toBe(colours.length);
    });

    it('falls back to a generic card for a class it has no art for', () => {
        expect(getClassArt('somethingNew')).toBe(FALLBACK_ART);

        const tree = render(<HabitsAchievementBadge achievementClass="somethingNew" isComplete theme={theme} />);

        expect(glyphOf(tree).props.name).toBe(FALLBACK_ART.icon);
    });

    it.each(Object.keys(CLASS_ART))('paints an earned "%s" with its glyph on its class colour', (achievementClass) => {
        const tree = render(<HabitsAchievementBadge achievementClass={achievementClass} isComplete theme={theme} />);

        expect(glyphOf(tree).props.name).toBe(CLASS_ART[achievementClass].icon);
        expect(glyphOf(tree).props.color).toBe(theme.colors.brandingWhite);

        const groundStops = tree.root.findAllByType(Stop).map((stop) => stop.props.stopColor);
        expect(groundStops[0]).toBe(getBadgeTone(achievementClass, theme.colors).from);
    });

    it('draws a secondary ladder with its own glyph', () => {
        expect(getBadgeGlyph('accountability')).toBe('handshake');
        expect(getBadgeGlyph('accountability', '1_1')).toBe('handshake');
        expect(getBadgeGlyph('accountability', '1_2')).toBe('hands-helping');

        const tree = render(<HabitsAchievementBadge achievementClass="accountability" track="1_2" isComplete theme={theme} />);

        expect(glyphOf(tree).props.name).toBe('hands-helping');
    });

    it('places the chameleon from the measured card and hangs its mouth over the edge', () => {
        const tree = render(<HabitsAchievementBadge achievementClass="habitBuilder" isComplete theme={theme} />);
        const testID = 'habits-achievement-badge-habitBuilder';

        // Nothing to place until the card has a size.
        expect(tree.root.findAllByType(ChameleonFace)).toHaveLength(0);

        layOut(tree, testID, 72, 92);

        const face = tree.root.findByType(ChameleonFace);
        const frame = flattenStyle(face.parent!.props.style);
        // The face itself spans 62% of the card; its frame is that plus room for the sticker
        // outline, which is half the outline's 36 logo units on every side.
        const faceWidth = 72 * 0.62;
        const faceHeight = faceWidth * (580 / 800);
        const bleedX = faceWidth * (18 / 800);
        const bleedY = faceHeight * (18 / 580);
        expect(frame.width).toBeCloseTo(faceWidth + bleedX * 2, 5);
        expect(frame.height).toBeCloseTo(faceHeight + bleedY * 2, 5);
        // Below the edge by a fraction of the face's own height, so the eyes stay on the card.
        expect(frame.bottom).toBeCloseTo(-faceHeight * 0.3 - bleedY, 5);
        // Sticker outline so the face reads on a ground close to its own skin.
        expect(face.props.outline).toBe(theme.colors.brandingWhite);
        expect(face.props.outlineWidth).toBe(36);
    });

    it('never puts the chameleon wider than the card it peeks over', () => {
        [40, 56, 72, 96, 132].forEach((width) => {
            const tree = render(<HabitsAchievementBadge achievementClass="habitBuilder" isComplete width={width} theme={theme} />);
            const frame = flattenStyle(tree.root.findByType(ChameleonFace).parent!.props.style);

            expect(frame.width).toBeLessThan(width);
        });
    });

    it('is complete on first render when it is told its width', () => {
        const tree = render(<HabitsAchievementBadge achievementClass="habitBuilder" isComplete width={72} theme={theme} />);
        const card = flattenStyle(tree.root.findByProps({ testID: 'habits-achievement-badge-habitBuilder' }).props.style);

        expect(card.width).toBe(72);
        expect(card.height).toBeCloseTo(72 * BADGE_ASPECT, 5);
        expect(tree.root.findAllByType(ChameleonFace)).toHaveLength(1);
    });

    it('drains a card still in progress to a tint instead of fading it', () => {
        const earned = render(<HabitsAchievementBadge achievementClass="consistency" isComplete width={72} theme={theme} />);
        const unearned = render(<HabitsAchievementBadge achievementClass="consistency" isComplete={false} width={72} theme={theme} />);
        const testID = 'habits-achievement-badge-consistency';
        const tone = getBadgeTone('consistency', theme.colors);
        const groundOf = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(Stop)[0].props.stopColor;

        // Neither card is translucent: a lowered opacity turned the art to mud on the dark theme.
        expect(flattenStyle(earned.root.findByProps({ testID }).props.style).opacity).toBeUndefined();
        expect(flattenStyle(unearned.root.findByProps({ testID }).props.style).opacity).toBeUndefined();

        expect(groundOf(earned)).toBe(tone.from);
        expect(groundOf(unearned)).not.toBe(tone.from);
        // The glyph takes the class colour once the ground has given it up.
        expect(glyphOf(unearned).props.color).toBe(tone.to);
        // Still watched by the chameleon.
        expect(unearned.root.findAllByType(ChameleonFace)).toHaveLength(1);
    });

    it('swaps the chameleon for a padlock on a locked card', () => {
        const tree = render(<HabitsAchievementBadge achievementClass="dailyStreak" state="locked" level={4} width={72} theme={theme} />);

        expect(tree.root.findAllByType(ChameleonFace)).toHaveLength(0);
        expect(hostNodes(tree, 'habits-badge-lock')).toHaveLength(1);
        // A locked card has no level to show off yet.
        expect(hostNodes(tree, 'habits-badge-level')).toHaveLength(0);
    });

    it('marks the level as a Roman numeral, and leaves it off a card too small to read it on', () => {
        const textOf = (tree: renderer.ReactTestRenderer) => tree.root
            .findAll((node) => typeof node.props.children === 'string')
            .map((node) => node.props.children);

        const tile = render(<HabitsAchievementBadge achievementClass="habitBuilder" isComplete level={4} width={72} theme={theme} />);
        expect(textOf(tile)).toContain('IV');

        const thumb = render(<HabitsAchievementBadge achievementClass="habitBuilder" isComplete level={4} width={40} theme={theme} />);
        expect(hostNodes(thumb, 'habits-badge-level')).toHaveLength(0);

        const unranked = render(<HabitsAchievementBadge achievementClass="habitBuilder" isComplete width={72} theme={theme} />);
        expect(hostNodes(unranked, 'habits-badge-level')).toHaveLength(0);
    });

    it('gives the top rung of a ladder a second keyline', () => {
        const strokesOf = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(Rect)
            .filter((rect) => rect.props.fill === 'none').length;

        const rung = render(<HabitsAchievementBadge achievementClass="resilience" isComplete level={2} width={72} theme={theme} />);
        const capstone = render(<HabitsAchievementBadge achievementClass="resilience" isComplete level={3} isCapstone width={72} theme={theme} />);
        // A capstone that has not been earned yet is not dressed as one.
        const pending = render(
            <HabitsAchievementBadge achievementClass="resilience" state="inProgress" level={3} isCapstone width={72} theme={theme} />,
        );

        expect(strokesOf(rung)).toBe(1);
        expect(strokesOf(capstone)).toBe(2);
        expect(strokesOf(pending)).toBe(1);
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

    it('grows its box to hold the outline, so the outline is never cropped at the eyes', () => {
        const viewBoxOf = (element: React.ReactElement) => render(element).root.findByType(Svg).props.viewBox;

        // Bare, the box ends exactly where the eye turrets do (x 112 → 912).
        expect(viewBoxOf(<ChameleonFace theme={theme} />)).toBe(FACE_VIEW_BOX);

        // The outline is a stroke centred on that edge: half of it lies outside the ink.
        const outlineWidth = 36;
        const [x, y, width, height] = viewBoxOf(<ChameleonFace outline="#ffffff" outlineWidth={outlineWidth} theme={theme} />)
            .split(' ').map(Number);
        const leftEdgeOfOutline = LEFT_EYE.cx - EYE_SOCKET_RADIUS - outlineWidth / 2;
        const rightEdgeOfOutline = RIGHT_EYE.cx + EYE_SOCKET_RADIUS + outlineWidth / 2;

        expect(x).toBeLessThanOrEqual(leftEdgeOfOutline);
        expect(x + width).toBeGreaterThanOrEqual(rightEdgeOfOutline);
        expect(y).toBeLessThan(200);
        expect(height).toBeGreaterThan(580);
    });

    it('reports how far the outlined box grows, for a caller sizing the frame', () => {
        expect(getOutlinedFaceBox(36)).toEqual({ viewBox: '94 182 836 616', bleedX: 18 / 800, bleedY: 18 / 580 });
        expect(getOutlinedFaceBox(0).viewBox).toBe(FACE_VIEW_BOX);
    });
});
