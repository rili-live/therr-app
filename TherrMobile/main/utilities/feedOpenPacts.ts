import { IOpenPact } from 'therr-react/types';

/**
 * Open pacts sprinkled into the Friends with Habits feed (routes/HabitsFeed).
 *
 * The feed is only as full as people's shared check-ins, and most check-ins are never shared, so
 * on its own it is often a short list or an empty one. Open pacts are the other public thing the
 * app has: pacts whose creator chose to let people on the same habit ask to join. Showing a few of
 * them between posts gives every feed something to act on, and gives open pacts the audience they
 * otherwise only get from a pact nobody answered (PactDetail) or the digest push.
 *
 * Kept free of React Native imports so it can be unit-tested directly.
 */

/** Why a card says "join this" — decides its headline. Ordered by how strong the reason is. */
export type FeedPactPitch = 'interests' | 'group' | 'partner';

/** A card's slot in the feed's list data. `id` is prefixed so it can never equal a thought id. */
export interface IFeedOpenPactItem {
    id: string;
    feedItemType: 'openPact';
    pact: IOpenPact;
    pitch: FeedPactPitch;
}

/** The most cards one feed shows. A sprinkle, not a directory — the full list is the OpenPacts screen. */
export const MAX_FEED_OPEN_PACTS = 3;

/** Posts before the first card, so the feed still opens on what people shared. */
export const FIRST_OPEN_PACT_SLOT = 2;

/** Posts between cards after the first. */
export const OPEN_PACT_SLOT_SPACING = 5;

const PITCH_RANK: Record<FeedPactPitch, number> = {
    interests: 0,
    group: 1,
    partner: 2,
};

export const feedOpenPactItemId = (pactId: string) => `open-pact:${pactId}`;

const normalize = (value?: string | null) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

interface IViewerHabitLike {
    goalName?: string | null;
    goalCategory?: string | null;
}

/**
 * "Matches your interests" means a habit the viewer already tracks: the same category, or the
 * same habit by name. Their habits are the most honest read of their interests the app has, and
 * unlike `userInterests` (a Therr onboarding concept) every habits user has some.
 *
 * Otherwise a pact that already has people in it is pitched as a group, and a creator on their
 * own as someone looking for a partner.
 */
export const getOpenPactPitch = (pact: IOpenPact, viewerHabits: IViewerHabitLike[] = []): FeedPactPitch => {
    const category = normalize(pact.habitGoalCategory);
    const name = normalize(pact.habitGoalName);
    const isInterestMatch = viewerHabits.some((habit) => (
        (!!category && normalize(habit.goalCategory) === category)
        || (!!name && normalize(habit.goalName) === name)
    ));

    if (isInterestMatch) {
        return 'interests';
    }

    return (pact.memberCount || 0) >= 2 ? 'group' : 'partner';
};

/**
 * The cards to show, best first: strongest pitch, then the order the server listed them in (most
 * recently active). A pact the viewer has already asked to join goes last — it still shows so the
 * request can be cancelled, but it should not hold a top slot over one they have not seen.
 */
export const buildFeedOpenPactItems = (
    pacts: IOpenPact[] = [],
    viewerHabits: IViewerHabitLike[] = [],
    max = MAX_FEED_OPEN_PACTS,
): IFeedOpenPactItem[] => pacts
    .map((pact, index) => ({ pact, index, pitch: getOpenPactPitch(pact, viewerHabits) }))
    .sort((a, b) => (Number(a.pact.hasPendingJoinRequest) - Number(b.pact.hasPendingJoinRequest))
        || (PITCH_RANK[a.pitch] - PITCH_RANK[b.pitch])
        || (a.index - b.index))
    .slice(0, Math.max(0, max))
    .map(({ pact, pitch }) => ({
        id: feedOpenPactItemId(pact.id),
        feedItemType: 'openPact',
        pact,
        pitch,
    }));

/**
 * Places cards between posts: the first after `FIRST_OPEN_PACT_SLOT` posts, then one every
 * `OPEN_PACT_SLOT_SPACING`. When the feed runs out of posts first, the remaining cards follow the
 * last post — so a short or empty feed shows them all rather than hiding them below posts that do
 * not exist.
 */
export const interleaveFeedOpenPacts = <T>(posts: T[] = [], cards: IFeedOpenPactItem[] = []): Array<T | IFeedOpenPactItem> => {
    if (!cards.length) {
        return posts;
    }

    const result: Array<T | IFeedOpenPactItem> = [];
    let cardIndex = 0;
    let nextSlot = FIRST_OPEN_PACT_SLOT;

    posts.forEach((post, postIndex) => {
        if (postIndex === nextSlot && cardIndex < cards.length) {
            result.push(cards[cardIndex]);
            cardIndex += 1;
            nextSlot += OPEN_PACT_SLOT_SPACING;
        }
        result.push(post);
    });

    return result.concat(cards.slice(cardIndex));
};

export const isFeedOpenPactItem = (item: any): item is IFeedOpenPactItem => item?.feedItemType === 'openPact';
