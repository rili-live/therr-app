import { CAROUSEL_TABS } from '../constants';
import { SELECT_ALL } from './categories';

interface IPost {
    createdAt: any;
    isDraft: boolean;
    [key: string]: any;
}

interface IArea extends IPost {
    distance: number | string;
}

/**
 * Merges multiple lists of areas together and orders them by createdAt time
 * @param moments a pre-ordered list of moments (by createdAt)
 * @param spaces a pre-ordered list of spaces (by createdAt)
 * @returns a merged list of moments and spaces
 */
const mergeAreas = (moments: IArea[], spaces: IArea[], sortBy = 'createdAt', shouldIncludeDrafts = false) => {
    // TODO: This is groooosssss....sorting should happen on the server side
    if (sortBy === 'distance') {
        return [...moments, ...spaces].sort((a, b) => {
            let aDist = a.distance;
            let bDist = b.distance;
            let aSplit;
            let bSplit;
            if (typeof aDist === 'string') {
                aSplit = aDist.split(' ');

                aDist = Number(aSplit[0]);
                if (aSplit[1] === 'ft') {
                    aDist *= 0.000189394;
                }
            }
            if (typeof bDist === 'string') {
                bSplit = bDist.split(' ');
                bDist = Number(bSplit[0]);
                if (bSplit[1] === 'ft') {
                    bDist *= 0.000189394;
                }
            }

            return aDist - bDist;
        });
    } else {
        return mergeSortByCreatedAt(moments, spaces, shouldIncludeDrafts);
    }
};

const mergeSortByCreatedAt = (leftPosts: IPost[], rightPosts: IPost[], shouldIncludeDrafts = false) => {
    let mergedAreas: any[] = [];
    let lIndex = 0;
    let rIndex = 0;

    while (leftPosts[lIndex] || rightPosts[rIndex]) {
        if (!leftPosts[lIndex]) {
            if (!rightPosts[rIndex].isDraft || shouldIncludeDrafts) {
                mergedAreas.push(rightPosts[rIndex]);
            }
            rIndex++;
        } else if (!rightPosts[rIndex]) {
            if (!leftPosts[lIndex].isDraft || shouldIncludeDrafts) {
                mergedAreas.push(leftPosts[lIndex]);
            }
            lIndex++;
        } else {
            const momentOrderByVal = new Date(leftPosts[lIndex].createdAt).getTime();
            const spaceOrderByVal = new Date(rightPosts[rIndex].createdAt).getTime();
            if (momentOrderByVal > spaceOrderByVal) {
                if (!leftPosts[lIndex].isDraft || shouldIncludeDrafts) {
                    mergedAreas.push(leftPosts[lIndex]);
                }
                lIndex++;
            } else {
                if (!rightPosts[rIndex].isDraft) {
                    mergedAreas.push(rightPosts[rIndex]);
                }
                rIndex++;
            }
        }
    }

    return mergedAreas;
};

interface IGetActiveDataArgs {
    activeTab: any;
    content: any;
    isForBookmarks?: boolean;
    isForDrafts?: boolean;
    shouldIncludeThoughts?: boolean;
    shouldIncludeMoments?: boolean;
    shouldIncludeSpaces?: boolean;
}

export default ({
    activeTab,
    content,
    isForBookmarks,
    isForDrafts,
    shouldIncludeThoughts,
    shouldIncludeMoments,
    shouldIncludeSpaces,
}: IGetActiveDataArgs, sortBy = 'createdAt', categories: string[] = [SELECT_ALL]) => {
    if (activeTab === CAROUSEL_TABS.EVENTS) {
        return [];
    }

    if (activeTab === CAROUSEL_TABS.NEWS) {
        return [];
    }


    if (isForBookmarks) {
        // TODO: Add Thought Bookmarks
        const mapContent = mergeAreas(
            shouldIncludeMoments ? content.bookmarkedMoments : [],
            shouldIncludeSpaces ? content.bookmarkedSpaces : [],
            sortBy,
        );

        return mapContent;
    }

    if (isForDrafts) {
        const drafts = [...content.myDrafts].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return mergeAreas(drafts, [], sortBy, isForDrafts);
    }

    let sortedData = mergeAreas(
        shouldIncludeMoments ? content.activeMoments : [],
        shouldIncludeSpaces ? content.activeSpaces : [],
        sortBy,
        isForDrafts,
    );

    if (shouldIncludeThoughts) {
        sortedData = mergeSortByCreatedAt(sortedData, content.activeThoughts, isForDrafts);
    }

    // TODO: performance optimize to prevent loading unnecessary data
    let filteredData = categories.includes(SELECT_ALL) ?
        sortedData :
        sortedData.filter(areaOrThought => categories.includes(areaOrThought.category));

    return filteredData;
};
