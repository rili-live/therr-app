import { CAROUSEL_TABS } from '../constants';

export default ({
    activeTab,
    content,
    isForBookmarks,
}) => {
    if (activeTab === CAROUSEL_TABS.HIRE) {
        return [];
    }

    if (activeTab === CAROUSEL_TABS.EVENTS) {
        return [];
    }

    return isForBookmarks ? content.bookmarkedMoments : content.activeMoments;
};
