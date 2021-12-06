import { ISelectionType } from '../components/Modals/AreaOptionsModal';

const getReactionUpdateArgs = (type: ISelectionType) => {
    const requestArgs: any = {};

    switch (type) {
        case 'like':
            requestArgs.userHasLiked = true;
            break;
        case 'dislike':
            requestArgs.userHasDisliked = true;
            break;
        case 'report':
            requestArgs.userHasReported = true;
            break;
        default:
            break;
    }

    return requestArgs;
};

export {
    getReactionUpdateArgs,
};
