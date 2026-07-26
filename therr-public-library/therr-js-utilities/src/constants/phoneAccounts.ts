import { BrandVariations } from './enums/Branding';

/**
 * The three mutually-exclusive shapes a user row can take, derived from the
 * `isBusinessAccount` / `isCreatorAccount` booleans on `main.users`.
 */
export type PhoneAccountType = 'personal' | 'creator' | 'business';

export const PHONE_ACCOUNT_TYPES: PhoneAccountType[] = ['personal', 'creator', 'business'];

/**
 * How many accounts one phone number may hold, keyed by brand.
 *
 * Therr (and any variant without an entry here) allows one account per type — a person, the
 * creator persona they publish under, and the business they run are three different identities
 * that legitimately share a handset. Habits is deliberately capped at one: its whole premise is
 * accountability between real people, and a second account on the same number is a way to fake
 * a pact partner, not a real use case.
 */
export const MAX_ACCOUNTS_PER_PHONE_BY_BRAND: { [brand: string]: number } = {
    [BrandVariations.HABITS]: 1,
};

export const DEFAULT_MAX_ACCOUNTS_PER_PHONE = PHONE_ACCOUNT_TYPES.length;

export const getMaxAccountsPerPhone = (brandVariation?: string): number => {
    const configured = brandVariation && MAX_ACCOUNTS_PER_PHONE_BY_BRAND[brandVariation];

    return configured || DEFAULT_MAX_ACCOUNTS_PER_PHONE;
};

/**
 * Business wins over creator when both flags are set — matching how the rest of the codebase
 * branches on `isBusinessAccount` first (see `HeaderMenuRight`, `EditSpace`).
 */
export const getPhoneAccountType = (account: {
    isBusinessAccount?: boolean;
    isCreatorAccount?: boolean;
}): PhoneAccountType => {
    if (account?.isBusinessAccount) {
        return 'business';
    }
    if (account?.isCreatorAccount) {
        return 'creator';
    }

    return 'personal';
};

/**
 * Which account types a phone number may still register, given the accounts it already holds.
 *
 * Returns an empty list once the brand's cap is reached, so callers can treat "no types left"
 * and "at the cap" as the same rejection. Below the cap, every type the number does not
 * already have is fair game — the first account on a number can be any of the three, which is
 * why a brand capped at 1 still offers all three to a brand-new number.
 */
export const getAvailablePhoneAccountTypes = (
    existingAccounts: { isBusinessAccount?: boolean; isCreatorAccount?: boolean }[],
    brandVariation?: string,
): PhoneAccountType[] => {
    const accounts = existingAccounts || [];

    if (accounts.length >= getMaxAccountsPerPhone(brandVariation)) {
        return [];
    }

    const takenTypes = accounts.map(getPhoneAccountType);

    return PHONE_ACCOUNT_TYPES.filter((type) => !takenTypes.includes(type));
};
