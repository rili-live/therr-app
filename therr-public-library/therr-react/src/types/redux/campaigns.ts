export interface ICampaignsState {
    campaigns: any;
    searchResults?: any;
}

export enum CampaignActionTypes {
    CREATE_CAMPAIGN = 'CREATE_CAMPAIGN',
    GET_CAMPAIGN = 'GET_CAMPAIGN',
    SEARCH_MY_CAMPAIGNS = 'SEARCH_MY_CAMPAIGNS',
    UPDATE_CAMPAIGN = 'UPDATE_CAMPAIGN',
}
