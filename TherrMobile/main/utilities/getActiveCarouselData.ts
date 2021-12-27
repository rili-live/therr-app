import { CAROUSEL_TABS } from '../constants';

const mergeAreas = (moments: any[], spaces: any[]) => {
    // TODO: Maintain date order

    const merged = moments.concat(spaces);

    return merged;
};

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

    if (isForBookmarks) {
        return mergeAreas(content.bookmarkedMoments, content.bookmarkedSpaces);
    }

    return mergeAreas(content.activeMoments, content.activeSpaces);
};
