import 'react-native';
import React from 'react';
// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';
// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';
import CompanionStageUpHero from '../../main/components/HabitCompanion/CompanionStageUpHero';
import { getTheme } from '../../main/styles/themes';

/**
 * The stage-up hero must end on the new stage and say so exactly once, whether it animates or
 * (under Reduce Motion) skips straight to it — the celebration screen waits on `onRevealed`.
 */

const { colors } = getTheme();

const isButton = (node: renderer.ReactTestInstance) => node.props.accessibilityRole === 'button'
    && typeof node.props.onPress === 'function';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('CompanionStageUpHero', () => {
    it('reveals the new stage immediately under Reduce Motion', () => {
        const onRevealed = jest.fn();
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <CompanionStageUpHero
                    fromStageId="egg"
                    stageId="hatchling"
                    themeColors={colors}
                    size={120}
                    isReduceMotionEnabled
                    accessibilityLabel="Hatchling"
                    onRevealed={onRevealed}
                />,
            );
        });
        expect(onRevealed).toHaveBeenCalledTimes(1);
        // Revealed = the ordinary tappable chameleon.
        expect(tree!.root.findAll(isButton)).toHaveLength(1);
        act(() => tree!.unmount());
    });

    it('animates from the old stage to the new one, then hands over to the tappable chameleon', () => {
        const onRevealed = jest.fn();
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <CompanionStageUpHero
                    fromStageId="juvenile"
                    stageId="adult"
                    themeColors={colors}
                    size={120}
                    isReduceMotionEnabled={false}
                    accessibilityLabel="Chameleon"
                    onRevealed={onRevealed}
                />,
            );
        });
        expect(onRevealed).not.toHaveBeenCalled();
        expect(tree!.root.findAll(isButton)).toHaveLength(0);

        act(() => {
            jest.advanceTimersByTime(3000);
        });
        expect(onRevealed).toHaveBeenCalledTimes(1);
        expect(tree!.root.findAll(isButton)).toHaveLength(1);
        act(() => tree!.unmount());
    });
});
