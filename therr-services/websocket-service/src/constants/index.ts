import DisconnectReason from './socket/DisconnectReason';

export const ACTION = 'action';

export const COMMON_DATE_FORMAT = 'M/D/YY, h:mma';

// eslint-disable-next-line no-shadow
export enum UserStatus {
    ACTIVE = 'active',
    AWAY = 'away',
}

export {
    DisconnectReason,
};
