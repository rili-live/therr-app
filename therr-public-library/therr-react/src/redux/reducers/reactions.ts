import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IReactionsState, ReactionActionTypes } from '../../types/redux/reactions';
import { ContentActionTypes } from '../../types/redux/content';

const initialState: IReactionsState = Immutable.from({
    myEventReactions: Immutable.from({}), // mapEventIdToReactions
    myMomentReactions: Immutable.from({}), // mapMomentIdToReactions
    mySpaceReactions: Immutable.from({}), // mapSpaceIdToReactions
    myThoughtReactions: Immutable.from({}), // mapThoughtIdToReactions
});

const reactions = (state: IReactionsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    const modifiedEventReactions = { ...state.myEventReactions };

    const modifiedMomentReactions = { ...state.myMomentReactions };

    const modifiedSpaceReactions = { ...state.mySpaceReactions };

    const modifiedThoughtReactions = { ...state.myThoughtReactions };

    switch (action.type) {
        // Events
        case ReactionActionTypes.GET_EVENT_REACTIONS:
            return state.setIn(['myEventReactions'], action.data);
        case ReactionActionTypes.EVENT_REACTION_CREATED_OR_UPDATED:
            modifiedEventReactions[action.data.eventId] = action.data;

            return state.setIn(['myEventReactions'], modifiedEventReactions);
        case ContentActionTypes.INSERT_ACTIVE_EVENTS:
            if (action.data?.length) {
                action.data.forEach((event: any) => {
                    if (!modifiedEventReactions[event.id]) {
                        // Add a placeholder reaction without needing to fetch from server
                        // This allows us to display the area on the map as activated
                        modifiedEventReactions[event.id] = {
                            eventId: event.id,
                        };
                    }
                });
            }

            return state.setIn(['myEventReactions'], modifiedEventReactions);

        // Moments
        case ReactionActionTypes.GET_MOMENT_REACTIONS:
            return state.setIn(['myMomentReactions'], action.data);
        case ReactionActionTypes.MOMENT_REACTION_CREATED_OR_UPDATED:
            modifiedMomentReactions[action.data.momentId] = action.data;

            return state.setIn(['myMomentReactions'], modifiedMomentReactions);
        case ContentActionTypes.INSERT_ACTIVE_MOMENTS:
            if (action.data?.length) {
                action.data.forEach((moment: any) => {
                    if (!modifiedMomentReactions[moment.id]) {
                        // Add a placeholder reaction without needing to fetch from server
                        // This allows us to display the area on the map as activated
                        modifiedMomentReactions[moment.id] = {
                            momentId: moment.id,
                        };
                    }
                });
            }

            return state.setIn(['myMomentReactions'], modifiedMomentReactions);

        // Spaces
        case ReactionActionTypes.GET_SPACE_REACTIONS:
            return state.setIn(['mySpaceReactions'], action.data);
        case ReactionActionTypes.SPACE_REACTION_CREATED_OR_UPDATED:
            modifiedSpaceReactions[action.data.spaceId] = action.data;

            return state.setIn(['mySpaceReactions'], modifiedSpaceReactions);
        case ContentActionTypes.INSERT_ACTIVE_SPACES:
            if (action.data?.length) {
                action.data.forEach((space: any) => {
                    if (!modifiedSpaceReactions[space.id]) {
                        // Add a placeholder reaction without needing to fetch from server
                        // This allows us to display the area on the map as activated
                        modifiedSpaceReactions[space.id] = {
                            spaceId: space.id,
                        };
                    }
                });
            }

            return state.setIn(['mySpaceReactions'], modifiedSpaceReactions);

        // Thoughts
        case ReactionActionTypes.GET_THOUGHT_REACTIONS:
            return state.setIn(['myThoughtReactions'], action.data);
        case ReactionActionTypes.THOUGHT_REACTION_CREATED_OR_UPDATED:
            modifiedThoughtReactions[action.data.thoughtId] = action.data;

            return state.setIn(['myThoughtReactions'], modifiedThoughtReactions);

        // Logout
        case SocketClientActionTypes.LOGOUT:
            return state
                .setIn(['myEventReactions'], Immutable.from({}))
                .setIn(['myMomentReactions'], Immutable.from({}))
                .setIn(['mySpaceReactions'], Immutable.from({}))
                .setIn(['myThoughtReactions'], Immutable.from({}));
        default:
            return state;
    }
};

export default reactions;
