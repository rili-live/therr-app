import { produce } from 'immer';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IReactionsState, ReactionActionTypes } from '../../types/redux/reactions';
import { ContentActionTypes } from '../../types/redux/content';

const initialState: IReactionsState = {
    myEventReactions: {},
    myMomentReactions: {},
    mySpaceReactions: {},
    myThoughtReactions: {},
};

const reactions = produce((draft: IReactionsState, action: any) => {
    switch (action.type) {
        // Events
        case ReactionActionTypes.GET_EVENT_REACTIONS:
            draft.myEventReactions = action.data;
            break;
        case ReactionActionTypes.EVENT_REACTION_CREATED_OR_UPDATED:
            draft.myEventReactions[action.data.eventId] = action.data;
            break;
        case ContentActionTypes.INSERT_ACTIVE_EVENTS:
            if (action.data?.length) {
                action.data.forEach((event: any) => {
                    if (!draft.myEventReactions[event.id]) {
                        draft.myEventReactions[event.id] = {
                            eventId: event.id,
                        };
                    }
                });
            }
            break;

        // Moments
        case ReactionActionTypes.GET_MOMENT_REACTIONS:
            draft.myMomentReactions = action.data;
            break;
        case ReactionActionTypes.MOMENT_REACTION_CREATED_OR_UPDATED:
            draft.myMomentReactions[action.data.momentId] = action.data;
            break;
        case ContentActionTypes.INSERT_ACTIVE_MOMENTS:
            if (action.data?.length) {
                action.data.forEach((moment: any) => {
                    if (!draft.myMomentReactions[moment.id]) {
                        draft.myMomentReactions[moment.id] = {
                            momentId: moment.id,
                        };
                    }
                });
            }
            break;

        // Spaces
        case ReactionActionTypes.GET_SPACE_REACTIONS:
            draft.mySpaceReactions = action.data;
            break;
        case ReactionActionTypes.SPACE_REACTION_CREATED_OR_UPDATED:
            draft.mySpaceReactions[action.data.spaceId] = action.data;
            break;
        case ContentActionTypes.INSERT_ACTIVE_SPACES:
            if (action.data?.length) {
                action.data.forEach((space: any) => {
                    if (!draft.mySpaceReactions[space.id]) {
                        draft.mySpaceReactions[space.id] = {
                            spaceId: space.id,
                        };
                    }
                });
            }
            break;

        // Thoughts
        case ReactionActionTypes.GET_THOUGHT_REACTIONS:
            draft.myThoughtReactions = action.data;
            break;
        case ReactionActionTypes.THOUGHT_REACTION_CREATED_OR_UPDATED:
            draft.myThoughtReactions[action.data.thoughtId] = action.data;
            break;

        // Logout
        case SocketClientActionTypes.LOGOUT:
            draft.myEventReactions = {};
            draft.myMomentReactions = {};
            draft.mySpaceReactions = {};
            draft.myThoughtReactions = {};
            break;
        default:
            break;
    }
}, initialState);

export default reactions;
