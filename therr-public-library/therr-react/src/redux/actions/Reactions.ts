import { ReactionActionTypes } from '../../types/redux/reactions';
import ReactionsService, {
    IGetMomentReactionParams,
    ICreateOrUpdateMomentReactionBody,
} from '../../services/ReactionsService';

const Reactions = {
    createOrUpdateMomentReactions: (momentId: number, data: ICreateOrUpdateMomentReactionBody) => (dispatch: any) => ReactionsService
        .createOrUpdateMomentReactions(momentId, data).then((response: any) => {
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
};

export default Reactions;
