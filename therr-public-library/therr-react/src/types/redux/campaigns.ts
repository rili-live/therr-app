import * as Immutable from 'seamless-immutable';

export interface ICampaignsState extends Immutable.ImmutableObject<any> {
    campaigns: any;
}

export enum CampaignActionTypes {
    CREATE_CAMPAIGN = 'CREATE_CAMPAIGN',
    GET_CAMPAIGN = 'GET_CAMPAIGN',
    SEARCH_MY_CAMPAIGNS = 'SEARCH_MY_CAMPAIGNS',
    UPDATE_CAMPAIGN = 'UPDATE_CAMPAIGN',
}
