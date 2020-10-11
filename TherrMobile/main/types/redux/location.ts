import Immutable from 'seamless-immutable';

export interface ILocationState extends Immutable.ImmutableObject<any> {
    settings: any;
}

export enum LocationActionTypes {
    COARSE_LOCATION_ALLOWED = 'coarse_location_allowed',
    FINE_LOCATION_ALLOWED = 'fine_location_allowed',
    GPS_STATUS_UPDATED = 'gps_status_updated',
}
