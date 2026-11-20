import { Text } from 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import { UsersService } from 'therr-react/services';
import { Leaderboard } from '../../main/routes/Leaderboard';
import LeagueHeader from '../../main/routes/Leaderboard/LeagueHeader';
import { getLeagueNameKey, getLeagueZone, ILeaderboardLeagueStatus, resolveLeague } from '../../main/routes/Leaderboard/leagues';
import { buildStyles as buildLeaderboardStyles } from '../../main/styles/leaderboard';
import translator from '../../main/utilities/translator';

jest.mock('therr-react/services', () => ({
    UsersService: {
        getLeaderboard: jest.fn(),
    },
}));
jest.mock('../../main/components/ButtonMenu/MainButtonMenu', () => () => null);

const themeLeaderboard = buildLeaderboardStyles('light');
const translate = (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key);

const league = (overrides: Partial<ILeaderboardLeagueStatus> = {}): ILeaderboardLeagueStatus => ({
    id: 'sapling',
    leagueIndex: 2,
    leagueCount: 6,
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

        expect([1, 2, 3, 8, 9, 10].map((rank) => getLeagueZone(rank, rank, current)))
            .toEqual(['promote', 'promote', null, null, 'demote', 'demote']);
        expect(getLeagueZone(1, 1, null)).toBeNull();
        expect(getLeagueZone(10, 10, league({ leagueIndex: 0, demoteCount: 0 }))).toBeNull();
    });

    it('promotes by board position, so a tie on the line splits the way the close does', () => {
        const current = league();

        // Ranks 2, 2, 2 at positions 2, 3, 4: with 2 moving up, only the first of the tie does.
        expect([[1, 1], [2, 2], [2, 3], [2, 4]].map(([rank, position]) => getLeagueZone(rank, position, current)))
            .toEqual(['promote', 'promote', null, null]);
        // A tie straddling the relegation line is spared: ranks 8, 8, 8 at positions 8–10.
        expect([8, 9, 10].map((position) => getLeagueZone(8, position, current))).toEqual([null, null, null]);
    });

    it('reads an unknown or missing league as the lowest one on the brand ladder', () => {
        expect(resolveLeague('habits', null)?.id).toBe('seedling');
        expect(resolveLeague('therr', 'not-a-league')?.id).toBe('wanderer');
    });

    it('names every league of every brand in all three locales', () => {
        ['habits', 'therr'].forEach((brand) => {
            ['seedling', 'sprout', 'sapling', 'bloom', 'oak', 'evergreen', 'wanderer', 'scout', 'pathfinder', 'trailblazer', 'cartographer', 'legend']
                .filter((leagueId) => resolveLeague(brand, leagueId)?.id === leagueId)
                .forEach((leagueId) => {
                    ['en-us', 'es', 'fr-ca'].forEach((locale) => {
                        const key = getLeagueNameKey(brand, leagueId);
                        expect(translator(locale, key)).not.toBe(key);
                    });
                });
        });
    });
});

describe('LeagueHeader', () => {
    it('shows the branded league and both move lines with the neighbouring leagues', async () => {
        const text = await renderText({ brand: 'habits', league: league() });

        expect(text).toContain('🪴');
        expect(text).toContain('pages.leaderboard.leagues.title');
        expect(text).toContain('pages.leaderboard.leagues.promotionZone');
        expect(text).toContain('🌸 pages.leaderboard.leagues.names.habits.bloom');
        expect(text).toContain('🌿 pages.leaderboard.leagues.names.habits.sprout');
        expect(text).not.toContain('pages.leaderboard.leagues.topLeague');
    });

    it('has nothing to drop to from the lowest league and nothing to climb from the top one', async () => {
        const lowest = await renderText({ brand: 'therr', league: league({ id: 'wanderer', leagueIndex: 0, demoteCount: 0 }) });
        expect(lowest).toContain('🥾');
        expect(lowest).not.toContain('pages.leaderboard.leagues.demotionZone');

        const top = await renderText({ brand: 'therr', league: league({ id: 'legend', leagueIndex: 5, promoteCount: 0 }) });
        expect(top).toContain('pages.leaderboard.leagues.topLeague');
        expect(top).not.toContain('pages.leaderboard.leagues.promotionZone');
    });

    it('explains a league too small to move anyone', async () => {
        const text = await renderText({
            brand: 'habits',
            league: league({ size: 3, promoteCount: 0, demoteCount: 0 }),
        });

        expect(text).toContain('pages.leaderboard.leagues.tooSmall');
    });

    it('renders nothing for a brand without leagues', async () => {
        const text = await renderText({ brand: 'teem', league: league() });

        expect(text).toBe('null');
    });
});

describe('Leaderboard screen — first load', () => {
    const getLeaderboard = UsersService.getLeaderboard as unknown as jest.Mock<any>;
    const navigation = { setOptions: jest.fn(), navigate: jest.fn() };
    const user = { details: { id: 'user-1' }, settings: { locale: 'en-us', mobileThemeName: 'light' } };
    const board = (overrides: any = {}) => ({
        data: {
            entries: [{ userId: 'user-2', userName: 'two', points: 40, rank: 1, isRequestingUser: false }],
            currentUser: null,
            periodEnd: '2026-09-21',
            scope: 'global',
            league: null,
            ...overrides,
        },
    });

    const renderScreen = async () => {
        let component: renderer.ReactTestRenderer;
        await act(async () => {
            component = renderer.create(<Leaderboard navigation={navigation} user={user as any} />);
            await Promise.resolve();
        });
        await act(async () => { await Promise.resolve(); });
        return component!;
    };
    const textOf = (component: renderer.ReactTestRenderer) => component.root.findAllByType(Text)
        .map((node) => [].concat(node.props.children).join(''))
        .join('|');

    beforeEach(() => {
        getLeaderboard.mockReset();
    });

    it('asks for the league board once and opens on it when a league is running', async () => {
        getLeaderboard.mockResolvedValue(board({ scope: 'league', league: league() }));

        const component = await renderScreen();

        expect(getLeaderboard).toHaveBeenCalledTimes(1);
        expect(getLeaderboard.mock.calls[0][0]).toMatchObject({ scope: 'league', period: 'week' });
        expect(textOf(component)).toContain('League 3 of 6');
        await act(async () => { component.unmount(); });
    });

    it('shows the global board from that same request when no league is running', async () => {
        getLeaderboard.mockResolvedValue(board());

        const component = await renderScreen();

        expect(getLeaderboard).toHaveBeenCalledTimes(1);
        expect(textOf(component)).not.toContain('League 3 of 6');
        expect(textOf(component)).toContain('two');
        await act(async () => { component.unmount(); });
    });
});
