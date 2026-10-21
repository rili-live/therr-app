import { expect } from 'chai';
import {
    DEFAULT_SMS_ALLOWED_REGIONS,
    DEFAULT_SMS_EXTENDED_REGIONS,
    DEFAULT_SMS_UNATTESTED_REGIONS,
    getSmsAllowedRegions,
    getSmsDestinationTier,
    getSmsExtendedRegions,
    getSmsUnattestedRegions,
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
            expect(isSmsDestinationAllowed('+919812345678', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(true); // India ($0.083)
            expect(isSmsDestinationAllowed('+5511912345678', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Brazil — not listed
            expect(isSmsDestinationAllowed('+923001234567', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Pakistan
        });

        it('refuses the regions over ~$0.10 a text that the 2026-10-21 pumping run moved to', () => {
            expect(isSmsDestinationAllowed('+59171234567', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Bolivia ($0.22)
            expect(isSmsDestinationAllowed('+593991234567', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Ecuador ($0.34)
            expect(isSmsDestinationAllowed('+375291234567', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Belarus ($0.25)
            expect(isSmsDestinationAllowed('+201001234567', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Egypt ($0.40)
            expect(isSmsDestinationAllowed('+38640123456', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Slovenia ($0.21)
            expect(isSmsDestinationAllowed('+525512345678', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Mexico ($0.18)
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

    describe('getSmsDestinationTier', () => {
        it('puts our core markets in the core tier', () => {
            expect(getSmsDestinationTier('+13175551234')).to.equal('core'); // US
            expect(getSmsDestinationTier('+33612345678')).to.equal('core'); // France
            expect(getSmsDestinationTier('+491711234567')).to.equal('core'); // Germany
            expect(getSmsDestinationTier('+61412345678')).to.equal('core'); // Australia
        });

        it('has no extended tier by default', () => {
            expect(DEFAULT_SMS_EXTENDED_REGIONS).to.deep.equal([]);
            expect(getSmsDestinationTier('+254712345678')).to.equal(undefined); // Kenya
            expect(getSmsDestinationTier('+221701234567')).to.equal(undefined); // Senegal
            expect(getSmsDestinationTier('+917012345678')).to.equal('core'); // India
        });

        it('refuses Twilio high-risk countries and island pumping destinations outright', () => {
            expect(getSmsDestinationTier('+923001234567')).to.equal(undefined); // Pakistan
            expect(getSmsDestinationTier('+2348031234567')).to.equal(undefined); // Nigeria
            expect(getSmsDestinationTier('+18765551234')).to.equal(undefined); // Jamaica
            expect(getSmsDestinationTier('+447911123456')).to.equal(undefined); // Guernsey
        });

        it('lets core win when an override lists a region in both tiers', () => {
            expect(getSmsDestinationTier('+254712345678', ['KE'], ['KE'])).to.equal('core');
        });

        it('honours an extended-tier override', () => {
            expect(getSmsExtendedRegions(' ke ')).to.deep.equal(['KE']);
            expect(getSmsExtendedRegions(undefined)).to.deep.equal(DEFAULT_SMS_EXTENDED_REGIONS);
            expect(getSmsDestinationTier('+221701234567', DEFAULT_SMS_ALLOWED_REGIONS, ['KE'])).to.equal(undefined);
        });

        it('keeps the tiers disjoint by default', () => {
            expect(DEFAULT_SMS_EXTENDED_REGIONS.filter((r) => DEFAULT_SMS_ALLOWED_REGIONS.includes(r))).to.deep.equal([]);
        });

        it('isSmsDestinationAllowed admits the core tier only', () => {
            expect(isSmsDestinationAllowed('+33612345678')).to.equal(true); // France — core
            expect(isSmsDestinationAllowed('+254712345678', DEFAULT_SMS_ALLOWED_REGIONS)).to.equal(false); // Kenya
            expect(getSmsDestinationTier('+254712345678', DEFAULT_SMS_ALLOWED_REGIONS, ['KE'])).to.equal('extended');
        });
    });

    describe('getSmsUnattestedRegions', () => {
        it('defaults to the US and Canada only', () => {
            expect(getSmsUnattestedRegions(undefined)).to.deep.equal(['US', 'CA']);
            expect(getSmsUnattestedRegions(' ')).to.deep.equal(DEFAULT_SMS_UNATTESTED_REGIONS);
            expect(getSmsUnattestedRegions('us, gb')).to.deep.equal(['US', 'GB']);
        });

        it('is a subset of the core tier, so the strict lane never widens what may be texted', () => {
            expect(DEFAULT_SMS_UNATTESTED_REGIONS.filter((r) => !DEFAULT_SMS_ALLOWED_REGIONS.includes(r))).to.deep.equal([]);
        });
    });
});
