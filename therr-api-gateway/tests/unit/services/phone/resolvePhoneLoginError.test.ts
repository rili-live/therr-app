/**
 * Unit tests for the gateway's mapping of users-service `/auth/phone` failures onto client
 * responses.
 *
 * Regression guard: the original mapping only handled 403/404 and let every other status fall
 * into the generic branch, so an account whose email had never been verified answered 401 and
 * the caller saw a 500 "SQL:PHONE_ROUTES:ERROR" — an unrecoverable-looking error for a
 * perfectly recoverable situation.
 */
import { expect } from 'chai';
import resolvePhoneLoginError from '../../../../src/services/phone/resolvePhoneLoginError';

const usersServiceError = (statusCode: number, data: any = {}) => ({
    response: {
        status: statusCode,
        data: { statusCode, ...data },
    },
});

describe('resolvePhoneLoginError', () => {
    it('surfaces the unverified-email 401 instead of reporting a server error', () => {
        const resolved = resolvePhoneLoginError(
            usersServiceError(401, { message: 'Your account has not been verified' }),
        );

        expect(resolved.statusCode).to.equal(401);
        expect(resolved.message).to.equal('Your account has not been verified');
    });

    it('surfaces a 400 (e.g. a phone number needing account selection) rather than a 500', () => {
        const resolved = resolvePhoneLoginError(
            usersServiceError(400, { message: 'Multiple accounts are associated with this phone number' }),
        );

        expect(resolved.statusCode).to.equal(400);
        expect(resolved.message).to.equal('Multiple accounts are associated with this phone number');
    });

    it('forwards an errorCode when the users-service supplied one', () => {
        const resolved = resolvePhoneLoginError(usersServiceError(400, { errorCode: 'USER_EXISTS' }));

        expect(resolved.errorCode).to.equal('USER_EXISTS');
    });

    it('falls back to a generic message when a 4xx carries none', () => {
        const resolved = resolvePhoneLoginError(usersServiceError(422));

        expect(resolved.statusCode).to.equal(422);
        expect(resolved.message).to.equal('Unable to sign in with this phone number');
    });

    it('collapses 403 and 404 into one indistinguishable answer', () => {
        // A blocked account and an account that isn't on this number must look identical to
        // "no such account", or the endpoint becomes an account-state oracle.
        const blocked = resolvePhoneLoginError(usersServiceError(403, { message: 'Account is blocked' }));
        const notFound = resolvePhoneLoginError(usersServiceError(404, { message: 'No user found' }));

        expect(blocked).to.deep.equal(notFound);
        expect(blocked.statusCode).to.equal(404);
        expect(blocked.message).to.equal('No account found for this phone number');
    });

    it('reports a genuine server-side failure as one', () => {
        const err = usersServiceError(500);
        const resolved = resolvePhoneLoginError(err);

        expect(resolved.statusCode).to.equal(undefined);
        expect(resolved.message).to.equal('SQL:PHONE_ROUTES:ERROR');
        expect(resolved.err).to.equal(err);
    });

    it('reports a transport failure with no response as a server error', () => {
        const err = new Error('socket hang up');
        const resolved = resolvePhoneLoginError(err);

        expect(resolved.statusCode).to.equal(undefined);
        expect(resolved.message).to.equal('SQL:PHONE_ROUTES:ERROR');
        expect(resolved.err).to.equal(err);
    });
});
