import e from 'express';
import DisconnectReason from './socket/DisconnectReason';

export const ACTION = 'action';

export const COMMON_DATE_FORMAT = 'M/D/YY, h:mma';

export enum UserStatus {
    ACTIVE = 'active',
    AWAY = 'away',
}

export {
    DisconnectReason,
};
