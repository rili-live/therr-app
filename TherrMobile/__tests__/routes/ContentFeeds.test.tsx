import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

/**
 * Content Feeds & Carousels Regression Tests
 *
 * These tests verify the core content feed logic and behaviors including:
 * - Discoveries feed (moments, thoughts, spaces)
 * - Events feed
 * - Bookmarks feed
 * - Reactions (like, dislike, superlike, report)
 * - Pagination and load more functionality
 * - Content filtering and sorting
 */

describe('Content Feed Tab Navigation', () => {
    const CAROUSEL_TABS = {
        DISCOVERIES: 'discoveries',
        EVENTS: 'events',
        THOUGHTS: 'thoughts',
        NEWS: 'news',
    };

    const tabMap = {
        0: CAROUSEL_TABS.DISCOVERIES,
        1: CAROUSEL_TABS.EVENTS,
    };

    const getActiveTabIndex = (mapOfTabs: { [key: number]: string }, activeTab?: string) => {
        for (const [index, tab] of Object.entries(mapOfTabs)) {
            if (activeTab === tab) {
                return Number(index);
            }
        }
        return 0;
    };

    describe('Tab Index Resolution', () => {
        it('should return 0 for DISCOVERIES tab', () => {
            expect(getActiveTabIndex(tabMap, 'discoveries')).toBe(0);
        });

        it('should return 1 for EVENTS tab', () => {
            expect(getActiveTabIndex(tabMap, 'events')).toBe(1);
        });

        it('should return 0 for undefined activeTab', () => {
            expect(getActiveTabIndex(tabMap, undefined)).toBe(0);
        });

        it('should return 0 for invalid tab name', () => {
            expect(getActiveTabIndex(tabMap, 'invalid-tab')).toBe(0);
        });
    });
});

describe('Content Feed Empty List Messages', () => {
    const CAROUSEL_TABS = {
        DISCOVERIES: 'discoveries',
        EVENTS: 'events',
        THOUGHTS: 'thoughts',
        NEWS: 'news',
    };

    const getEmptyListMessage = (activeTab: string, translate: (key: string) => string) => {
        if (activeTab === CAROUSEL_TABS.DISCOVERIES) {
            return translate('pages.areas.noSocialAreasFound');
        }
        if (activeTab === CAROUSEL_TABS.THOUGHTS) {
            return translate('pages.areas.noThoughtsFound');
        }
        if (activeTab === CAROUSEL_TABS.NEWS) {
            return translate('pages.areas.noNewsAreasFound');
        }
        // CAROUSEL_TABS.EVENTS
        return translate('pages.areas.noEventsAreasFound');
    };

    const mockTranslate = (key: string) => key;

    describe('getEmptyListMessage', () => {
        it('should return social areas message for discoveries tab', () => {
            expect(getEmptyListMessage(CAROUSEL_TABS.DISCOVERIES, mockTranslate)).toBe('pages.areas.noSocialAreasFound');
        });

        it('should return thoughts message for thoughts tab', () => {
            expect(getEmptyListMessage(CAROUSEL_TABS.THOUGHTS, mockTranslate)).toBe('pages.areas.noThoughtsFound');
        });

        it('should return events message for events tab', () => {
            expect(getEmptyListMessage(CAROUSEL_TABS.EVENTS, mockTranslate)).toBe('pages.areas.noEventsAreasFound');
        });

        it('should return news message for news tab', () => {
            expect(getEmptyListMessage(CAROUSEL_TABS.NEWS, mockTranslate)).toBe('pages.areas.noNewsAreasFound');
        });
    });
});

