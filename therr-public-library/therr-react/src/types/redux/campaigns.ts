import * as Immutable from 'seamless-immutable';

export interface ICampaignState extends Immutable.ImmutableObject<any> {
    campaigns: any;
}

export enum CampaignActionTypes {
    CREATE_CAMPAIGN = 'CREATE_CAMPAIGN',
}
