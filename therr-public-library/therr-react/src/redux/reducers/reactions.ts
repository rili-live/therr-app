import * as Immutable from 'seamless-immutable';
import { IReactionsState, ReactionActionTypes } from '../../types/redux/reactions';

const initialState: IReactionsState = Immutable.from({
    myReactions: Immutable.from([]),
});

const reactions = (state: IReactionsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    let modifiedReactions = [...state.myReactions];

    switch (action.type) {
        // TODO: Rethink this
        case ReactionActionTypes.GET_MOMENT_REACTIONS:
            return state.setIn(['myReactions'], action.data);
        case ReactionActionTypes.MOMENT_REACTION_CREATED:
            modifiedReactions.unshift(action.data);
            return state.setIn(['myReactions'], modifiedReactions);
        case ReactionActionTypes.MOMENT_REACTION_UPDATED:
            modifiedReactions = state.myReactions.map((reaction) => { // eslint-disable-line no-case-declarations
                if (reaction.momentId === action.data.momentId) {
                    return {
                        ...reaction,
                        ...action.data,
                    };
                }

                return reaction;
            });
            return state.setIn(['myReactions'], modifiedReactions);
        default:
            return state;
    }
};

export default reactions;
