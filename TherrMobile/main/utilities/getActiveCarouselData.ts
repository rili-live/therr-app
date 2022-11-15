import { CAROUSEL_TABS } from '../constants';
import { SELECT_ALL } from './categories';

/**
 * Merges multiple lists of areas together and orders them by createdAt time
 * @param moments a pre-ordered list of moments (by createdAt)
 * @param spaces a pre-ordered list of spaces (by createdAt)
 * @returns a merged list of moments and spaces
 */
const mergeAreas = (moments: any[], spaces: any[], sortBy = 'createdAt', shouldIncludeDrafts = false) => {
    let mergedAreas: any[] = [];
    let mIndex = 0;
    let sIndex = 0;

    if (sortBy === 'distance') {
        return [...moments, ...spaces].sort((a, b) => a.distance - b.distance);
    } else {
        while (moments[mIndex] || spaces[sIndex]) {
            if (!moments[mIndex]) {
                if (!spaces[sIndex].isDraft || shouldIncludeDrafts) {
                    mergedAreas.push(spaces[sIndex]);
                }
                sIndex++;
            } else if (!spaces[sIndex]) {
                if (!moments[mIndex].isDraft || shouldIncludeDrafts) {
                    mergedAreas.push(moments[mIndex]);
                }
                mIndex++;
            } else {
                const momentOrderByVal = new Date(moments[mIndex].createdAt).getTime();
                const spaceOrderByVal = new Date(spaces[sIndex].createdAt).getTime();
                if (momentOrderByVal > spaceOrderByVal) {
                    if (!moments[mIndex].isDraft || shouldIncludeDrafts) {
                        mergedAreas.push(moments[mIndex]);
                    }
                    mIndex++;
                } else {
                    if (!spaces[sIndex].isDraft) {
                        mergedAreas.push(spaces[sIndex]);
                    }
                    sIndex++;
                }
            }
        }

        return mergedAreas;
    }
};

interface IGetActiveDataArgs {
    activeTab: any;
    content: any;
    isForBookmarks?: boolean;
    isForDrafts?: boolean;
}

export default ({
    activeTab,
    content,
    isForBookmarks,
    isForDrafts,
}: IGetActiveDataArgs, sortBy = 'createdAt', categories: string[] = [SELECT_ALL]) => {
    if (activeTab === CAROUSEL_TABS.HIRE) {
        return [];
    }

    if (activeTab === CAROUSEL_TABS.EVENTS) {
        return [];
    }

    if (isForBookmarks) {
        return mergeAreas(content.bookmarkedMoments, content.bookmarkedSpaces, sortBy);
    }

    if (isForDrafts) {
        const drafts = [...content.myDrafts].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return mergeAreas(drafts, [], sortBy, isForDrafts);
    }

    const withoutCategoryFilters = mergeAreas(content.activeMoments, content.activeSpaces, sortBy, isForDrafts);

    return categories.includes(SELECT_ALL) ?
        withoutCategoryFilters :
        withoutCategoryFilters.filter(area => categories.includes(area.category));
};
