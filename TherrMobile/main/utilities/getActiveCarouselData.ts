import { CAROUSEL_TABS } from '../constants';

/**
 * Merges multiple lists of areas together and orders them by createdAt time
 * @param moments a pre-ordered list of moments (by createdAt)
 * @param spaces a pre-ordered list of spaces (by createdAt)
 * @returns a merged list of moments and spaces
 */
const mergeAreas = (moments: any[], spaces: any[]) => {
    // TODO: Maintain date order
    let mergedAreas: any[] = [];
    let mIndex = 0;
    let sIndex = 0;

    while (moments[mIndex] || spaces[sIndex]) {
        if (!moments[mIndex]) {
            mergedAreas.push(spaces[sIndex]);
            sIndex++;
        } else if (!spaces[sIndex]) {
            mergedAreas.push(moments[mIndex]);
            mIndex++;
        } else {
            const mDate = new Date(moments[mIndex].createdAt).getTime();
            const sDate = new Date(spaces[sIndex].createdAt).getTime();
            if (mDate > sDate) {
                mergedAreas.push(moments[mIndex]);
                mIndex++;
            } else {
                mergedAreas.push(spaces[sIndex]);
                sIndex++;
            }
        }
    }

    return mergedAreas;
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
