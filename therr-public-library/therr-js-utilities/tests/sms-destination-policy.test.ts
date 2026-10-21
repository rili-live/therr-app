import { expect } from 'chai';
import {
    DEFAULT_SMS_ALLOWED_REGIONS,
    getSmsAllowedRegions,
    isSmsDestinationAllowed,
} from '../src/sms-destination-policy';

describe('sms-destination-policy', () => {
    describe('getSmsAllowedRegions', () => {
        it('falls back to the default regions when unset or blank', () => {
            expect(getSmsAllowedRegions(undefined)).to.deep.equal(DEFAULT_SMS_ALLOWED_REGIONS);
            expect(getSmsAllowedRegions(' , ')).to.deep.equal(DEFAULT_SMS_ALLOWED_REGIONS);
        });

        it('parses a comma-separated override, tolerating case and whitespace', () => {
            expect(getSmsAllowedRegions(' us, gb ')).to.deep.equal(['US', 'GB']);
        });
    });

    describe('isSmsDestinationAllowed', () => {
        const regions = ['US', 'CA', 'GB'];

        it('allows numbers in an allowed region, in E.164 or the stored display dialect', () => {
            expect(isSmsDestinationAllowed('+13175551234', regions)).to.equal(true);
            expect(isSmsDestinationAllowed('+1 317-555-1234', regions)).to.equal(true);
            expect(isSmsDestinationAllowed('+14169671111', regions)).to.equal(true); // Toronto
            expect(isSmsDestinationAllowed('+447400123456', regions)).to.equal(true);
        });

        it('refuses Caribbean NANP numbers that share the +1 prefix', () => {
            // The whole reason this gates on region rather than `startsWith('+1')`.
            expect(isSmsDestinationAllowed('+18765551234', regions)).to.equal(false); // Jamaica
            expect(isSmsDestinationAllowed('+18095551234', regions)).to.equal(false); // Dominican Republic
        });

        it('refuses crown-dependency numbers that share the +44 prefix', () => {
            expect(isSmsDestinationAllowed('+447911123456', regions)).to.equal(false); // Guernsey
        });

        it('refuses numbers outside the allowed regions', () => {
            expect(isSmsDestinationAllowed('+33612345678', regions)).to.equal(false); // France
            expect(isSmsDestinationAllowed('+33612345678', ['FR'])).to.equal(true);
            expect(isSmsDestinationAllowed('+525512345678', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(true); // Mexico City
            expect(isSmsDestinationAllowed('+5491123456789', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(true); // Buenos Aires mobile
            expect(isSmsDestinationAllowed('+573001234567', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(true); // Colombia mobile
            expect(isSmsDestinationAllowed('+5511912345678', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Brazil — Portuguese-speaking, not listed
            expect(isSmsDestinationAllowed('+923001234567', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Pakistan
        });

        it('refuses premium-rate and toll-free numbers even inside an allowed region', () => {
            expect(isSmsDestinationAllowed('+19005551234', regions)).to.equal(false); // US 900
            expect(isSmsDestinationAllowed('+18005551234', regions)).to.equal(false); // US 800
        });

        it('fails closed on anything without a country code or that does not parse', () => {
            expect(isSmsDestinationAllowed('3175551234', regions)).to.equal(false);
            expect(isSmsDestinationAllowed('', regions)).to.equal(false);
            expect(isSmsDestinationAllowed(undefined as any, regions)).to.equal(false);
            expect(isSmsDestinationAllowed('+1555', regions)).to.equal(false);
        });
    });
});