describe('Content Feed Data Merging', () => {
    interface IPost {
        id: string;
        createdAt: string;
        isDraft?: boolean;
        [key: string]: any;
    }

    // Simulates the mergeSortByCreatedAt logic
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

    describe('mergeSortByCreatedAt', () => {
        it('should merge and sort posts by createdAt descending', () => {
            const leftPosts: IPost[] = [
                { id: 'a', createdAt: '2024-01-03T10:00:00Z' },
                { id: 'b', createdAt: '2024-01-01T10:00:00Z' },
            ];
            const rightPosts: IPost[] = [
                { id: 'c', createdAt: '2024-01-02T10:00:00Z' },
            ];

            const result = mergeSortByCreatedAt(leftPosts, rightPosts);

            expect(result[0].id).toBe('a'); // Most recent
            expect(result[1].id).toBe('c');
            expect(result[2].id).toBe('b'); // Oldest
        });

        it('should sort by reaction.createdAt when flag is set', () => {
            const leftPosts: IPost[] = [
                { id: 'a', createdAt: '2024-01-01T10:00:00Z', reaction: { createdAt: '2024-01-03T10:00:00Z' } },
            ];
            const rightPosts: IPost[] = [
                { id: 'b', createdAt: '2024-01-02T10:00:00Z', reaction: { createdAt: '2024-01-01T10:00:00Z' } },
            ];

            const result = mergeSortByCreatedAt(leftPosts, rightPosts, true);

            expect(result[0].id).toBe('a'); // More recent reaction
            expect(result[1].id).toBe('b');
        });

        it('should fallback to createdAt when reaction.createdAt is missing', () => {
            const leftPosts: IPost[] = [
                { id: 'a', createdAt: '2024-01-01T10:00:00Z' },
            ];
            const rightPosts: IPost[] = [
                { id: 'b', createdAt: '2024-01-02T10:00:00Z', reaction: { createdAt: '2024-01-03T10:00:00Z' } },
            ];

            const result = mergeSortByCreatedAt(leftPosts, rightPosts, true);

            expect(result[0].id).toBe('b'); // Has reaction.createdAt
            expect(result[1].id).toBe('a');
        });

        it('should handle empty arrays', () => {
            const result = mergeSortByCreatedAt([], []);
            expect(result).toEqual([]);
        });
    });
});

describe('Content Feed Draft Filtering', () => {
    interface IPost {
        id: string;
        isDraft?: boolean;
        [key: string]: any;
    }

    const filterDrafts = (posts: IPost[], shouldIncludeDrafts = false): IPost[] => {
        return shouldIncludeDrafts ? posts : posts.filter((p) => !p.isDraft);
    };

    describe('filterDrafts', () => {
        it('should exclude drafts by default', () => {
            const posts: IPost[] = [
                { id: '1', isDraft: false },
                { id: '2', isDraft: true },
                { id: '3' },
            ];

            const result = filterDrafts(posts);

            expect(result).toHaveLength(2);
            expect(result.find((p) => p.id === '2')).toBeUndefined();
        });

        it('should include drafts when flag is true', () => {
            const posts: IPost[] = [
                { id: '1', isDraft: false },
                { id: '2', isDraft: true },
            ];

            const result = filterDrafts(posts, true);

            expect(result).toHaveLength(2);
        });

        it('should handle posts without isDraft property', () => {
            const posts: IPost[] = [
                { id: '1' },
                { id: '2' },
            ];

            const result = filterDrafts(posts);

            expect(result).toHaveLength(2);
        });
    });
});

describe('Content Feed Distance Sorting', () => {
    interface IArea {
        id: string;
        distance: number | string;
    }

    const sortByDistance = (areas: IArea[]): IArea[] => {
        return [...areas].sort((a, b) => {
            let aDist = a.distance;
            let bDist = b.distance;

            if (typeof aDist === 'string') {
                const aSplit = aDist.split(' ');
                aDist = Number(aSplit[0]);
                if (aSplit[1] === 'ft') {
                    aDist *= 0.000189394; // Convert feet to miles
                }
            }
            if (typeof bDist === 'string') {
                const bSplit = bDist.split(' ');
                bDist = Number(bSplit[0]);
                if (bSplit[1] === 'ft') {
                    bDist *= 0.000189394;
                }
            }

            return (aDist as number) - (bDist as number);
        });
    };

    describe('sortByDistance', () => {
        it('should sort by numeric distance', () => {
            const areas: IArea[] = [
                { id: 'a', distance: 5.5 },
                { id: 'b', distance: 2.3 },
                { id: 'c', distance: 8.1 },
            ];

            const result = sortByDistance(areas);

            expect(result[0].id).toBe('b'); // Closest
            expect(result[1].id).toBe('a');
            expect(result[2].id).toBe('c'); // Farthest
        });

        it('should handle string distances with miles', () => {
            const areas: IArea[] = [
                { id: 'a', distance: '5 mi' },
                { id: 'b', distance: '2 mi' },
            ];

            const result = sortByDistance(areas);

            expect(result[0].id).toBe('b');
            expect(result[1].id).toBe('a');
        });

        it('should handle string distances with feet (smaller than miles)', () => {
            const areas: IArea[] = [
                { id: 'a', distance: '1 mi' },
                { id: 'b', distance: '100 ft' },
            ];

            const result = sortByDistance(areas);

            expect(result[0].id).toBe('b'); // 100 ft is closer than 1 mi
            expect(result[1].id).toBe('a');
        });
    });
});

