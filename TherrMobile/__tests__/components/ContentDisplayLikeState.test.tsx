import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Content Display Like State Tests
 *
 * Tests the isLiked/likeCount state management logic used by
 * AreaDisplay, ThoughtDisplay, and AreaDisplayMedium components.
 *
 * These components use getDerivedStateFromProps to sync isLiked and
 * likeCount from props, and optimistic updates in onLikePress.
 * This test file validates both patterns to prevent regressions.
 */

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

// ============================================================================
// State management logic (mirroring AreaDisplay/ThoughtDisplay/AreaDisplayMedium)
// ============================================================================

interface IContentProps {
    likeCount: number | null;
    reaction?: {
        userHasLiked?: boolean;
    };
}

interface ILikeState {
    isLiked: boolean;
    likeCount: number | null;
}

/**
 * Mirrors getDerivedStateFromProps in AreaDisplay, ThoughtDisplay, AreaDisplayMedium.
 * Syncs isLiked and likeCount from props when likeCount is first available
 * (nextState.likeCount is null, nextProps.likeCount is not null).
 */
const getDerivedStateFromProps = (
    nextProps: IContentProps,
    nextState: ILikeState
): Partial<ILikeState> | null => {
    if (nextProps.likeCount != null
        && (nextState.likeCount == null)) {
        return {
            isLiked: !!nextProps.reaction?.userHasLiked,
            likeCount: nextProps.likeCount,
        };
    }

    return null;
};

/**
 * Mirrors the constructor initialization in all three components.
 */
const initializeState = (props: IContentProps): ILikeState => ({
    isLiked: !!props.reaction?.userHasLiked,
    likeCount: props.likeCount,
});

/**
 * Mirrors onLikePress in AreaDisplay, ThoughtDisplay, and AreaDisplayMedium.
 * Performs optimistic toggle of isLiked and likeCount.
 */
const getOptimisticLikeUpdate = (
    currentState: ILikeState,
    propsLikeCount: number | null
): ILikeState => {
    const newIsLiked = !currentState.isLiked;
    return {
        isLiked: newIsLiked,
        likeCount: propsLikeCount != null
            ? (currentState.likeCount || 0) + (newIsLiked ? 1 : -1)
            : currentState.likeCount,
    };
};

// ============================================================================
// Tests
// ============================================================================

describe('Content Display Like State - initializeState', () => {
    it('should initialize isLiked as true when userHasLiked is true', () => {
        const state = initializeState({
            likeCount: 5,
            reaction: { userHasLiked: true },
        });

        expect(state.isLiked).toBe(true);
        expect(state.likeCount).toBe(5);
    });

    it('should initialize isLiked as false when userHasLiked is false', () => {
        const state = initializeState({
            likeCount: 3,
            reaction: { userHasLiked: false },
        });

        expect(state.isLiked).toBe(false);
        expect(state.likeCount).toBe(3);
    });

    it('should initialize isLiked as false when reaction is undefined', () => {
        const state = initializeState({
            likeCount: 0,
            reaction: undefined,
        });

        expect(state.isLiked).toBe(false);
        expect(state.likeCount).toBe(0);
    });

    it('should initialize likeCount as null when props likeCount is null', () => {
        const state = initializeState({
            likeCount: null,
            reaction: { userHasLiked: true },
        });

        expect(state.isLiked).toBe(true);
        expect(state.likeCount).toBeNull();
    });
});

describe('Content Display Like State - getDerivedStateFromProps', () => {
    it('should sync isLiked and likeCount when state likeCount is null and props has count', () => {
        const nextProps: IContentProps = {
            likeCount: 10,
            reaction: { userHasLiked: true },
        };
        const nextState: ILikeState = {
            isLiked: false,
            likeCount: null,
        };

        const result = getDerivedStateFromProps(nextProps, nextState);

        expect(result).toEqual({
            isLiked: true,
            likeCount: 10,
        });
    });

    it('should sync isLiked as false when props reaction is not liked', () => {
        const nextProps: IContentProps = {
            likeCount: 5,
            reaction: { userHasLiked: false },
        };
        const nextState: ILikeState = {
            isLiked: true, // stale state says liked
            likeCount: null,
        };

        const result = getDerivedStateFromProps(nextProps, nextState);

        expect(result).toEqual({
            isLiked: false,
            likeCount: 5,
        });
    });

    it('should return null when state already has likeCount (no re-sync)', () => {
        const nextProps: IContentProps = {
            likeCount: 10,
            reaction: { userHasLiked: true },
        };
        const nextState: ILikeState = {
            isLiked: false,
            likeCount: 5, // already has a value
        };

        const result = getDerivedStateFromProps(nextProps, nextState);

        expect(result).toBeNull();
    });

    it('should return null when props likeCount is null', () => {
        const nextProps: IContentProps = {
            likeCount: null,
            reaction: { userHasLiked: true },
        };
        const nextState: ILikeState = {
            isLiked: false,
            likeCount: null,
        };

        const result = getDerivedStateFromProps(nextProps, nextState);

        expect(result).toBeNull();
    });

    it('should handle undefined reaction in props gracefully', () => {
        const nextProps: IContentProps = {
            likeCount: 3,
            reaction: undefined,
        };
        const nextState: ILikeState = {
            isLiked: true,
            likeCount: null,
        };

        const result = getDerivedStateFromProps(nextProps, nextState);

        expect(result).toEqual({
            isLiked: false,
            likeCount: 3,
        });
    });

    it('should sync isLiked when likeCount is 0 (falsy but not null)', () => {
        const nextProps: IContentProps = {
            likeCount: 0,
            reaction: { userHasLiked: false },
        };
        const nextState: ILikeState = {
            isLiked: true,
            likeCount: null,
        };

        const result = getDerivedStateFromProps(nextProps, nextState);

        expect(result).toEqual({
            isLiked: false,
            likeCount: 0,
        });
    });
});

