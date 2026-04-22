/**
 * @jest-environment jsdom
 */

// Mock socket-io-middleware before any imports that depend on it
import { AccessLevels } from 'therr-js-utilities/constants';
import { getReturnTo, getRouteAfterLogin } from '../Login';

jest.mock('../../socket-io-middleware', () => ({
    socketIO: {
        on: jest.fn(),
        emit: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
    },
}));

// Mock UsersActions to avoid its transitive socket dependency
jest.mock('../../redux/actions/UsersActions', () => ({
    default: {},
}));

describe('getReturnTo', () => {
    it('returns the path for a valid returnTo param', () => {
        expect(getReturnTo('?returnTo=/spaces/123')).toBe('/spaces/123');
    });

    it('returns undefined when locationSearch is undefined', () => {
        expect(getReturnTo(undefined)).toBeUndefined();
    });

    it('returns undefined when locationSearch is empty string', () => {
        expect(getReturnTo('')).toBeUndefined();
    });

    it('returns undefined when returnTo param is absent', () => {
        expect(getReturnTo('?foo=bar')).toBeUndefined();
    });

    it('rejects double-slash open redirect attempts', () => {
        expect(getReturnTo('?returnTo=//evil.com')).toBeUndefined();
    });

    it('rejects absolute URL redirect attempts', () => {
        expect(getReturnTo('?returnTo=https://evil.com')).toBeUndefined();
    });

    it('allows paths with query params', () => {
        expect(getReturnTo('?returnTo=/spaces/123?claim=true')).toBe('/spaces/123?claim=true');
    });

    it('handles encoded returnTo values', () => {
        const encoded = encodeURIComponent('/spaces/abc');
        expect(getReturnTo(`?returnTo=${encoded}`)).toBe('/spaces/abc');
    });
});

describe('getRouteAfterLogin', () => {
    const verifiedUser: any = {
        details: {
            accessLevels: [AccessLevels.EMAIL_VERIFIED],
        },
    };

    const incompleteUser: any = {
        details: {
            accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        },
    };

    const nullUser: any = {
        details: {},
    };

    it('returns /explore when no returnTo and user is verified', () => {
        expect(getRouteAfterLogin(verifiedUser)).toBe('/explore');
    });

    it('returns returnTo path when user is verified', () => {
        expect(getRouteAfterLogin(verifiedUser, '/spaces/123')).toBe('/spaces/123');
    });

    it('returns /create-profile when user needs profile and no returnTo', () => {
        expect(getRouteAfterLogin(incompleteUser)).toBe('/create-profile');
    });

    it('returns /create-profile with encoded returnTo when user needs profile', () => {
        const result = getRouteAfterLogin(incompleteUser, '/spaces/123');
        expect(result).toBe(`/create-profile?returnTo=${encodeURIComponent('/spaces/123')}`);
    });

    it('returns /explore when user has no access levels and no returnTo', () => {
        expect(getRouteAfterLogin(nullUser)).toBe('/explore');
    });

    it('returns returnTo when user has no access levels', () => {
        expect(getRouteAfterLogin(nullUser, '/spaces/abc')).toBe('/spaces/abc');
    });

    it('returns /explore when user has both verified and missing properties', () => {
        const bothUser: any = {
            details: {
                accessLevels: [
                    AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES,
                    AccessLevels.EMAIL_VERIFIED,
                ],
            },
        };
        expect(getRouteAfterLogin(bothUser)).toBe('/explore');
    });
});