describe('Content Feed Category Filtering', () => {
    const SELECT_ALL = 'selectAll';

    interface IPost {
        id: string;
        category: string;
    }

    const filterByCategories = (posts: IPost[], categories: string[], translate: (key: string) => string): IPost[] => {
        if (categories.includes(SELECT_ALL)) {
            return posts;
        }

        return posts.filter(
            (post) =>
                categories.includes(post.category) ||
                categories.map((cat) => translate(cat)).includes(post.category) ||
                categories.map((cat) => cat.replace('categories.', '')).includes(post.category)
        );
    };

    const mockTranslate = (key: string) => key.replace('categories.', 'translated_');

    describe('filterByCategories', () => {
        it('should return all posts when SELECT_ALL is included', () => {
            const posts: IPost[] = [
                { id: '1', category: 'food' },
                { id: '2', category: 'travel' },
            ];

            const result = filterByCategories(posts, [SELECT_ALL], mockTranslate);

            expect(result).toHaveLength(2);
        });

        it('should filter posts by category', () => {
            const posts: IPost[] = [
                { id: '1', category: 'food' },
                { id: '2', category: 'travel' },
                { id: '3', category: 'food' },
            ];

            const result = filterByCategories(posts, ['food'], mockTranslate);

            expect(result).toHaveLength(2);
            expect(result.every((p) => p.category === 'food')).toBe(true);
        });

        it('should filter by multiple categories', () => {
            const posts: IPost[] = [
                { id: '1', category: 'food' },
                { id: '2', category: 'travel' },
                { id: '3', category: 'music' },
            ];

            const result = filterByCategories(posts, ['food', 'travel'], mockTranslate);

            expect(result).toHaveLength(2);
        });

        it('should return empty array when no posts match', () => {
            const posts: IPost[] = [
                { id: '1', category: 'food' },
            ];

            const result = filterByCategories(posts, ['travel'], mockTranslate);

            expect(result).toHaveLength(0);
        });
    });
});

describe('Content Feed Reactions', () => {
    type ReactionType = 'like' | 'superLike' | 'dislike' | 'superDislike' | 'report';

    const getReactionUpdateArgs = (type: ReactionType): Record<string, boolean> => {
        const requestArgs: Record<string, boolean> = {};

        switch (type) {
            case 'like':
                requestArgs.userHasLiked = true;
                break;
            case 'superLike':
                requestArgs.userHasSuperLiked = true;
                break;
            case 'dislike':
                requestArgs.userHasDisliked = true;
                break;
            case 'superDislike':
                requestArgs.userHasSuperDisliked = true;
                break;
            case 'report':
                requestArgs.userHasReported = true;
                break;
        }

        return requestArgs;
    };

    describe('getReactionUpdateArgs', () => {
        it('should set userHasLiked for like reaction', () => {
            const args = getReactionUpdateArgs('like');
            expect(args.userHasLiked).toBe(true);
        });

        it('should set userHasSuperLiked for superLike reaction', () => {
            const args = getReactionUpdateArgs('superLike');
            expect(args.userHasSuperLiked).toBe(true);
        });

        it('should set userHasDisliked for dislike reaction', () => {
            const args = getReactionUpdateArgs('dislike');
            expect(args.userHasDisliked).toBe(true);
        });

        it('should set userHasSuperDisliked for superDislike reaction', () => {
            const args = getReactionUpdateArgs('superDislike');
            expect(args.userHasSuperDisliked).toBe(true);
        });

        it('should set userHasReported for report reaction', () => {
            const args = getReactionUpdateArgs('report');
            expect(args.userHasReported).toBe(true);
        });
    });
});

