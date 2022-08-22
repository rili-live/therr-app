import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IReactionsState, ReactionActionTypes } from '../../types/redux/reactions';

const initialState: IReactionsState = Immutable.from({
    myMomentReactions: Immutable.from({}), // mapMomentIdToReactions
    mySpaceReactions: Immutable.from({}), // mapSpaceIdToReactions
});

const reactions = (state: IReactionsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    const modifiedMomentReactions = { ...state.myMomentReactions };

    const modifiedSpaceReactions = { ...state.mySpaceReactions };

    switch (action.type) {
        // Moments
        case ReactionActionTypes.GET_MOMENT_REACTIONS:
            return state.setIn(['myMomentReactions'], action.data);
        case ReactionActionTypes.MOMENT_REACTION_CREATED_OR_UPDATED:
            modifiedMomentReactions[action.data.momentId] = action.data;

            return state.setIn(['myMomentReactions'], modifiedMomentReactions);

        // Spaces
        case ReactionActionTypes.GET_SPACE_REACTIONS:
            return state.setIn(['mySpaceReactions'], action.data);
        case ReactionActionTypes.SPACE_REACTION_CREATED_OR_UPDATED:
            modifiedSpaceReactions[action.data.momentId] = action.data;

            return state.setIn(['mySpaceReactions'], modifiedSpaceReactions);
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['myMomentReactions'], Immutable.from({})).setIn(['mySpaceReactions'], Immutable.from({}));
        default:
            return state;
    }
};

export default reactions;
