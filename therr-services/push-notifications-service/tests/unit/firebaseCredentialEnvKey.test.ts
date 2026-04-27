/**
 * Phase 6 verification scenario 3 (mapping half).
 *
 * The mapping from BrandVariations → Firebase credential env var is what guarantees
 * each brand initializes the matching Firebase Admin app. If this mapping ever
 * regresses (e.g. someone refactors the env-var name), every Habits push would
 * silently route through the Therr Firebase project. This test pins the contract.
 *
 * The function is extracted from firebaseAdmin.ts on purpose — that module validates
 * THERR credentials at load time and is therefore not import-safe in unit tests
 * without an env stub.
 */
import { expect } from 'chai';
import { BrandVariations } from 'therr-js-utilities/constants';
import { getCredentialEnvKey } from '../../src/api/firebaseCredentialEnvKey';

describe('firebaseCredentialEnvKey', () => {
    it('returns the historical unsuffixed env var for THERR', () => {
        expect(getCredentialEnvKey(BrandVariations.THERR)).to.equal(
            'PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64',
        );
    });

    it('returns the brand-suffixed env var for HABITS', () => {
        expect(getCredentialEnvKey(BrandVariations.HABITS)).to.equal(
            'PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS',
        );
    });

    it('returns the brand-suffixed env var for TEEM', () => {
        expect(getCredentialEnvKey(BrandVariations.TEEM)).to.equal(
            'PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_TEEM',
        );
    });

    it('uppercases arbitrary new brand values consistently', () => {
        // Future brands appended to the enum should follow the same convention.
        expect(getCredentialEnvKey(BrandVariations.OTAKU)).to.equal(
            'PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_OTAKU',
        );
    });

    it('produces distinct env keys for distinct brands', () => {
        const keys = [
            BrandVariations.THERR,
            BrandVariations.HABITS,
            BrandVariations.TEEM,
            BrandVariations.OTAKU,
        ].map(getCredentialEnvKey);
        const unique = new Set(keys);
        expect(unique.size).to.equal(keys.length);
    });
});