describe('Content Feed Area Type Detection', () => {
    interface IContent {
        areaType?: 'moments' | 'spaces' | 'events';
    }

    const getReactionMethod = (
        content: IContent,
        updateEventReaction: Function,
        updateMomentReaction: Function,
        updateSpaceReaction: Function,
        updateThoughtReaction: Function
    ): Function => {
        if (!content.areaType) {
            return updateThoughtReaction;
        }
        if (content.areaType === 'events') {
            return updateEventReaction;
        }
        if (content.areaType === 'spaces') {
            return updateSpaceReaction;
        }
        return updateMomentReaction;
    };

    describe('getReactionMethod', () => {
        const mockUpdateEvent = jest.fn();
        const mockUpdateMoment = jest.fn();
        const mockUpdateSpace = jest.fn();
        const mockUpdateThought = jest.fn();

        it('should return event reaction for events', () => {
            const content: IContent = { areaType: 'events' };
            const method = getReactionMethod(content, mockUpdateEvent, mockUpdateMoment, mockUpdateSpace, mockUpdateThought);
            expect(method).toBe(mockUpdateEvent);
        });

        it('should return space reaction for spaces', () => {
            const content: IContent = { areaType: 'spaces' };
            const method = getReactionMethod(content, mockUpdateEvent, mockUpdateMoment, mockUpdateSpace, mockUpdateThought);
            expect(method).toBe(mockUpdateSpace);
        });

        it('should return moment reaction for moments', () => {
            const content: IContent = { areaType: 'moments' };
            const method = getReactionMethod(content, mockUpdateEvent, mockUpdateMoment, mockUpdateSpace, mockUpdateThought);
            expect(method).toBe(mockUpdateMoment);
        });

        it('should return thought reaction when no areaType', () => {
            const content: IContent = {};
            const method = getReactionMethod(content, mockUpdateEvent, mockUpdateMoment, mockUpdateSpace, mockUpdateThought);
            expect(method).toBe(mockUpdateThought);
        });
    });
});

describe('Content Feed Pagination', () => {
    interface IPagination {
        offset: number;
        itemsPerPage: number;
        isLastPage: boolean;
    }

    // interface IContent {
    //     activeMomentsPagination: IPagination;
    //     activeSpacesPagination: IPagination;
    //     activeEventsPagination: IPagination;
    //     activeThoughtsPagination: IPagination;
    // }

    const shouldLoadMore = (pagination: IPagination): boolean => {
        return !pagination.isLastPage;
    };

    const calculateNextOffset = (pagination: IPagination): number => {
        return pagination.offset + pagination.itemsPerPage;
    };

    describe('shouldLoadMore', () => {
        it('should return true when not on last page', () => {
            const pagination: IPagination = { offset: 0, itemsPerPage: 21, isLastPage: false };
            expect(shouldLoadMore(pagination)).toBe(true);
        });

        it('should return false when on last page', () => {
            const pagination: IPagination = { offset: 42, itemsPerPage: 21, isLastPage: true };
            expect(shouldLoadMore(pagination)).toBe(false);
        });
    });

    describe('calculateNextOffset', () => {
        it('should calculate correct next offset', () => {
            const pagination: IPagination = { offset: 0, itemsPerPage: 21, isLastPage: false };
            expect(calculateNextOffset(pagination)).toBe(21);
        });

        it('should accumulate offset correctly', () => {
            const pagination: IPagination = { offset: 42, itemsPerPage: 21, isLastPage: false };
            expect(calculateNextOffset(pagination)).toBe(63);
        });
    });

    describe('Load More Parameters', () => {
        const buildLoadMoreParams = (
            contentType: 'moments' | 'spaces' | 'events' | 'thoughts',
            pagination: IPagination,
            user: { blockedUsers: string[]; shouldHideMatureContent: boolean },
            location?: { latitude: number; longitude: number }
        ) => {
            const baseParams = {
                withMedia: true,
                withUser: true,
                offset: calculateNextOffset(pagination),
                blockedUsers: user.blockedUsers,
                shouldHideMatureContent: user.shouldHideMatureContent,
            };

            if (contentType === 'thoughts') {
                return {
                    ...baseParams,
                    withReplies: true,
                };
            }

            return {
                ...baseParams,
                userLatitude: location?.latitude,
                userLongitude: location?.longitude,
            };
        };

        it('should include location for moments', () => {
            const pagination: IPagination = { offset: 0, itemsPerPage: 21, isLastPage: false };
            const user = { blockedUsers: [], shouldHideMatureContent: true };
            const location = { latitude: 40.7128, longitude: -74.006 };

            const params = buildLoadMoreParams('moments', pagination, user, location);

            expect(params.userLatitude).toBe(40.7128);
            expect(params.userLongitude).toBe(-74.006);
        });

        it('should include withReplies for thoughts', () => {
            const pagination: IPagination = { offset: 0, itemsPerPage: 21, isLastPage: false };
            const user = { blockedUsers: [], shouldHideMatureContent: false };

            const params = buildLoadMoreParams('thoughts', pagination, user);

            expect(params.withReplies).toBe(true);
        });

        it('should include blocked users filter', () => {
            const pagination: IPagination = { offset: 0, itemsPerPage: 21, isLastPage: false };
            const user = { blockedUsers: ['user-1', 'user-2'], shouldHideMatureContent: true };

            const params = buildLoadMoreParams('moments', pagination, user);

            expect(params.blockedUsers).toEqual(['user-1', 'user-2']);
        });
    });
});

