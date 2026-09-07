import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';

const BASE_URL = CURRENT_BRAND_VARIATION === BrandVariations.HABITS
    ? 'https://habits.therr.com'
    : 'https://www.therr.com';

export const getLocaleUrlPrefix = (locale: string): string => {
    if (locale && locale !== 'en-us' && locale !== 'en') {
        return `/${locale}`;
    }
    return '';
};

export const buildShareUrl = (locale: string, path: string): string =>
    `${BASE_URL}${getLocaleUrlPrefix(locale)}${path}`;

export const buildSpaceUrl = (locale: string, id: string) => buildShareUrl(locale, `/spaces/${id}`);
export const buildMomentUrl = (locale: string, id: string) => buildShareUrl(locale, `/moments/${id}`);
export const buildEventUrl = (locale: string, id: string) => buildShareUrl(locale, `/events/${id}`);
export const buildInviteUrl = (locale: string, userName: string) => buildShareUrl(locale, `/invite/${userName}`);
export const buildUserUrl = (locale: string, id: string) => buildShareUrl(locale, `/users/${id}`);
export const buildGroupUrl = (locale: string, id: string) => buildShareUrl(locale, `/groups/${id}`);
export const buildPublicListUrl = (locale: string, ownerUserId: string, listSlug: string) =>
    buildShareUrl(locale, `/lists/${ownerUserId}/${listSlug}`);

export type ShareableEntityType = 'user' | 'space' | 'event' | 'group';

const SHARE_URL_BUILDERS: Record<ShareableEntityType, (locale: string, id: string) => string> = {
    user: buildUserUrl,
    space: buildSpaceUrl,
    event: buildEventUrl,
    group: buildGroupUrl,
};

export const buildEntityShareUrl = (
    entityType: ShareableEntityType,
    locale: string,
    id: string,
): string => SHARE_URL_BUILDERS[entityType](locale, id);

