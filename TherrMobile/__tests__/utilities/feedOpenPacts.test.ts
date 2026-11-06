// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import {
    FIRST_OPEN_PACT_SLOT,
    MAX_FEED_OPEN_PACTS,
    OPEN_PACT_SLOT_SPACING,
    buildFeedOpenPactItems,
    feedOpenPactItemId,
    getOpenPactPitch,
    interleaveFeedOpenPacts,
    isFeedOpenPactItem,
} from '../../main/utilities/feedOpenPacts';
import { keepRenderedFeedOrder } from '../../main/utilities/feedRanking';

const buildPact = (overrides: Record<string, any> = {}): any => ({
    id: 'pact-1',
    status: 'active',
    habitGoalId: 'goal-1',
    durationDays: 30,
    createdAt: '2026-10-01T00:00:00.000Z',
    creatorUserId: 'creator-1',
    creatorUserName: 'sam',
    habitGoalName: 'Morning run',
    habitGoalCategory: 'fitness',
    memberCount: 1,
    hasPendingJoinRequest: false,
    ...overrides,
});

const posts = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `thought-${i}` }));

describe('getOpenPactPitch', () => {
    it('pitches a pact in a category the viewer already tracks as matching their interests', () => {
        expect(getOpenPactPitch(buildPact(), [{ goalName: 'Gym', goalCategory: 'Fitness' }])).toBe('interests');
    });

    it('matches the same habit by name when the category is missing', () => {
        const pact = buildPact({ habitGoalCategory: null, habitGoalName: '  Read   daily ' });
        expect(getOpenPactPitch(pact, [{ goalName: 'read daily', goalCategory: null }])).toBe('interests');
    });

    it('never matches on two missing categories', () => {
        const pact = buildPact({ habitGoalCategory: null, memberCount: 3 });
        expect(getOpenPactPitch(pact, [{ goalName: 'Journal', goalCategory: null }])).toBe('group');
    });

    it('pitches a pact with people in it as a group, and a lone creator as looking for a partner', () => {
        expect(getOpenPactPitch(buildPact({ memberCount: 2 }))).toBe('group');
        expect(getOpenPactPitch(buildPact({ memberCount: 1 }))).toBe('partner');
    });
});

describe('buildFeedOpenPactItems', () => {
    it('leads with interest matches, keeps server order within a pitch, and caps the count', () => {
        const pacts = [
            buildPact({ id: 'partner-a', habitGoalCategory: 'mindfulness' }),
            buildPact({ id: 'group-a', habitGoalCategory: 'mindfulness', memberCount: 3 }),
            buildPact({ id: 'match-a' }),
            buildPact({ id: 'group-b', habitGoalCategory: 'finance', memberCount: 2 }),
            buildPact({ id: 'match-b' }),
        ];

        const items = buildFeedOpenPactItems(pacts, [{ goalName: 'Gym', goalCategory: 'fitness' }]);

        expect(items.map((item) => item.pact.id)).toEqual(['match-a', 'match-b', 'group-a']);
        expect(items).toHaveLength(MAX_FEED_OPEN_PACTS);
        expect(items[0]).toMatchObject({ id: feedOpenPactItemId('match-a'), feedItemType: 'openPact', pitch: 'interests' });
    });

    it('sinks a pact the viewer already asked to join below ones they have not', () => {
        const items = buildFeedOpenPactItems([
            buildPact({ id: 'asked', hasPendingJoinRequest: true }),
            buildPact({ id: 'fresh', habitGoalCategory: 'finance' }),
        ], [{ goalName: 'Gym', goalCategory: 'fitness' }]);

        expect(items.map((item) => item.pact.id)).toEqual(['fresh', 'asked']);
    });

    it('returns nothing for no pacts', () => {
        expect(buildFeedOpenPactItems([], [])).toEqual([]);
        expect(buildFeedOpenPactItems(undefined, undefined)).toEqual([]);
    });
});

describe('interleaveFeedOpenPacts', () => {
    const cards = buildFeedOpenPactItems([
        buildPact({ id: 'a' }),
        buildPact({ id: 'b' }),
        buildPact({ id: 'c' }),
    ]);

    it('places the first card after the opening posts and spaces the rest out', () => {
        const ids = interleaveFeedOpenPacts(posts(20), cards).map((item: any) => item.id);
        const cardPositions = ids
            .map((id, index) => (id.startsWith('open-pact:') ? index : -1))
            .filter((index) => index >= 0);

        expect(ids).toHaveLength(23);
        expect(cardPositions).toEqual([
            FIRST_OPEN_PACT_SLOT,
            FIRST_OPEN_PACT_SLOT + OPEN_PACT_SLOT_SPACING + 1,
            FIRST_OPEN_PACT_SLOT + (OPEN_PACT_SLOT_SPACING * 2) + 2,
        ]);
    });

    it('shows every card on an empty or short feed rather than hiding them past the end', () => {
        expect(interleaveFeedOpenPacts([], cards).map((item: any) => item.id))
            .toEqual(['open-pact:a', 'open-pact:b', 'open-pact:c']);
        expect(interleaveFeedOpenPacts(posts(1), cards).map((item: any) => item.id))
            .toEqual(['thought-0', 'open-pact:a', 'open-pact:b', 'open-pact:c']);
    });

    it('leaves the posts untouched when there are no cards', () => {
        const feed = posts(4);
        expect(interleaveFeedOpenPacts(feed, [])).toBe(feed);
    });

    it('keeps cards in their slots through keepRenderedFeedOrder when posts page in', () => {
        const firstPage = interleaveFeedOpenPacts(posts(3), cards.slice(0, 1));
        const renderedIds = firstPage.map((item: any) => String(item.id));
        const secondPage = interleaveFeedOpenPacts(posts(6), cards.slice(0, 1));

        const ordered = keepRenderedFeedOrder(secondPage as any[], renderedIds).map((item: any) => item.id);

        expect(ordered).toEqual(['thought-0', 'thought-1', 'open-pact:a', 'thought-2', 'thought-3', 'thought-4', 'thought-5']);
    });

    it('tells cards from posts', () => {
        expect(isFeedOpenPactItem(cards[0])).toBe(true);
        expect(isFeedOpenPactItem({ id: 'thought-0' })).toBe(false);
        expect(isFeedOpenPactItem(undefined)).toBe(false);
    });
});
