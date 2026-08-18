import { it, describe, expect } from '@jest/globals';
import { getPostSubmitDestination } from '../../main/routes/EditThought/postSubmitDestination';

/**
 * Where the thought form sends the user after a successful post.
 *
 * The default (Areas feed, or the author's own profile when Areas is off) is
 * fine for the entry points that have no opinion. The ones that do — the
 * journal's "share a goal" — pass `returnToRoute`, and landing the user
 * somewhere else is the whole bug this covers.
 */
describe('EditThought post-submit destination', () => {
    it('returns the caller to the route it asked for', () => {
        expect(getPostSubmitDestination({
            returnToRoute: 'Journal',
            isAreasEnabled: false,
            userId: 'user-1',
        })).toEqual({ route: 'Journal', params: undefined });
    });

    it('passes the caller\'s params through', () => {
        expect(getPostSubmitDestination({
            returnToRoute: 'Journal',
            returnToRouteParams: { scrollToTop: true },
            isAreasEnabled: false,
            userId: 'user-1',
        })).toEqual({ route: 'Journal', params: { scrollToTop: true } });
    });

    it('honors the override even where the Areas feed exists', () => {
        // Otherwise the same journal flow would land on a feed in one app and
        // on the profile in another, depending on a flag it has nothing to do
        // with.
        expect(getPostSubmitDestination({
            returnToRoute: 'Journal',
            isAreasEnabled: true,
            userId: 'user-1',
        }).route).toEqual('Journal');
    });

    it('falls back to the Areas feed when it is enabled', () => {
        expect(getPostSubmitDestination({
            isAreasEnabled: true,
            userId: 'user-1',
        })).toEqual({ route: 'Areas' });
    });

    it('falls back to the author\'s profile when Areas is disabled', () => {
        expect(getPostSubmitDestination({
            isAreasEnabled: false,
            userId: 'user-1',
        })).toEqual({
            route: 'ViewUser',
            params: { userInView: { id: 'user-1' } },
        });
    });
});
