import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import reducer from '../campaigns';
import { CampaignActionTypes } from '../../../types/redux/campaigns';

describe('campaigns reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(initialState.campaigns).toBeDefined();
        expect(initialState.searchResults).toBeDefined();
    });

    it('handles CREATE_CAMPAIGN', () => {
        const result = reducer(initialState, {
            type: CampaignActionTypes.CREATE_CAMPAIGN,
            data: {
                campaigns: [
                    { id: 'c1', title: 'Campaign 1' },
                    { id: 'c2', title: 'Campaign 2' },
                ],
            },
        });
        expect(result.campaigns.c1.title).toBe('Campaign 1');
        expect(result.campaigns.c2.title).toBe('Campaign 2');
    });

    it('handles UPDATE_CAMPAIGN by merging', () => {
        const created = reducer(initialState, {
            type: CampaignActionTypes.CREATE_CAMPAIGN,
            data: { campaigns: [{ id: 'c1', title: 'Original', status: 'draft' }] },
        });
        const result = reducer(created, {
            type: CampaignActionTypes.UPDATE_CAMPAIGN,
            data: { campaigns: [{ id: 'c1', title: 'Updated' }] },
        });
        expect(result.campaigns.c1.title).toBe('Updated');
        expect(result.campaigns.c1.status).toBe('draft');
    });

    it('handles GET_CAMPAIGN for new campaign', () => {
        const result = reducer(initialState, {
            type: CampaignActionTypes.GET_CAMPAIGN,
            data: { id: 'c1', title: 'Fetched' },
        });
        expect(result.campaigns.c1.title).toBe('Fetched');
    });

    it('handles GET_CAMPAIGN for existing campaign (merges)', () => {
        const created = reducer(initialState, {
            type: CampaignActionTypes.CREATE_CAMPAIGN,
            data: { campaigns: [{ id: 'c1', title: 'Original', status: 'active' }] },
        });
        const result = reducer(created, {
            type: CampaignActionTypes.GET_CAMPAIGN,
            data: { id: 'c1', title: 'Updated' },
        });
        expect(result.campaigns.c1.title).toBe('Updated');
        expect(result.campaigns.c1.status).toBe('active');
    });

    it('handles SEARCH_MY_CAMPAIGNS', () => {
        const result = reducer(initialState, {
            type: CampaignActionTypes.SEARCH_MY_CAMPAIGNS,
            data: {
                results: [
                    { id: 'c1', title: 'Search Result 1' },
                    { id: 'c2', title: 'Search Result 2' },
                ],
            },
        });
        expect(result.searchResults.c1.title).toBe('Search Result 1');
        expect(result.searchResults.c2.title).toBe('Search Result 2');
    });

    it('handles LOGOUT', () => {
        const populated = reducer(initialState, {
            type: CampaignActionTypes.CREATE_CAMPAIGN,
            data: { campaigns: [{ id: 'c1', title: 'Test' }] },
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(Array.from(result.campaigns)).toEqual([]);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
