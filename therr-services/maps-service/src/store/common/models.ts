import { ICreateMediaParams } from '../MediaStore';

export interface INearbySpacesSnapshot {
    id: string;
    title: string;
}

export interface ICreateAreaParams {
    areaType?: string;
    createdAt?: any;
    category?: any;
    expiresAt?: any;
    fromUserId: string;
    locale: string;
    isPublic?: boolean;
    isMatureContent?: boolean;
    message: string;
    notificationMsg?: string;
    mediaIds?: string;
    medias?: {
        altText: string;
        type: string;
        path: string;
    }[];
    media?: ICreateMediaParams[];
    mentionsIds?: string;
    hashTags?: string;
    maxViews?: number;
    maxProximity?: number;
    latitude: number;
    longitude: number;
    radius?: number;
    polygonCoords?: string;
}

export interface IDeleteAreasParams {
    fromUserId: string;
    ids: string[];
}
