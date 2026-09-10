import { expect } from 'chai';
import { BrandVariations } from '../src/constants/enums/Branding';
import {
    DEFAULT_MAX_ACCOUNTS_PER_PHONE,
    getAvailablePhoneAccountTypes,
    getMaxAccountsPerPhone,
    getPhoneAccountType,
} from '../src/constants/phoneAccounts';

const personal = {};
const creator = { isCreatorAccount: true };
const business = { isBusinessAccount: true };

describe('getMaxAccountsPerPhone', () => {
    it('allows one account per type on Therr', () => {
        expect(getMaxAccountsPerPhone(BrandVariations.THERR)).to.equal(3);
    });

    it('allows exactly one account on Habits', () => {
        expect(getMaxAccountsPerPhone(BrandVariations.HABITS)).to.equal(1);
    });

    it('falls back to the default for an unconfigured or missing brand', () => {
        expect(getMaxAccountsPerPhone('some-future-brand')).to.equal(DEFAULT_MAX_ACCOUNTS_PER_PHONE);
        expect(getMaxAccountsPerPhone()).to.equal(DEFAULT_MAX_ACCOUNTS_PER_PHONE);
        expect(getMaxAccountsPerPhone('')).to.equal(DEFAULT_MAX_ACCOUNTS_PER_PHONE);
    });
});

describe('getPhoneAccountType', () => {
    it('reads the type off the account flags', () => {
        expect(getPhoneAccountType(personal)).to.equal('personal');
        expect(getPhoneAccountType(creator)).to.equal('creator');
        expect(getPhoneAccountType(business)).to.equal('business');
    });

    it('resolves a row carrying both flags as business', () => {
        expect(getPhoneAccountType({ isBusinessAccount: true, isCreatorAccount: true })).to.equal('business');
    });
});

describe('getAvailablePhoneAccountTypes', () => {
    it('offers every type to a number with no accounts', () => {
        expect(getAvailablePhoneAccountTypes([], BrandVariations.THERR))
            .to.deep.equal(['personal', 'creator', 'business']);
    });

    it('offers every type to a brand-new number even on a brand capped at one', () => {
        expect(getAvailablePhoneAccountTypes([], BrandVariations.HABITS))
            .to.deep.equal(['personal', 'creator', 'business']);
    });

    it('excludes types the number already holds', () => {
        expect(getAvailablePhoneAccountTypes([personal], BrandVariations.THERR))
            .to.deep.equal(['creator', 'business']);
        expect(getAvailablePhoneAccountTypes([personal, business], BrandVariations.THERR))
            .to.deep.equal(['creator']);
    });

    it('returns nothing once the number holds one of each type', () => {
        expect(getAvailablePhoneAccountTypes([personal, creator, business], BrandVariations.THERR))
            .to.deep.equal([]);
    });

    it('returns nothing for a Habits number that already has one account', () => {
        expect(getAvailablePhoneAccountTypes([personal], BrandVariations.HABITS)).to.deep.equal([]);
        expect(getAvailablePhoneAccountTypes([business], BrandVariations.HABITS)).to.deep.equal([]);
    });

    it('treats a null account list as empty', () => {
        expect(getAvailablePhoneAccountTypes(null as any, BrandVariations.THERR))
            .to.deep.equal(['personal', 'creator', 'business']);
    });
});
