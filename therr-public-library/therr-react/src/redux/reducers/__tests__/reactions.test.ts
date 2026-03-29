import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import reducer from '../reactions';
import { ReactionActionTypes } from '../../../types/redux/reactions';
import { ContentActionTypes } from '../../../types/redux/content';

describe('reactions reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(initialState.myEventReactions).toBeDefined();
        expect(initialState.myMomentReactions).toBeDefined();
        expect(initialState.mySpaceReactions).toBeDefined();
        expect(initialState.myThoughtReactions).toBeDefined();
    });

    // Events
    it('handles GET_EVENT_REACTIONS', () => {
        const data = { event1: { eventId: 'event1', rating: 5 } };
        const result = reducer(initialState, {
            type: ReactionActionTypes.GET_EVENT_REACTIONS,
            data,
        });
        expect(result.myEventReactions).toEqual(data);
    });

    it('handles EVENT_REACTION_CREATED_OR_UPDATED', () => {
        const result = reducer(initialState, {
            type: ReactionActionTypes.EVENT_REACTION_CREATED_OR_UPDATED,
            data: { eventId: 'e1', rating: 4 },
        });
        expect(result.myEventReactions.e1.rating).toBe(4);
    });

    it('handles INSERT_ACTIVE_EVENTS adding placeholder reactions', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1' }, { id: 'e2' }],
        });
        expect(result.myEventReactions.e1).toEqual({ eventId: 'e1' });
        expect(result.myEventReactions.e2).toEqual({ eventId: 'e2' });
    });

    it('INSERT_ACTIVE_EVENTS does not overwrite existing reactions', () => {
        const withReaction = reducer(initialState, {
            type: ReactionActionTypes.EVENT_REACTION_CREATED_OR_UPDATED,
            data: { eventId: 'e1', rating: 5 },
        });
        const result = reducer(withReaction, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1' }],
        });
        expect(result.myEventReactions.e1.rating).toBe(5);
    });

    // Moments
    it('handles GET_MOMENT_REACTIONS', () => {
        const data = { m1: { momentId: 'm1' } };
        const result = reducer(initialState, {
            type: ReactionActionTypes.GET_MOMENT_REACTIONS,
            data,
        });
        expect(result.myMomentReactions).toEqual(data);
    });

    it('handles MOMENT_REACTION_CREATED_OR_UPDATED', () => {
        const result = reducer(initialState, {
            type: ReactionActionTypes.MOMENT_REACTION_CREATED_OR_UPDATED,
            data: { momentId: 'm1', rating: 3 },
        });
        expect(result.myMomentReactions.m1.rating).toBe(3);
    });

    it('handles INSERT_ACTIVE_MOMENTS adding placeholder reactions', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_MOMENTS,
            data: [{ id: 'm1' }],
        });
        expect(result.myMomentReactions.m1).toEqual({ momentId: 'm1' });
    });

    // Spaces
    it('handles GET_SPACE_REACTIONS', () => {
        const data = { s1: { spaceId: 's1' } };
        const result = reducer(initialState, {
            type: ReactionActionTypes.GET_SPACE_REACTIONS,
            data,
        });
        expect(result.mySpaceReactions).toEqual(data);
    });

    it('handles SPACE_REACTION_CREATED_OR_UPDATED', () => {
        const result = reducer(initialState, {
            type: ReactionActionTypes.SPACE_REACTION_CREATED_OR_UPDATED,
            data: { spaceId: 's1', rating: 2 },
        });
        expect(result.mySpaceReactions.s1.rating).toBe(2);
    });

    it('handles INSERT_ACTIVE_SPACES adding placeholder reactions', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_SPACES,
            data: [{ id: 's1' }],
        });
        expect(result.mySpaceReactions.s1).toEqual({ spaceId: 's1' });
    });

    // Thoughts
    it('handles GET_THOUGHT_REACTIONS', () => {
        const data = { t1: { thoughtId: 't1' } };
        const result = reducer(initialState, {
            type: ReactionActionTypes.GET_THOUGHT_REACTIONS,
            data,
        });
        expect(result.myThoughtReactions).toEqual(data);
    });

    it('handles THOUGHT_REACTION_CREATED_OR_UPDATED', () => {
        const result = reducer(initialState, {
            type: ReactionActionTypes.THOUGHT_REACTION_CREATED_OR_UPDATED,
            data: { thoughtId: 't1', rating: 1 },
        });
        expect(result.myThoughtReactions.t1.rating).toBe(1);
    });

    // Logout
    it('handles LOGOUT by clearing all reactions', () => {
        const populated = reducer(initialState, {
            type: ReactionActionTypes.EVENT_REACTION_CREATED_OR_UPDATED,
            data: { eventId: 'e1', rating: 5 },
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(Object.keys(result.myEventReactions)).toHaveLength(0);
        expect(Object.keys(result.myMomentReactions)).toHaveLength(0);
        expect(Object.keys(result.mySpaceReactions)).toHaveLength(0);
        expect(Object.keys(result.myThoughtReactions)).toHaveLength(0);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
