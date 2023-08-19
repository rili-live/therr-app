// IDs of the elements on page, used to select/focus tabs
// eslint-disable-next-line no-shadow
export enum INavMenuContext {
  HEADER_PROFILE = 'header_profile',
  FOOTER_MESSAGES = 'footer_messages',
}

export interface ISpace {
    id: string;
    fromUserId: string;
    addressReadable?: string;
    locale: string;
    isPublic: true,
    message: string;
    notificationMsg: string;
    mediaIds: string;
    mentionsIds: string;
    hashTags: string;
    maxViews: number;
    latitude: number;
    longitude: number;
    radius: number;
    maxProximity: number;
    isMatureContent: boolean;
    isModeratorApproved: boolean;
    isForSale: boolean;
    isHirable: boolean;
    isPromotional: boolean;
    isExclusiveToGroups: boolean;
    category: string;
    region: string;
    createdAt: string;
    updatedAt: string;
    geom: string;
    areaType: string;
    phoneNumber?: string;
    websiteUrl?: string;
    menuUrl?: string;
    orderUrl?: string;
    reservationUrl?: string;
    businessTransactionId?: string;
    businessTransactionName?: string;
    isPointOfInterest?: boolean;
}
