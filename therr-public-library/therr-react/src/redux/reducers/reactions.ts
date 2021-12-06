import * as Immutable from 'seamless-immutable';
import { IReactionsState, ReactionActionTypes } from '../../types/redux/reactions';

const initialState: IReactionsState = Immutable.from({
    myMomentReactions: Immutable.from([]),
    mySpaceReactions: Immutable.from([]),
});

const reactions = (state: IReactionsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    let modifiedMomentReactions = [...state.myMomentReactions];
    let momentReactionExists = false;

    let modifiedSpaceReactions = [...state.mySpaceReactions];
    let spaceReactionExists = false;

    switch (action.type) {
        // TODO: Rethink this for possible optimizations
        // Moments
        case ReactionActionTypes.GET_MOMENT_REACTIONS:
            return state.setIn(['myMomentReactions'], action.data);
        case ReactionActionTypes.MOMENT_REACTION_CREATED_OR_UPDATED:
            modifiedMomentReactions = modifiedMomentReactions.map((reaction) => { // eslint-disable-line no-case-declarations
                if (reaction.momentId === action.data.momentId) {
                    momentReactionExists = true;
                    return {
                        ...reaction,
                        ...action.data,
                    };
                }

                return reaction;
            });

            if (!momentReactionExists) {
                modifiedMomentReactions.unshift(action.data);
            }

            return state.setIn(['myMomentReactions'], modifiedMomentReactions);
        // Spaces
        case ReactionActionTypes.GET_SPACE_REACTIONS:
            return state.setIn(['mySpaceReactions'], action.data);
        case ReactionActionTypes.SPACE_REACTION_CREATED_OR_UPDATED:
            modifiedSpaceReactions = modifiedSpaceReactions.map((reaction) => { // eslint-disable-line no-case-declarations
                if (reaction.spaceId === action.data.spaceId) {
                    spaceReactionExists = true;
                    return {
                        ...reaction,
                        ...action.data,
                    };
                }

                return reaction;
            });

            if (!spaceReactionExists) {
                modifiedSpaceReactions.unshift(action.data);
            }

            return state.setIn(['mySpaceReactions'], modifiedSpaceReactions);
        default:
            return state;
    }
};

export default reactions;
