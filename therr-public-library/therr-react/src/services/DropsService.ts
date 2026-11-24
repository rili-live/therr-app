/* eslint-disable class-methods-use-this */
import axios from 'axios';

/**
 * Drops — a note or photo left at a place for one connection, which opens only once that person
 * goes there. See docs/DROPS.md.
 */

export interface IDropMedia {
    /** The uploaded object's path, as returned by the signed-upload flow. Must be the sender's own. */
    path: string;
    /** A `Content.mediaTypes` value; drops are always private-bucket media. */
    type: string;
}

export interface ICreateDropBody {
    /** One drop row is created per recipient. Every recipient must be a live connection. */
    recipientIds: string[];
    message?: string;
    media?: IDropMedia | null;
    latitude: number;
    longitude: number;
    /** The sender's own label for where it is ("the bench by the fountain"). */
    placeName?: string;
    spaceId?: string | null;
    /** Clamped server-side to the allowed range; omit for the default. */
    unlockRadiusMeters?: number;
}

export interface IOpenDropBody {
    latitude: number;
    longitude: number;
    /** The device's reported horizontal accuracy in metres, when known. */
    accuracy?: number;
    /** False keeps the sender from being told the drop was opened. Defaults to true. */
    shouldNotifySender?: boolean;
}

export type DropStatus = 'locked' | 'opened' | 'expired';

export interface IDropUser {
    id: string;
    userName: string;
    firstName?: string;
    lastName?: string;
    media?: any;
}

export interface IDrop {
    id: string;
    status: DropStatus;
    isSender: boolean;
    fromUser: IDropUser | null;
    toUser: IDropUser | null;
    latitude: number;
    longitude: number;
    unlockRadiusMeters: number;
    placeName: string | null;
    spaceId: string | null;
    createdAt: string;
    expiresAt: string;
    /** The day it was opened (YYYY-MM-DD) — never the time. Null until opened. */
    openedOn: string | null;
    /** Withheld from the recipient until the drop is opened. */
    message: string | null;
    hasMedia: boolean;
    /** A ready-to-render URL; present only when the caller may see the content. */
    mediaUrl: string | null;
}

class DropsService {
    getReceived = () => axios({
        method: 'get',
        url: '/users-service/drops/received',
    });

    getSent = () => axios({
        method: 'get',
        url: '/users-service/drops/sent',
    });

    getById = (id: string) => axios({
        method: 'get',
        url: `/users-service/drops/${id}`,
    });

    create = (data: ICreateDropBody) => axios({
        method: 'post',
        url: '/users-service/drops',
        data,
    });

    open = (id: string, data: IOpenDropBody) => axios({
        method: 'post',
        url: `/users-service/drops/${id}/open`,
        data,
    });

    /** The sender deletes the drop; the recipient dismisses it from their own list. */
    remove = (id: string) => axios({
        method: 'delete',
        url: `/users-service/drops/${id}`,
    });
}

export default new DropsService();
