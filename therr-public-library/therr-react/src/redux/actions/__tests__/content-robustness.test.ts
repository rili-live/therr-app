import Content from '../Content';
import { ContentActionTypes } from '../../../types/redux/content';

// Mock ReactionsService
jest.mock('../../../services/ReactionsService', () => ({
    __esModule: true,
    default: {
        searchActiveEvents: jest.fn(),
        searchActiveEventsByIds: jest.fn(),
        searchActiveMoments: jest.fn(),
        searchActiveMomentsByIds: jest.fn(),
        searchActiveSpaces: jest.fn(),
        searchActiveSpacesByIds: jest.fn(),
        searchActiveThoughts: jest.fn(),
        searchBookmarkedEvents: jest.fn(),
        searchBookmarkedMoments: jest.fn(),
        searchBookmarkedSpaces: jest.fn(),
        searchBookmarkedThoughts: jest.fn(),
        createOrUpdateEventReaction: jest.fn(),
        createOrUpdateMomentReaction: jest.fn(),
        createOrUpdateSpaceReaction: jest.fn(),
        createOrUpdateThoughtReaction: jest.fn(),
    },
}));

jest.mock('../../../services/MapsService', () => ({
    __esModule: true,
    default: {
        searchMyMoments: jest.fn(),
        deleteMoments: jest.fn(),
    },
}));

jest.mock('../../../services', () => ({
    MapsService: {
        searchMyMoments: jest.fn(),
        deleteMoments: jest.fn(),
    },
}));

// eslint-disable-next-line import/first
import ReactionsService from '../../../services/ReactionsService';

describe('Content Redux Actions - Error Propagation', () => {
    let dispatch: jest.Mock;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        dispatch = jest.fn();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { /* noop */ });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('searchActiveEvents', () => {
        it('should dispatch on success', async () => {
            const mockData = { events: [{ id: '1' }] };
            (ReactionsService.searchActiveEvents as jest.Mock).mockResolvedValue({ data: mockData });

            await Content.searchActiveEvents({ offset: 0, withMedia: false, withUser: false })(dispatch);

            expect(dispatch).toHaveBeenCalledWith({
                type: ContentActionTypes.SEARCH_ACTIVE_EVENTS,
                data: mockData,
            });
        });

        it('should log and re-throw on API failure', async () => {
            const error = new Error('Network error');
            (ReactionsService.searchActiveEvents as jest.Mock).mockRejectedValue(error);

            await expect(
                Content.searchActiveEvents({ offset: 0, withMedia: false, withUser: false })(dispatch),
            ).rejects.toThrow('Network error');

            // Error should be logged before re-throw
            expect(consoleSpy).toHaveBeenCalledWith(error);
            // dispatch should NOT have been called (API failed before dispatch)
            expect(dispatch).not.toHaveBeenCalled();
        });
    });

    describe('searchActiveMoments', () => {
        it('should log and re-throw on API failure', async () => {
            const error = new Error('Service unavailable');
            (ReactionsService.searchActiveMoments as jest.Mock).mockRejectedValue(error);

            await expect(
                Content.searchActiveMoments({ offset: 0, withMedia: false, withUser: false })(dispatch),
            ).rejects.toThrow('Service unavailable');

            expect(consoleSpy).toHaveBeenCalledWith(error);
            expect(dispatch).not.toHaveBeenCalled();
        });
    });

    describe('searchActiveSpaces', () => {
        it('should log and re-throw on API failure', async () => {
            const error = new Error('Timeout');
            (ReactionsService.searchActiveSpaces as jest.Mock).mockRejectedValue(error);

            await expect(
                Content.searchActiveSpaces({ offset: 0, withMedia: false, withUser: false })(dispatch),
            ).rejects.toThrow('Timeout');

            expect(consoleSpy).toHaveBeenCalledWith(error);
        });
    });

    describe('searchActiveThoughts', () => {
        it('should log and re-throw on API failure', async () => {
            const error = new Error('Auth expired');
            (ReactionsService.searchActiveThoughts as jest.Mock).mockRejectedValue(error);

            await expect(
                Content.searchActiveThoughts({ offset: 0, withMedia: false, withUser: false })(dispatch),
            ).rejects.toThrow('Auth expired');

            expect(consoleSpy).toHaveBeenCalledWith(error);
        });
    });

    describe('createOrUpdateSpaceReaction', () => {
        it('should dispatch on success', async () => {
            const mockReaction = { spaceId: '1', rating: 5 };
            (ReactionsService.createOrUpdateSpaceReaction as jest.Mock).mockResolvedValue({ data: mockReaction });

            await Content.createOrUpdateSpaceReaction(1, { rating: 5 } as any, 'user-1', 'testuser')(dispatch);

            expect(dispatch).toHaveBeenCalled();
        });

        it('should log and re-throw on API failure', async () => {
            const error = new Error('Rate limited');
            (ReactionsService.createOrUpdateSpaceReaction as jest.Mock).mockRejectedValue(error);

            await expect(
                Content.createOrUpdateSpaceReaction(1, { rating: 5 } as any, 'user-1', 'testuser')(dispatch),
            ).rejects.toThrow('Rate limited');

            expect(consoleSpy).toHaveBeenCalledWith(error);
        });
    });
});