describe('Content Feed Bookmarks', () => {
    interface IBookmarkParams {
        withMedia: boolean;
        withUser: boolean;
        offset: number;
        blockedUsers: string[];
        shouldHideMatureContent: boolean;
    }

    const buildBookmarkSearchParams = (
        user: { blockedUsers: string[]; shouldHideMatureContent: boolean },
        offset = 0
    ): IBookmarkParams => {
        return {
            withMedia: true,
            withUser: true,
            offset,
            blockedUsers: user.blockedUsers,
            shouldHideMatureContent: user.shouldHideMatureContent,
        };
    };

    describe('buildBookmarkSearchParams', () => {
        it('should build correct params for first page', () => {
            const user = { blockedUsers: [], shouldHideMatureContent: true };

            const params = buildBookmarkSearchParams(user);

            expect(params.offset).toBe(0);
            expect(params.withMedia).toBe(true);
            expect(params.withUser).toBe(true);
        });

        it('should include mature content filter', () => {
            const user = { blockedUsers: [], shouldHideMatureContent: true };

            const params = buildBookmarkSearchParams(user);

            expect(params.shouldHideMatureContent).toBe(true);
        });

        it('should include blocked users', () => {
            const user = { blockedUsers: ['blocked-1'], shouldHideMatureContent: false };

            const params = buildBookmarkSearchParams(user);

            expect(params.blockedUsers).toEqual(['blocked-1']);
        });
    });
});

describe('Content Feed Navigation', () => {
    type ContentType = 'moments' | 'spaces' | 'events' | undefined;

    interface IContent {
        id: string;
        areaType?: ContentType;
        fromUserId?: string;
    }

    const isMyContent = (content: IContent, user: { id: string }): boolean => {
        return content.fromUserId === user.id;
    };

    const getViewRoute = (content: IContent): string => {
        if (content.areaType === 'spaces') {
            return 'ViewSpace';
        }
        if (content.areaType === 'moments') {
            return 'ViewMoment';
        }
        if (content.areaType === 'events') {
            return 'ViewEvent';
        }
        return 'ViewThought';
    };

    describe('isMyContent', () => {
        it('should return true when content is from current user', () => {
            const content: IContent = { id: 'content-1', fromUserId: 'user-123' };
            const user = { id: 'user-123' };

            expect(isMyContent(content, user)).toBe(true);
        });

        it('should return false when content is from another user', () => {
            const content: IContent = { id: 'content-1', fromUserId: 'user-456' };
            const user = { id: 'user-123' };

            expect(isMyContent(content, user)).toBe(false);
        });
    });

    describe('getViewRoute', () => {
        it('should return ViewSpace for spaces', () => {
            const content: IContent = { id: 'space-1', areaType: 'spaces' };
            expect(getViewRoute(content)).toBe('ViewSpace');
        });

        it('should return ViewMoment for moments', () => {
            const content: IContent = { id: 'moment-1', areaType: 'moments' };
            expect(getViewRoute(content)).toBe('ViewMoment');
        });

        it('should return ViewEvent for events', () => {
            const content: IContent = { id: 'event-1', areaType: 'events' };
            expect(getViewRoute(content)).toBe('ViewEvent');
        });

        it('should return ViewThought for thoughts (no areaType)', () => {
            const content: IContent = { id: 'thought-1' };
            expect(getViewRoute(content)).toBe('ViewThought');
        });
    });

    describe('Navigation Params Construction', () => {
        const buildViewNavigationParams = (
            content: IContent,
            user: { id: string },
            previousView = 'Areas'
        ) => {
            const route = getViewRoute(content);
            const contentKey = route.replace('View', '').toLowerCase();

            return {
                route,
                params: {
                    isMyContent: isMyContent(content, user),
                    previousView,
                    previousViewParams: {},
                    [contentKey]: content,
                    [`${contentKey}Details`]: {},
                },
            };
        };

        it('should build correct params for viewing a moment', () => {
            const content: IContent = { id: 'moment-1', areaType: 'moments', fromUserId: 'user-123' };
            const user = { id: 'user-123' };

            const { route, params } = buildViewNavigationParams(content, user);

            expect(route).toBe('ViewMoment');
            expect(params.isMyContent).toBe(true);
            expect(params.moment).toEqual(content);
        });

        it('should set previousView correctly', () => {
            const content: IContent = { id: 'space-1', areaType: 'spaces', fromUserId: 'user-456' };
            const user = { id: 'user-123' };

            const { params } = buildViewNavigationParams(content, user, 'Bookmarked');

            expect(params.previousView).toBe('Bookmarked');
            expect(params.isMyContent).toBe(false);
        });
    });
});

