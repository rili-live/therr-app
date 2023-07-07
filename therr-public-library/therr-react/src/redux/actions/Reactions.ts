import { ReactionActionTypes } from '../../types/redux/reactions';
import ReactionsService, {
    ICreateOrUpdateAreaReactionBody,
    IGetMomentReactionParams,
    IFindMomentReactionParams,
    IGetSpaceReactionParams,
    IFindSpaceReactionParams,
    IGetThoughtReactionParams,
    IFindThoughtReactionParams,
    ICreateOrUpdateSpaceReactionBody,
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
    createOrUpdateSpaceReaction: (spaceId: number, data: ICreateOrUpdateSpaceReactionBody) => (dispatch: any) => ReactionsService
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
                reactionsById[reaction.spaceId] = reaction;
            });
            dispatch({
                type: ReactionActionTypes.GET_SPACE_REACTIONS,
                data: reactionsById,
            });
        }),

    // Thoughts
    createOrUpdateThoughtReaction: (thoughtId: number, data: ICreateOrUpdateAreaReactionBody) => (dispatch: any) => ReactionsService
        .createOrUpdateThoughtReaction(thoughtId, data).then((response: any) => {
            dispatch({
                type: ReactionActionTypes.THOUGHT_REACTION_CREATED_OR_UPDATED,
                data: response.data,
            });
        }),
    getThoughtReactions: (query: IGetThoughtReactionParams) => (dispatch: any) => ReactionsService.getThoughtReactions(query)
        .then((response: any) => {
            dispatch({
                type: ReactionActionTypes.GET_THOUGHT_REACTIONS,
                data: response.data,
            });
        }),
    findThoughtReactions: (query: IFindThoughtReactionParams) => (dispatch: any) => ReactionsService.findThoughtReactions(query)
        .then((response: any) => {
            const reactionsById = {};

            (response.data?.reactions || []).forEach((reaction) => {
                reactionsById[reaction.thoughtId] = reaction;
            });
            dispatch({
                type: ReactionActionTypes.GET_THOUGHT_REACTIONS,
                data: reactionsById,
            });
        }),
};

export default Reactions;
