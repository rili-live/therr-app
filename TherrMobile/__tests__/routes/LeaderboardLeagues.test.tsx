import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import LeagueHeader from '../../main/routes/Leaderboard/LeagueHeader';
import { getLeagueZone, getTier, getTierNameKey, ILeaderboardLeague } from '../../main/routes/Leaderboard/leagues';
import { buildStyles as buildLeaderboardStyles } from '../../main/styles/leaderboard';
import translator from '../../main/utilities/translator';

const themeLeaderboard = buildLeaderboardStyles('light');
const translate = (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key);

const league = (overrides: Partial<ILeaderboardLeague> = {}): ILeaderboardLeague => ({
    id: 'sapling',
    tierIndex: 2,
    tierCount: 6,
    size: 10,
    promoteCount: 2,
    demoteCount: 2,
    ...overrides,
});

const renderText = async (props: any) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <LeagueHeader themeLeaderboard={themeLeaderboard} translate={translate} {...props} />
        );
        await Promise.resolve();
    });
    return JSON.stringify(component!.toJSON());
};

describe('leaderboard leagues — helpers', () => {
    it('marks the promotion and relegation zones the way the weekly close draws them', () => {
        const current = league();

        expect([1, 2, 3, 8, 9, 10].map((rank) => getLeagueZone(rank, current)))
            .toEqual(['promote', 'promote', null, null, 'demote', 'demote']);
        expect(getLeagueZone(1, null)).toBeNull();
        expect(getLeagueZone(10, league({ tierIndex: 0, demoteCount: 0 }))).toBeNull();
    });

    it('reads an unknown or missing tier as the lowest one on the brand ladder', () => {
        expect(getTier('habits', null)?.id).toBe('seedling');
        expect(getTier('therr', 'not-a-tier')?.id).toBe('wanderer');
    });

    it('names every tier of every brand in all three locales', () => {
        ['habits', 'therr'].forEach((brand) => {
            ['seedling', 'sprout', 'sapling', 'bloom', 'oak', 'evergreen', 'wanderer', 'scout', 'pathfinder', 'trailblazer', 'cartographer', 'legend']
                .filter((tierId) => getTier(brand, tierId)?.id === tierId)
                .forEach((tierId) => {
                    ['en-us', 'es', 'fr-ca'].forEach((locale) => {
                        const key = getTierNameKey(brand, tierId);
                        expect(translator(locale, key)).not.toBe(key);
                    });
                });
        });
    });
});

describe('LeagueHeader', () => {
    it('shows the branded tier and both move lines with the neighbouring tiers', async () => {
        const text = await renderText({ brand: 'habits', league: league() });

        expect(text).toContain('🪴');
        expect(text).toContain('pages.leaderboard.leagues.title');
        expect(text).toContain('pages.leaderboard.leagues.promotionZone');
        expect(text).toContain('🌸 pages.leaderboard.leagues.tiers.habits.bloom');
        expect(text).toContain('🌿 pages.leaderboard.leagues.tiers.habits.sprout');
        expect(text).not.toContain('pages.leaderboard.leagues.topTier');
    });

    it('has nothing to drop to from the lowest tier and nothing to climb from the top one', async () => {
        const lowest = await renderText({ brand: 'therr', league: league({ id: 'wanderer', tierIndex: 0, demoteCount: 0 }) });
        expect(lowest).toContain('🥾');
        expect(lowest).not.toContain('pages.leaderboard.leagues.demotionZone');

        const top = await renderText({ brand: 'therr', league: league({ id: 'legend', tierIndex: 5, promoteCount: 0 }) });
        expect(top).toContain('pages.leaderboard.leagues.topTier');
        expect(top).not.toContain('pages.leaderboard.leagues.promotionZone');
    });

    it('explains a league too small to move anyone', async () => {
        const text = await renderText({
            brand: 'habits',
            league: league({ size: 3, promoteCount: 0, demoteCount: 0 }),
        });

        expect(text).toContain('pages.leaderboard.leagues.tooSmall');
    });

    it('renders nothing for a brand without tiers', async () => {
        const text = await renderText({ brand: 'teem', league: league() });

        expect(text).toBe('null');
    });
});
