import { expect } from 'chai';
import AccessLevels from '../src/constants/enums/AccessLevels';
import isTestAccount from '../src/http/is-test-account';

describe('isTestAccount', () => {
    it('reads the forwarded x-user-access-levels header', () => {
        expect(isTestAccount({
            'x-user-access-levels': JSON.stringify([AccessLevels.DEFAULT, AccessLevels.TEST_ACCOUNT]),
        })).to.equal(true);
        expect(isTestAccount({
            'x-user-access-levels': JSON.stringify([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]),
        })).to.equal(false);
    });

    it('reads an access-levels array from a users row', () => {
        expect(isTestAccount([AccessLevels.TEST_ACCOUNT])).to.equal(true);
        expect(isTestAccount([AccessLevels.SUPER_ADMIN])).to.equal(false);
    });

    it('fails toward a normal account on missing or malformed input', () => {
        expect(isTestAccount(undefined)).to.equal(false);
        expect(isTestAccount(null)).to.equal(false);
        expect(isTestAccount({})).to.equal(false);
        expect(isTestAccount({ 'x-user-access-levels': '' })).to.equal(false);
        expect(isTestAccount({ 'x-user-access-levels': 'not json' })).to.equal(false);
        expect(isTestAccount({ 'x-user-access-levels': '{"a":1}' })).to.equal(false);
    });
});
