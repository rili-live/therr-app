/**
 * @jest-environment jsdom
 */

import { normalizeInviteUserName } from '../utilities/habitsSubdomainRoutes';
import { getInviteJoinPath } from '../routes/InviteLanding';

describe('InviteLanding', () => {
    describe('normalizeInviteUserName', () => {
        // Regression: the app shared /invite/null for accounts without a username.
        it('reads missing and placeholder usernames as nobody', () => {
            expect(normalizeInviteUserName(undefined)).toBe('');
            expect(normalizeInviteUserName(null)).toBe('');
            expect(normalizeInviteUserName('')).toBe('');
            expect(normalizeInviteUserName('null')).toBe('');
            expect(normalizeInviteUserName('undefined')).toBe('');
            expect(normalizeInviteUserName('Null')).toBe('');
        });

        it('keeps real usernames', () => {
            expect(normalizeInviteUserName('zizzle6717')).toBe('zizzle6717');
            expect(normalizeInviteUserName('nullable')).toBe('nullable');
        });
    });

    describe('getInviteJoinPath', () => {
        it('carries the inviter as the invite code', () => {
            expect(getInviteJoinPath('zizzle6717')).toBe('/register?invite-code=zizzle6717');
        });

        it('sends a username-less invite to plain sign-up rather than ?invite-code=null', () => {
            expect(getInviteJoinPath('')).toBe('/register');
        });
    });
});