describe('Content Feed User Content Display', () => {
    interface IPost {
        id: string;
        fromUserId: string;
        fromUserName?: string;
        hashTags?: string;
    }

    const getUserDetails = (
        post: IPost,
        currentUser: { id: string; userName: string },
        translate: (key: string) => string
    ) => {
        const isMe = currentUser.id === post.fromUserId;
        const userName = post.fromUserName || (isMe ? currentUser.userName : translate('alertTitles.nameUnknown'));

        return {
            userName,
            isMe,
        };
    };

    const parseHashtags = (hashTagsString?: string): string[] => {
        return hashTagsString ? hashTagsString.split(',') : [];
    };

    describe('getUserDetails', () => {
        const mockTranslate = (key: string) => key === 'alertTitles.nameUnknown' ? 'Unknown User' : key;

        it('should use post username when available', () => {
            const post: IPost = { id: '1', fromUserId: 'user-456', fromUserName: 'otheruser' };
            const currentUser = { id: 'user-123', userName: 'currentuser' };

            const details = getUserDetails(post, currentUser, mockTranslate);

            expect(details.userName).toBe('otheruser');
            expect(details.isMe).toBe(false);
        });

        it('should use current user name when post is from current user', () => {
            const post: IPost = { id: '1', fromUserId: 'user-123' };
            const currentUser = { id: 'user-123', userName: 'currentuser' };

            const details = getUserDetails(post, currentUser, mockTranslate);

            expect(details.userName).toBe('currentuser');
            expect(details.isMe).toBe(true);
        });

        it('should use unknown name when post is from other user without username', () => {
            const post: IPost = { id: '1', fromUserId: 'user-456' };
            const currentUser = { id: 'user-123', userName: 'currentuser' };

            const details = getUserDetails(post, currentUser, mockTranslate);

            expect(details.userName).toBe('Unknown User');
        });
    });

    describe('parseHashtags', () => {
        it('should parse comma-separated hashtags', () => {
            const result = parseHashtags('food,travel,photography');
            expect(result).toEqual(['food', 'travel', 'photography']);
        });

        it('should return empty array for empty string', () => {
            const result = parseHashtags('');
            expect(result).toEqual([]);
        });

        it('should return empty array for undefined', () => {
            const result = parseHashtags(undefined);
            expect(result).toEqual([]);
        });

        it('should handle single hashtag', () => {
            const result = parseHashtags('singlehashtag');
            expect(result).toEqual(['singlehashtag']);
        });
    });
});

