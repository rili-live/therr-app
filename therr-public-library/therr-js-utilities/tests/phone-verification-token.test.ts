import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import {
    createPhoneVerificationToken,
    verifyPhoneVerificationToken,
    PHONE_VERIFICATION_TOKEN_AUDIENCE,
    PHONE_VERIFICATION_TOKEN_ISSUER,
    PHONE_VERIFICATION_TOKEN_TYPE,
} from '../src/phone-verification-token';

const SECRET = 'test-jwt-secret';
const PHONE = '+13175551234';

describe('phone-verification-token', () => {
    it('round-trips a minted token back to its claims', () => {
        const token = createPhoneVerificationToken(PHONE, 'register', SECRET);
        const claims = verifyPhoneVerificationToken(token, 'register', SECRET);

        expect(claims?.phoneNumber).to.equal(PHONE);
        expect(claims?.purpose).to.equal('register');
        expect(claims?.type).to.equal(PHONE_VERIFICATION_TOKEN_TYPE);
    });

    it('rejects a token minted for a different purpose', () => {
        // A sign-in proof must not be redeemable as a sign-up proof, or a user could turn
        // "log me in" into "create me an account on this number".
        const token = createPhoneVerificationToken(PHONE, 'login', SECRET);

        expect(verifyPhoneVerificationToken(token, 'register', SECRET)).to.equal(undefined);
    });

    it('rejects a token signed with a different secret', () => {
        const token = createPhoneVerificationToken(PHONE, 'register', 'some-other-secret');

        expect(verifyPhoneVerificationToken(token, 'register', SECRET)).to.equal(undefined);
    });

    it('rejects an expired token', () => {
        const token = jwt.sign(
            { phoneNumber: PHONE, purpose: 'register', type: PHONE_VERIFICATION_TOKEN_TYPE },
            SECRET,
            {
                expiresIn: -10,
                issuer: PHONE_VERIFICATION_TOKEN_ISSUER,
                audience: PHONE_VERIFICATION_TOKEN_AUDIENCE,
            },
        );

        expect(verifyPhoneVerificationToken(token, 'register', SECRET)).to.equal(undefined);
    });

    it('rejects a session-shaped token that is not a phone-verification token', () => {
        // Guards the boundary the audience/type claims exist to enforce: an id token must
        // never be usable as proof of phone ownership.
        const sessionToken = jwt.sign(
            { id: 'some-user-id', phoneNumber: PHONE, purpose: 'register' },
            SECRET,
            { issuer: PHONE_VERIFICATION_TOKEN_ISSUER, audience: 'therr-app' },
        );

        expect(verifyPhoneVerificationToken(sessionToken, 'register', SECRET)).to.equal(undefined);
    });

    it('treats a missing token as no proof supplied rather than throwing', () => {
        expect(verifyPhoneVerificationToken(undefined, 'register', SECRET)).to.equal(undefined);
        expect(verifyPhoneVerificationToken('', 'register', SECRET)).to.equal(undefined);
        expect(verifyPhoneVerificationToken('not-a-jwt', 'register', SECRET)).to.equal(undefined);
    });
});
