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
        createOrUpdateSpaceReaction(selectedArea.id, requestArgs, selectedArea.fromUserId, user.details.userName).finally(() => {
            toggleAreaOptions(selectedArea);
        });
    } else {
        createOrUpdateMomentReaction(selectedArea.id, requestArgs, selectedArea.fromUserId, user.details.userName).finally(() => {
            toggleAreaOptions(selectedArea);
        });
    }
};

interface ILoadMoreAreas {
    content: any;
    map?: any;
    user: any;
    searchActiveMoments: any;
    searchActiveSpaces: any;
}

const loadMoreAreas = ({
    content,
    map,
    user,
    searchActiveMoments,
    searchActiveSpaces,
}: ILoadMoreAreas) => {
    if (!content.activeMomentsPagination.isLastPage) {
        return searchActiveMoments({
            userLatitude: map?.latitude,
            userLongitude: map?.longitude,
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
            userLatitude: map?.latitude,
            userLongitude: map?.longitude,
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
