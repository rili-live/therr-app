const BASE_URL = 'https://www.therr.com';

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
