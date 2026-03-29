import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import reducer from '../userInterface';
import { UserInterfaceActionTypes } from '../../../types/redux/userInterface';

describe('userInterface reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(initialState.details).toBeDefined();
        expect(initialState.details.lastClickedTargetId).toBe('');
    });

    it('handles UPDATE_CLICK_TARGET', () => {
        const result = reducer(initialState, {
            type: UserInterfaceActionTypes.UPDATE_CLICK_TARGET,
            data: 'target-123',
        });
        expect(result.details.lastClickedTargetId).toBe('target-123');
    });

    it('handles UPDATE_CLICK_TARGET with subsequent update', () => {
        const first = reducer(initialState, {
            type: UserInterfaceActionTypes.UPDATE_CLICK_TARGET,
            data: 'target-1',
        });
        const second = reducer(first, {
            type: UserInterfaceActionTypes.UPDATE_CLICK_TARGET,
            data: 'target-2',
        });
        expect(second.details.lastClickedTargetId).toBe('target-2');
    });

    it('handles LOGOUT by resetting details', () => {
        const populated = reducer(initialState, {
            type: UserInterfaceActionTypes.UPDATE_CLICK_TARGET,
            data: 'target-123',
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(result.details.lastClickedTargetId).toBe('');
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
