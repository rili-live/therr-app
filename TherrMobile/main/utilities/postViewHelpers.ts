import { IContentSelectionType as ISelectionType } from '../components/ActionSheet/ContentOptionsSheet';
import { isMyContent } from './content';
import { getReactionUpdateArgs } from './reactions';
import { showToast } from './toasts';


const handleAreaReaction = (selectedArea, reactionType: ISelectionType, {
    user,
    createOrUpdateEventReaction,
    createOrUpdateMomentReaction,
    createOrUpdateSpaceReaction,
    toggleAreaOptions,
    translate,
}: {
    user: any;
    createOrUpdateEventReaction: Function;
    createOrUpdateMomentReaction: Function;
    createOrUpdateSpaceReaction: Function;
    toggleAreaOptions: Function;
    translate?: Function;
}) => {
    const requestArgs: any = getReactionUpdateArgs(reactionType);

    const onSuccess = () => {
        if (translate) {
            showToast.success({
                text1: translate('alertTitles.reactionSent'),
            });
        }
    };
    const onError = () => {
        if (translate) {
            showToast.error({
                text1: translate('alertTitles.reactionFailed'),
            });
        }
    };

    if (selectedArea.areaType === 'events') {
        createOrUpdateEventReaction(selectedArea.id, requestArgs, selectedArea.fromUserId, user.details.userName)
            .then(onSuccess)
            .catch(onError)
            .finally(() => {
                toggleAreaOptions(selectedArea);
            });
    } else if (selectedArea.areaType === 'spaces') {
        createOrUpdateSpaceReaction(selectedArea.id, requestArgs, selectedArea.fromUserId, user.details.userName)
            .then(onSuccess)
            .catch(onError)
            .finally(() => {
                toggleAreaOptions(selectedArea);
            });
    } else if (selectedArea.areaType === 'moments') {
        createOrUpdateMomentReaction(selectedArea.id, requestArgs, selectedArea.fromUserId, user.details.userName)
            .then(onSuccess)
            .catch(onError)
            .finally(() => {
                toggleAreaOptions(selectedArea);
            });
    }
};

const handleThoughtReaction = (selectedArea, reactionType: ISelectionType, {
    user,
    createOrUpdateThoughtReaction,
    toggleThoughtOptions,
    translate,
}: {
    user: any;
    createOrUpdateThoughtReaction: Function;
    toggleThoughtOptions: Function;
    translate?: Function;
}) => {
    const requestArgs: any = getReactionUpdateArgs(reactionType);

    createOrUpdateThoughtReaction(selectedArea.id, requestArgs, selectedArea.fromUserId, user.details.userName)
        .then(() => {
            if (translate) {
                showToast.success({
                    text1: translate('alertTitles.reactionSent'),
                });
            }
        })
        .catch(() => {
            if (translate) {
                showToast.error({
                    text1: translate('alertTitles.reactionFailed'),
                });
            }
        })
        .finally(() => {
            toggleThoughtOptions(selectedArea);
        });
};

interface ILoadMoreAreas {
    content: any;
    location?: any;
    user: any;
    searchActiveEvents?: any;
    searchActiveMoments?: any;
    searchActiveSpaces?: any;
}

interface ILoadMorePosts extends ILoadMoreAreas{
    searchActiveThoughts: any;
}

const loadMoreAreas = ({
    content,
    location,
    user,
    searchActiveEvents,
    searchActiveMoments,
    searchActiveSpaces,
}: ILoadMoreAreas) => {
    if (searchActiveEvents && !content.activeEventsPagination.isLastPage) {
        // NOTE: This helps prevent duplicate content from being loaded, but we should debug and test further to ensure this is the best approach
        const lastContentCreatedAt = content.activeEvents?.length ? content.activeEvents[content.activeEvents.length - 1].createdAt : null;

        searchActiveEvents({
            userLatitude: location?.user?.latitude,
            userLongitude: location?.user?.longitude,
            withMedia: true,
            withUser: true,
            offset: content.activeEventsPagination.offset + content.activeEventsPagination.itemsPerPage,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
            lastContentCreatedAt,
        });
    }

    if (searchActiveMoments && !content.activeMomentsPagination.isLastPage) {
        // NOTE: This helps prevent duplicate content from being loaded, but we should debug and test further to ensure this is the best approach
        const lastContentCreatedAt = content.activeMoments?.length ? content.activeMoments[content.activeMoments.length - 1].createdAt : null;

        searchActiveMoments({
            userLatitude: location?.user?.latitude,
            userLongitude: location?.user?.longitude,
            withMedia: true,
            withUser: true,
            offset: content.activeMomentsPagination.offset + content.activeMomentsPagination.itemsPerPage,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
            lastContentCreatedAt,
        });
    }

    if (searchActiveSpaces && !content.activeSpacesPagination.isLastPage) {
        // NOTE: This helps prevent duplicate content from being loaded, but we should debug and test further to ensure this is the best approach
        const lastContentCreatedAt = content.activeSpaces?.length ? content.activeSpaces[content.activeSpaces.length - 1].createdAt : null;

        searchActiveSpaces({
            userLatitude: location?.user?.latitude,
            userLongitude: location?.user?.longitude,
            withMedia: true,
            withUser: true,
            offset: content.activeSpacesPagination.offset + content.activeSpacesPagination.itemsPerPage,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
            lastContentCreatedAt,
        });
    }
};

const loadMorePosts = ({
    content,
    location,
    user,
    searchActiveEvents,
    searchActiveMoments,
    searchActiveSpaces,
    searchActiveThoughts,
}: ILoadMorePosts) => {
    loadMoreAreas({
        content,
        location,
        user,
        searchActiveEvents,
        searchActiveMoments,
        searchActiveSpaces,
    });

    if (searchActiveThoughts && !content.activeThoughtsPagination.isLastPage) {
        // NOTE: This helps prevent duplicate content from being loaded, but we should debug and test further to ensure this is the best approach
        const lastContentCreatedAt = content.activeThoughts?.length ? content.activeThoughts[content.activeThoughts.length - 1].createdAt : null;
        searchActiveThoughts({
            withUser: true,
            withReplies: true,
            offset: content.activeThoughtsPagination.offset + content.activeThoughtsPagination.itemsPerPage,
            // ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
            lastContentCreatedAt,
        });
    }
};

const navToViewContent = (content, user, navigate, previousView = 'Areas', previousViewParams = {}) => {
    if (content.areaType === 'spaces') {
        navigate('ViewSpace', {
            isMyContent: isMyContent(content, user),
            previousView,
            previousViewParams,
            space: content,
            spaceDetails: {},
        });
    } else if (content.areaType === 'moments') {
        navigate('ViewMoment', {
            isMyContent: isMyContent(content, user),
            previousView,
            previousViewParams,
            moment: content,
            momentDetails: {},
        });
    }  else if (content.areaType === 'events') {
        navigate('ViewEvent', {
            isMyContent: isMyContent(content, user),
            previousView,
            previousViewParams,
            event: content,
            eventDetails: {},
        });
    } else {
        navigate('ViewThought', {
            isMyContent: isMyContent(content, user),
            previousView,
            previousViewParams,
            thought: content,
            thoughtDetails: {},
        });
    }
};

export {
    handleAreaReaction,
    handleThoughtReaction,
    loadMoreAreas,
    loadMorePosts,
    navToViewContent,
};
