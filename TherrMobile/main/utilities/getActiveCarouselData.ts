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
    const filteredMoments = shouldIncludeDrafts ? moments : moments.filter((a) => !a.isDraft);
    const filteredSpaces = shouldIncludeDrafts ? spaces : spaces.filter((a) => !a.isDraft);
    if (sortBy === 'distance') {
        return [...filteredMoments, ...filteredSpaces].sort((a, b) => {
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
        return mergeSortByCreatedAt(filteredMoments, filteredSpaces, sortBy === 'reaction.createdAt');
    }
};

const mergeSortByCreatedAt = (leftPosts: IPost[], rightPosts: IPost[], shouldSortByReaction = false) => {
    return [...leftPosts, ...rightPosts].sort((a, b) => {
        const aOrderByVal = shouldSortByReaction
            ? new Date(a.reaction?.createdAt || a.createdAt).getTime()
            : new Date(a.createdAt).getTime();
        const bOrderByVal = shouldSortByReaction
            ? new Date(b.reaction?.createdAt || b.createdAt).getTime()
            : new Date(b.createdAt).getTime();
        return bOrderByVal - aOrderByVal;
    });
};

interface IGetActiveDataArgs {
    activeTab: any;
    content: any;
    isForBookmarks?: boolean;
    isForDrafts?: boolean;
    shouldIncludeEvents?: boolean;
    shouldIncludeThoughts?: boolean;
    shouldIncludeMoments?: boolean;
    shouldIncludeSpaces?: boolean;
}

export default ({
    activeTab,
    content,
    isForBookmarks,
    isForDrafts,
    shouldIncludeEvents,
    shouldIncludeThoughts,
    shouldIncludeMoments,
    shouldIncludeSpaces,
}: IGetActiveDataArgs, sortBy = 'createdAt', categories: string[] = [SELECT_ALL]) => {
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
        return drafts.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    }

    let sortedData = mergeAreas(
        shouldIncludeMoments ? content.activeMoments : [],
        shouldIncludeSpaces ? content.activeSpaces : [],
        sortBy,
    );

    if (shouldIncludeThoughts) {
        sortedData = mergeSortByCreatedAt(sortedData, content.activeThoughts, sortBy === 'reaction.createdAt');
    } else if (shouldIncludeEvents) {
        sortedData = mergeAreas(sortedData as any, content.activeEvents, sortBy);
    }

    // TODO: performance optimize to prevent loading unnecessary data
    let filteredData = categories.includes(SELECT_ALL) ?
        sortedData :
        sortedData.filter(areaOrThought => categories.includes(areaOrThought.category));

    return filteredData;
};
