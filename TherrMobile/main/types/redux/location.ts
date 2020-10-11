import Immutable from 'seamless-immutable';

export interface ILocationState extends Immutable.ImmutableObject<any> {
    permissions: any;
    settings: any;
}

export enum LocationActionTypes {
    COARSE_LOCATION_ALLOWED = 'coarse_location_allowed',
    FINE_LOCATION_ALLOWED = 'fine_location_allowed',
    GPS_STATUS_UPDATED = 'gps_status_updated',
    LOCATION_PERMISSIONS_UPDATED = 'location_permissions_updated',
}
