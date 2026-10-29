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
// The same segment the web invite landings accept (therr-client-web habitsSubdomainRoutes.ts), and a
// superset of what sanitizeUserName produces.
const INVITE_USERNAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Whether a username can go into an /invite/:username link. `null` and `undefined` are rejected as
 * strings too: a template literal turns a missing value into exactly those words.
 */
export const isShareableUserName = (userName?: string | null): userName is string => (
    typeof userName === 'string'
    && userName !== 'null'
    && userName !== 'undefined'
    && INVITE_USERNAME_RE.test(userName)
);

/**
 * The link a user shares to invite a friend.
 *
 * An account can be fully admitted with no username yet (47 of 209 Friends with Habits accounts on
 * 2026-10-28, nine of them pact creators), and every share site passed `user.details.userName`
 * straight in — so their invites went out as `/invite/null`, or `/invite/` where a caller had
 * coalesced to '', which habits.therr.com answered with a bare 404. Without a usable username the
 * link is the generic invite landing instead, which still carries the install CTA. The share
 * message does not name the username, so nothing else in it breaks.
 */
export const buildInviteUrl = (locale: string, userName?: string | null) => buildShareUrl(
    locale,
    isShareableUserName(userName) ? `/invite/${userName}` : '/invite',
);
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

