/**
 * @jest-environment jsdom
 */

import { UUID_V4_RE, matchHabitsInviteRoute } from '../utilities/habitsSubdomainRoutes';

describe('habitsSubdomainRoutes', () => {
    // Regression: the habits.therr.com middleware in server-client.tsx hard-404s any
    // path outside its allowlist, and invite/pact URLs are minted against that host by
    // the HABITS brand's own emails and SMS. Every one of these 404'd in production.
    describe('matchHabitsInviteRoute', () => {
        it('matches a username invite', () => {
            expect(matchHabitsInviteRoute('/invite/zizzle6717')).toEqual({
                kind: 'invite-username',
                value: 'zizzle6717',
            });
        });

        it('matches a magic invite link ahead of the username route', () => {
            // '/invite/:username' cannot span the extra segment, so a mismatch here
            // would mean a 404, not a wrong-but-rendered page.
            expect(matchHabitsInviteRoute('/invite/link/2a8f9c1e-7b3d-4a2e-9f11-6c5d4e3b2a10')).toEqual({
                kind: 'invite-link',
                value: '2a8f9c1e-7b3d-4a2e-9f11-6c5d4e3b2a10',
            });
        });

        it('matches a pact-claim link', () => {
            expect(matchHabitsInviteRoute('/claim-pact/2a8f9c1e-7b3d-4a2e-9f11-6c5d4e3b2a10')).toEqual({
                kind: 'claim-pact',
                value: '2a8f9c1e-7b3d-4a2e-9f11-6c5d4e3b2a10',
            });
        });

        it('tolerates a trailing slash', () => {
            expect(matchHabitsInviteRoute('/invite/zizzle6717/')?.kind).toBe('invite-username');
            expect(matchHabitsInviteRoute('/claim-pact/2a8f9c1e-7b3d-4a2e-9f11-6c5d4e3b2a10/')?.kind).toBe('claim-pact');
        });

        it('matches usernames containing dots, dashes and underscores', () => {
            expect(matchHabitsInviteRoute('/invite/first.last_name-2')).toEqual({
                kind: 'invite-username',
                value: 'first.last_name-2',
            });
        });

        it('returns null for paths the habits allowlist owns', () => {
            expect(matchHabitsInviteRoute('/')).toBeNull();
            expect(matchHabitsInviteRoute('/privacy-policy')).toBeNull();
            expect(matchHabitsInviteRoute('/u/zizzle6717')).toBeNull();
        });

        it('reads a tokenless invite link as an invite, not as a user named "link"', () => {
            expect(matchHabitsInviteRoute('/invite/link')).toEqual({ kind: 'invite-link', value: '' });
            expect(matchHabitsInviteRoute('/invite/link/')).toEqual({ kind: 'invite-link', value: '' });
        });

        it('returns null for malformed invite paths', () => {
            expect(matchHabitsInviteRoute('/invite')).toBeNull();
            expect(matchHabitsInviteRoute('/invite/')).toBeNull();
            expect(matchHabitsInviteRoute('/invite/user/extra/segments')).toBeNull();
            expect(matchHabitsInviteRoute('/claim-pact/short')).toBeNull();
        });

        it('does not match usernames containing path traversal or URL-unsafe characters', () => {
            expect(matchHabitsInviteRoute('/invite/../../etc/passwd')).toBeNull();
            expect(matchHabitsInviteRoute('/invite/<script>')).toBeNull();
        });
    });

    describe('UUID_V4_RE', () => {
        // Gates the pre-signup token lookup: the gateway validates isUUID(4), so a
        // non-UUID token must skip the round-trip rather than 400.
        it('accepts a v4 UUID in either case', () => {
            expect(UUID_V4_RE.test('2a8f9c1e-7b3d-4a2e-9f11-6c5d4e3b2a10')).toBe(true);
            expect(UUID_V4_RE.test('2A8F9C1E-7B3D-4A2E-9F11-6C5D4E3B2A10')).toBe(true);
        });

        it('rejects non-v4 and malformed tokens', () => {
            expect(UUID_V4_RE.test('2a8f9c1e-7b3d-1a2e-9f11-6c5d4e3b2a10')).toBe(false); // v1
            expect(UUID_V4_RE.test('not-a-uuid-at-all')).toBe(false);
            expect(UUID_V4_RE.test('2a8f9c1e7b3d4a2e9f116c5d4e3b2a10')).toBe(false);
        });
    });
});
