import { ReactionActionTypes } from '../../types/redux/reactions';
import ReactionsService, {
    ICreateMomentReactionBody,
    IGetMomentReactionParams,
    IUpdateMomentReactionBody,
} from '../../services/ReactionsService';

const Reactions = {
    createMoment: (data: ICreateMomentReactionBody) => (dispatch: any) => ReactionsService.createMomentReaction(data)
        .then((response: any) => {
            dispatch({
                type: ReactionActionTypes.MOMENT_REACTION_CREATED,
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
    updateMomentReactions: (momentId: number, data: IUpdateMomentReactionBody) => (dispatch: any) => ReactionsService
        .updateMomentReactions(momentId, data).then((response: any) => {
            dispatch({
                type: ReactionActionTypes.MOMENT_REACTION_UPDATED,
                data: response.data,
            });
        }),
};

export default Reactions;
