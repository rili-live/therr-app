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

export interface ICampaign {
  id?: string;
  organizationId?: string;
  title: string;
  description: string;
  assetIds: string[]; // headlines, descriptions, media, etc.
  status: 'active' | 'paused' | 'removed';
  type: string;
  spaceId?: string;
  targetDailyBudget: number;
  costBiddingStrategy: string;
  targetLanguages: string[];
  targetLocations: string[];
  scheduleStartAt: Date;
  scheduleStopAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICampaignAsset {
  id?: string;
  creatorId?: string;
  organizationId?: string;
  media?: {
    path: string;
  };
  spaceId?: string;
  status?: string;// processing and AI status (accepted, optimized, rejected, etc.)
  type: string; // text, image, video, space, etc.
  headline?: string; // if type is text
  longText?: string; // if type is text
}
