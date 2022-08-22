import { ReactionActionTypes } from '../../types/redux/reactions';
import ReactionsService, {
    ICreateOrUpdateAreaReactionBody,
    IGetMomentReactionParams,
    IFindMomentReactionParams,
    IGetSpaceReactionParams,
    IFindSpaceReactionParams,
} from '../../services/ReactionsService';

const Reactions = {
    // Moments
    createOrUpdateMomentReaction: (momentId: number, data: ICreateOrUpdateAreaReactionBody) => (dispatch: any) => ReactionsService
        .createOrUpdateMomentReaction(momentId, data).then((response: any) => {
            dispatch({
                type: ReactionActionTypes.MOMENT_REACTION_CREATED_OR_UPDATED,
                data: response.data,
            });
        }),
    getMomentReactions: (query: IGetMomentReactionParams) => (dispatch: any) => ReactionsService.getMomentReactions(query)
        .then((response: any) => {
            dispatch({
                type: ReactionActionTypes.GET_MOMENT_REACTIONS,
                data: response.data,
            });
        }),
    findMomentReactions: (params: IFindMomentReactionParams) => (dispatch: any) => ReactionsService.findMomentReactions(params)
        .then((response: any) => {
            const reactionsById = {};

            (response.data?.reactions || []).forEach((reaction) => {
                reactionsById[reaction.momentId] = reaction;
            });
            dispatch({
                type: ReactionActionTypes.GET_MOMENT_REACTIONS,
                data: reactionsById,
            });
        }),

    // Spaces
    createOrUpdateSpaceReaction: (spaceId: number, data: ICreateOrUpdateAreaReactionBody) => (dispatch: any) => ReactionsService
        .createOrUpdateSpaceReaction(spaceId, data).then((response: any) => {
            dispatch({
                type: ReactionActionTypes.SPACE_REACTION_CREATED_OR_UPDATED,
                data: response.data,
            });
        }),
    getSpaceReactions: (query: IGetSpaceReactionParams) => (dispatch: any) => ReactionsService.getSpaceReactions(query)
        .then((response: any) => {
            dispatch({
                type: ReactionActionTypes.GET_SPACE_REACTIONS,
                data: response.data,
            });
        }),
    findSpaceReactions: (query: IFindSpaceReactionParams) => (dispatch: any) => ReactionsService.findSpaceReactions(query)
        .then((response: any) => {
            const reactionsById = {};

            (response.data?.reactions || []).forEach((reaction) => {
                reactionsById[reaction.momentId] = reaction;
            });
            dispatch({
                type: ReactionActionTypes.GET_SPACE_REACTIONS,
                data: reactionsById,
            });
        }),

};

export default Reactions;
