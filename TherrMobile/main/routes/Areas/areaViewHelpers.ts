import { ISelectionType } from '../../components/Modals/AreaOptionsModal';
import { isMyArea } from '../../utilities/content';


const handleAreaReaction = (selectedArea, reactionType: ISelectionType, {
    user,
    getReactionUpdateArgs,
    createOrUpdateMomentReaction,
    createOrUpdateSpaceReaction,
    toggleAreaOptions,
}) => {
    const requestArgs: any = getReactionUpdateArgs(reactionType);

    if (selectedArea.areaType === 'spaces') {
        createOrUpdateSpaceReaction(selectedArea.id, requestArgs).finally(() => {
            toggleAreaOptions(selectedArea);
        });
    } else {
        createOrUpdateMomentReaction(selectedArea.id, requestArgs, selectedArea.fromUserId, user.details.userName).finally(() => {
            toggleAreaOptions(selectedArea);
        });
    }
};

const loadMoreAreas = ({
    content,
    user,
    searchActiveMoments,
    searchActiveSpaces,
}) => {
    if (!content.activeMomentsPagination.isLastPage) {
        return searchActiveMoments({
            withMedia: true,
            withUser: true,
            offset: content.activeMomentsPagination.offset + content.activeMomentsPagination.itemsPerPage,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });
    }

    if (!content.activeSpacesPagination.isLastPage) {
        return searchActiveSpaces({
            withMedia: true,
            withUser: true,
            offset: content.activeSpacesPagination.offset + content.activeSpacesPagination.itemsPerPage,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });
    }
};

const navToViewArea = (area, user, navigate) => {
    if (area.areaType === 'spaces') {
        navigate('ViewSpace', {
            isMyArea: isMyArea(area, user),
            previousView: 'Spaces',
            space: area,
            spaceDetails: {},
        });
    } else {
        navigate('ViewMoment', {
            isMyArea: isMyArea(area, user),
            previousView: 'Areas',
            moment: area,
            momentDetails: {},
        });
    }
};

export {
    handleAreaReaction,
    loadMoreAreas,
    navToViewArea,
};