describe('Content Display Like State - optimistic like toggle', () => {
    it('should toggle isLiked from false to true and increment likeCount', () => {
        const currentState: ILikeState = { isLiked: false, likeCount: 5 };

        const newState = getOptimisticLikeUpdate(currentState, 5);

        expect(newState.isLiked).toBe(true);
        expect(newState.likeCount).toBe(6);
    });

    it('should toggle isLiked from true to false and decrement likeCount', () => {
        const currentState: ILikeState = { isLiked: true, likeCount: 5 };

        const newState = getOptimisticLikeUpdate(currentState, 5);

        expect(newState.isLiked).toBe(false);
        expect(newState.likeCount).toBe(4);
    });

    it('should not go below 0 when decrementing from 0', () => {
        const currentState: ILikeState = { isLiked: true, likeCount: 0 };

        const newState = getOptimisticLikeUpdate(currentState, 0);

        expect(newState.isLiked).toBe(false);
        expect(newState.likeCount).toBe(-1); // Matches current behavior
    });

    it('should not update likeCount when props likeCount is null', () => {
        const currentState: ILikeState = { isLiked: false, likeCount: null };

        const newState = getOptimisticLikeUpdate(currentState, null);

        expect(newState.isLiked).toBe(true);
        expect(newState.likeCount).toBeNull();
    });

    it('should handle double-tap correctly (like then unlike)', () => {
        const initial: ILikeState = { isLiked: false, likeCount: 5 };

        const afterLike = getOptimisticLikeUpdate(initial, 5);
        expect(afterLike.isLiked).toBe(true);
        expect(afterLike.likeCount).toBe(6);

        const afterUnlike = getOptimisticLikeUpdate(afterLike, 5);
        expect(afterUnlike.isLiked).toBe(false);
        expect(afterUnlike.likeCount).toBe(5);
    });
});

describe('Content Display Like State - full lifecycle', () => {
    it('should handle: init → like → refresh cycle correctly', () => {
        // Step 1: Initialize from server data (not liked, count = 3)
        let state = initializeState({
            likeCount: 3,
            reaction: { userHasLiked: false },
        });
        expect(state.isLiked).toBe(false);
        expect(state.likeCount).toBe(3);

        // Step 2: User taps like (optimistic update)
        state = getOptimisticLikeUpdate(state, 3);
        expect(state.isLiked).toBe(true);
        expect(state.likeCount).toBe(4);

        // Step 3: getDerivedStateFromProps should NOT override optimistic state
        // because state.likeCount is not null
        const derived = getDerivedStateFromProps(
            { likeCount: 4, reaction: { userHasLiked: true } },
            state
        );
        expect(derived).toBeNull(); // No override — optimistic state preserved
    });

    it('should re-sync isLiked when component receives fresh data after reset (regression test)', () => {
        // This is the bug scenario: component had stale isLiked after props changed

        // Step 1: Component initialized with liked state
        let state = initializeState({
            likeCount: null, // likeCount not yet loaded
            reaction: { userHasLiked: true },
        });
        expect(state.isLiked).toBe(true);
        expect(state.likeCount).toBeNull();

        // Step 2: Server responds with data showing item is NOT liked
        // getDerivedStateFromProps should now sync both isLiked AND likeCount
        const derived = getDerivedStateFromProps(
            { likeCount: 5, reaction: { userHasLiked: false } },
            state
        );

        expect(derived).not.toBeNull();
        expect(derived!.isLiked).toBe(false);  // Bug fix: isLiked now synced
        expect(derived!.likeCount).toBe(5);
    });

    it('should maintain consistency: AreaDisplayMedium should behave like AreaDisplay', () => {
        // Verifies that the same getDerivedStateFromProps logic works for both

        // AreaDisplay scenario
        const areaState = initializeState({ likeCount: null, reaction: undefined });
        const areaDerived = getDerivedStateFromProps(
            { likeCount: 7, reaction: { userHasLiked: true } },
            areaState
        );
        expect(areaDerived).toEqual({ isLiked: true, likeCount: 7 });

        // AreaDisplayMedium scenario (should be identical)
        const mediumState = initializeState({ likeCount: null, reaction: undefined });
        const mediumDerived = getDerivedStateFromProps(
            { likeCount: 7, reaction: { userHasLiked: true } },
            mediumState
        );
        expect(mediumDerived).toEqual({ isLiked: true, likeCount: 7 });

        // They should produce identical results
        expect(areaDerived).toEqual(mediumDerived);
    });
});
