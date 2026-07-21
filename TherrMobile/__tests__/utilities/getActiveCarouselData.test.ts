// Mock notifee (imported transitively via main/constants)
jest.mock('@notifee/react-native', () => ({
    AndroidImportance: {
        DEFAULT: 3,
        HIGH: 4,
        LOW: 2,
        MIN: 1,
        NONE: 0,
    },
}));

import getActiveCarouselData from '../../main/utilities/getActiveCarouselData';

const translate = (key: string) => key;

const hoursAgo = (hours: number) => new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

describe('getActiveCarouselData', () => {
    describe('rankingScore sort', () => {
        it('orders thoughts by server-provided rankingScore, highest first', () => {
            const content = {
                activeMoments: [],
                activeSpaces: [],
                activeThoughts: [
                    { id: 'low', createdAt: hoursAgo(1), rankingScore: 0.2 },
                    { id: 'high', createdAt: hoursAgo(30), rankingScore: 5 },
                    { id: 'mid', createdAt: hoursAgo(2), rankingScore: 1.5 },
                ],
            };

            const data = getActiveCarouselData({
                activeTab: 'discoveries',
                content,
                isForBookmarks: false,
                shouldIncludeThoughts: true,
                shouldIncludeMoments: true,
                translate,
            }, 'rankingScore');

            expect(data.map((post: any) => post.id)).toEqual(['high', 'mid', 'low']);
        });

        it('blends unscored posts using the shared client-side fallback formula', () => {
            const content = {
                activeMoments: [
                    // Fresh moment with engagement — no server score, computed client-side
                    { id: 'fresh-moment', createdAt: hoursAgo(1), likeCount: 3, isDraft: false },
                ],
                activeSpaces: [],
                activeThoughts: [
                    { id: 'stale-thought', createdAt: hoursAgo(200), rankingScore: 0.05 },
                ],
            };

            const data = getActiveCarouselData({
                activeTab: 'discoveries',
                content,
                isForBookmarks: false,
                shouldIncludeThoughts: true,
                shouldIncludeMoments: true,
                translate,
            }, 'rankingScore');

            expect(data.map((post: any) => post.id)).toEqual(['fresh-moment', 'stale-thought']);
        });
    });

    it('preserves chronological ordering for the createdAt sort', () => {
        const content = {
            activeMoments: [],
            activeSpaces: [],
            activeThoughts: [
                { id: 'older', createdAt: hoursAgo(10), rankingScore: 99 },
                { id: 'newer', createdAt: hoursAgo(1), rankingScore: 0.1 },
            ],
        };

        const data = getActiveCarouselData({
            activeTab: 'thoughts',
            content,
            isForBookmarks: false,
            shouldIncludeThoughts: true,
            shouldIncludeMoments: false,
            translate,
        }, 'createdAt');

        expect(data.map((post: any) => post.id)).toEqual(['newer', 'older']);
    });
});
