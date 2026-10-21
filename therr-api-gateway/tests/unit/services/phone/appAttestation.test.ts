/**
 * Unit tests for sorting verification-code requests by App Check attestation.
 *
 * The lane decides who may be texted, so both directions of a regression are silent: classing a
 * forged token as unattested only lets a script back into the strict lane, but classing a Firebase
 * outage as forged would shadow-ban every real user without a single error anywhere.
 */
import { expect } from 'chai';
import * as admin from 'firebase-admin';
import {
    getAppAttestation,
    getSmsAppCheckMode,
    IAppCheckVerifier,
    isUnverifiableAppCheckError,
} from '../../../../src/services/phone/appAttestation';

const appCheckError = (code: string, message: string) => Object.assign(new Error(message), { code });

const verifierThatThrows = (err: any): IAppCheckVerifier => ({
    verifyToken: () => Promise.reject(err),
});

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('appAttestation', () => {
    describe('getSmsAppCheckMode', () => {
        it('defaults to the strict lane for anything it does not recognise', () => {
            expect(getSmsAppCheckMode(undefined)).to.equal('strict-lane');
            expect(getSmsAppCheckMode('')).to.equal('strict-lane');
            expect(getSmsAppCheckMode('enforced')).to.equal('strict-lane');
        });

        it('honours enforce and off, tolerating case and whitespace', () => {
            expect(getSmsAppCheckMode(' Enforce ')).to.equal('enforce');
            expect(getSmsAppCheckMode('OFF')).to.equal('off');
        });
    });

    describe('getAppAttestation', () => {
        it('puts a request with no token in the strict lane without calling the verifier', async () => {
            const verifier: IAppCheckVerifier = { verifyToken: () => { throw new Error('should not be called'); } };

            expect((await getAppAttestation(undefined, verifier)).attestation).to.equal('unattested');
            expect((await getAppAttestation('   ', verifier)).attestation).to.equal('unattested');
            expect((await getAppAttestation(42, verifier)).attestation).to.equal('unattested');
        });

        it('attests a token that verifies, and reports the app it was minted for', async () => {
            const verifier: IAppCheckVerifier = { verifyToken: (token) => Promise.resolve({ appId: `app-for-${token}` }) };

            expect(await getAppAttestation(' tok ', verifier)).to.deep.equal({ attestation: 'attested', appId: 'app-for-tok' });
        });

        it('uses the first value when the header was sent twice', async () => {
            const verifier: IAppCheckVerifier = { verifyToken: (token) => Promise.resolve({ appId: token }) };

            expect((await getAppAttestation(['first', 'second'], verifier)).appId).to.equal('first');
        });

        it('treats a token that fails the check as forged', async () => {
            const result = await getAppAttestation('tok', verifierThatThrows(
                appCheckError('app-check/invalid-argument', 'The provided App Check token has invalid signature.'),
            ));

            expect(result.attestation).to.equal('forged');
        });

        it('never treats an unreachable key endpoint as forged', async () => {
            // firebase-admin reports a JWKS fetch failure with the same code as a bad signature.
            const result = await getAppAttestation('tok', verifierThatThrows(
                appCheckError('app-check/invalid-argument', 'Error fetching Json Web Keys: getaddrinfo ENOTFOUND firebaseappcheck.googleapis.com'),
            ));

            expect(result.attestation).to.equal('unattested');
        });

        it('never shadow-bans a token signed with a key missing from the cached key set', async () => {
            // firebase-admin caches the JWKS for 6h without refetching on a miss, so a rotated key looks like this.
            const result = await getAppAttestation('tok', verifierThatThrows(appCheckError(
                'app-check/invalid-argument',
                'The provided App Check token has "kid" claim which does not correspond to a known public key. '
                    + 'Most likely the provided App Check token is expired, so get a fresh token from your client app and try again.',
            )));

            expect(result.attestation).to.equal('unattested');
        });

        it('puts an expired token, or a misconfigured verifier, in the strict lane rather than banning it', async () => {
            expect((await getAppAttestation('tok', verifierThatThrows(
                appCheckError('app-check/app-check-token-expired', 'The provided App Check token has expired.'),
            ))).attestation).to.equal('unattested');
            expect((await getAppAttestation('tok', verifierThatThrows(
                appCheckError('app-check/invalid-credential', 'Must initialize app with a cert credential or set your Firebase project ID'),
            ))).attestation).to.equal('unattested');
        });
    });

    describe('against the real firebase-admin verifier', () => {
        // Both cases fail before the SDK fetches any keys, so they run offline.
        let app: admin.app.App;

        before(() => {
            app = admin.initializeApp({ projectId: 'therr-app' }, 'app-attestation-test');
        });

        after(() => app.delete());

        it('classes a token that is not a JWT as forged', async () => {
            expect((await getAppAttestation('not-a-jwt', admin.appCheck(app))).attestation).to.equal('forged');
        });

        it('classes a token minted for another Firebase project as forged', async () => {
            const token = [
                base64Url({ alg: 'RS256', typ: 'JWT', kid: 'k' }),
                base64Url({
                    aud: ['projects/123', 'projects/someone-elses-app'],
                    iss: 'https://firebaseappcheck.googleapis.com/123',
                    sub: '1:123:android:abc',
                    exp: Math.floor(Date.now() / 1000) + 3600,
                }),
                'c2lnbmF0dXJl',
            ].join('.');

            expect((await getAppAttestation(token, admin.appCheck(app))).attestation).to.equal('forged');
        });
    });

    describe('isUnverifiableAppCheckError', () => {
        it('does not mistake a forged-token message for an outage', () => {
            expect(isUnverifiableAppCheckError(appCheckError('app-check/invalid-argument', 'Decoding App Check token failed.'))).to.equal(false);
            expect(isUnverifiableAppCheckError(undefined)).to.equal(false);
        });
    });
});