describe('Content Feed Refresh Handling', () => {
    describe('Refresh Logic', () => {
        const handleRefresh = async (
            updateMomentsStream: () => Promise<void>,
            updateThoughtsStream: () => Promise<void>,
            updateEventsStream: () => Promise<void>,
            activeTabIndex: number,
            tabMap: { [key: number]: string }
        ): Promise<void[]> => {
            const promises: Promise<void>[] = [];

            if (tabMap[activeTabIndex] === 'discoveries') {
                promises.push(updateMomentsStream());
                promises.push(updateThoughtsStream());
            }

            if (tabMap[activeTabIndex] === 'events') {
                promises.push(updateEventsStream());
            }

            return Promise.all(promises);
        };

        it('should refresh moments and thoughts for discoveries tab', async () => {
            const updateMoments = jest.fn().mockResolvedValue(undefined);
            const updateThoughts = jest.fn().mockResolvedValue(undefined);
            const updateEvents = jest.fn().mockResolvedValue(undefined);
            const tabMap = { 0: 'discoveries', 1: 'events' };

            await handleRefresh(updateMoments, updateThoughts, updateEvents, 0, tabMap);

            expect(updateMoments).toHaveBeenCalled();
            expect(updateThoughts).toHaveBeenCalled();
            expect(updateEvents).not.toHaveBeenCalled();
        });

        it('should refresh events for events tab', async () => {
            const updateMoments = jest.fn().mockResolvedValue(undefined);
            const updateThoughts = jest.fn().mockResolvedValue(undefined);
            const updateEvents = jest.fn().mockResolvedValue(undefined);
            const tabMap = { 0: 'discoveries', 1: 'events' };

            await handleRefresh(updateMoments, updateThoughts, updateEvents, 1, tabMap);

            expect(updateMoments).not.toHaveBeenCalled();
            expect(updateThoughts).not.toHaveBeenCalled();
            expect(updateEvents).toHaveBeenCalled();
        });
    });
});

describe('Content Feed Area Options Modal', () => {
    describe('toggleAreaOptions', () => {
        it('should toggle area options visibility', () => {
            let state = {
                areAreaOptionsVisible: false,
                selectedArea: {},
            };

            const toggleAreaOptions = (area: any) => {
                const wasVisible = state.areAreaOptionsVisible;
                state = {
                    areAreaOptionsVisible: !wasVisible,
                    selectedArea: wasVisible ? {} : area,
                };
            };

            const area = { id: 'area-1', notificationMsg: 'Test Area' };

            toggleAreaOptions(area);
            expect(state.areAreaOptionsVisible).toBe(true);
            expect(state.selectedArea).toEqual(area);

            toggleAreaOptions(area);
            expect(state.areAreaOptionsVisible).toBe(false);
            expect(state.selectedArea).toEqual({});
        });
    });

    describe('toggleThoughtOptions', () => {
        it('should toggle thought options visibility', () => {
            let state = {
                areThoughtOptionsVisible: false,
                selectedThought: {},
            };

            const toggleThoughtOptions = (thought: any) => {
                const wasVisible = state.areThoughtOptionsVisible;
                state = {
                    areThoughtOptionsVisible: !wasVisible,
                    selectedThought: wasVisible ? {} : thought,
                };
            };

            const thought = { id: 'thought-1', message: 'Test Thought' };

            toggleThoughtOptions(thought);
            expect(state.areThoughtOptionsVisible).toBe(true);
            expect(state.selectedThought).toEqual(thought);

            toggleThoughtOptions(thought);
            expect(state.areThoughtOptionsVisible).toBe(false);
            expect(state.selectedThought).toEqual({});
        });
    });
});

describe('Content Feed Random Loader Selection', () => {
    type LottieId = 'donut' | 'earth' | 'taco' | 'shopping' | 'happy-swing' | 'karaoke' | 'yellow-car' | 'zeppelin' | 'therr-black-rolling';

    const getRandomLoaderId = (options: LottieId[]): LottieId => {
        const selected = Math.floor(Math.random() * options.length);
        return options[selected];
    };

    describe('getRandomLoaderId', () => {
        it('should return a valid loader ID from options', () => {
            const options: LottieId[] = ['donut', 'earth', 'taco'];

            const result = getRandomLoaderId(options);

            expect(options).toContain(result);
        });

        it('should handle single option', () => {
            const options: LottieId[] = ['donut'];

            const result = getRandomLoaderId(options);

            expect(result).toBe('donut');
        });
    });
});
