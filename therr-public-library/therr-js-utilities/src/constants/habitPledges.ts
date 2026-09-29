/**
 * Charity pledges on a pact habit (WORK_IN_PROGRESS § 2.8, Phase A).
 *
 * "If I miss my week, $5 goes to charity." Phase A moves no money: on a missed week the app
 * reminds the member of their pledge and links out to the charity's own donation page, and the
 * member gives there (or does not). The app never holds, routes or receives the money.
 *
 * Isomorphic because three places must agree on what a valid pledge is: users-service validates
 * `PUT /habits/pacts/:id/pledge` against it, push-notifications-service names the charity in the
 * miss push from it, and the mobile pledge picker renders the same list.
 */

/**
 * The curated recipients. A fixed list, not free text, so the app never appears to endorse an
 * arbitrary organisation and the choice stays one tap. The key is what is stored — renaming a
 * charity's display name is safe, renaming a key orphans every pledge that names it.
 */
export enum PledgeCharityKeys {
    GIVE_DIRECTLY = 'give_directly',
    DOCTORS_WITHOUT_BORDERS = 'doctors_without_borders',
    FEEDING_AMERICA = 'feeding_america',
    GLOBAL_FOODBANKING_NETWORK = 'global_foodbanking_network',
    UNICEF_USA = 'unicef_usa',
    DIRECT_RELIEF = 'direct_relief',
    WWF = 'wwf',
}

export type PledgeCharityKey = `${PledgeCharityKeys}`;

export interface IPledgeCharity {
    key: PledgeCharityKey;
    /** The organisation's own name. A proper noun, so push copy uses it in every locale. */
    name: string;
    /** The charity's own donation page. The miss card links out here; we never take the payment. */
    donateUrl: string;
}

/** In display order for the pledge picker. */
export const PLEDGE_CHARITIES: IPledgeCharity[] = [
    { key: PledgeCharityKeys.GIVE_DIRECTLY, name: 'GiveDirectly', donateUrl: 'https://www.givedirectly.org/donate/' },
    {
        key: PledgeCharityKeys.DOCTORS_WITHOUT_BORDERS,
        name: 'Doctors Without Borders',
        donateUrl: 'https://www.doctorswithoutborders.org/donate',
    },
    { key: PledgeCharityKeys.FEEDING_AMERICA, name: 'Feeding America', donateUrl: 'https://www.feedingamerica.org/give' },
    {
        key: PledgeCharityKeys.GLOBAL_FOODBANKING_NETWORK,
        name: 'The Global FoodBanking Network',
        donateUrl: 'https://www.foodbanking.org/donate/',
    },
    { key: PledgeCharityKeys.UNICEF_USA, name: 'UNICEF USA', donateUrl: 'https://www.unicefusa.org/donate' },
    { key: PledgeCharityKeys.DIRECT_RELIEF, name: 'Direct Relief', donateUrl: 'https://www.directrelief.org/donate/' },
    { key: PledgeCharityKeys.WWF, name: 'World Wildlife Fund', donateUrl: 'https://www.worldwildlife.org/donate' },
];

export const isPledgeCharityKey = (value: unknown): value is PledgeCharityKey => (
    typeof value === 'string' && PLEDGE_CHARITIES.some((charity) => charity.key === value)
);

export const getPledgeCharity = (key: unknown): IPledgeCharity | undefined => PLEDGE_CHARITIES
    .find((charity) => charity.key === key);

/**
 * Whole US dollars. Every curated recipient is a US organisation, so Phase A pledges in USD and
 * carries no currency code. A pledge is a promise to oneself, not a charge, so the ceiling only
 * stops a typo from reading as a promise nobody meant.
 */
export const MIN_PLEDGE_AMOUNT = 1;
export const MAX_PLEDGE_AMOUNT = 500;

/** What `habits.pact_members."pledge"` holds. NULL on the row means no pledge. */
export interface IHabitPledge {
    amount: number;
    charityKey: PledgeCharityKey;
    /**
     * When the pledge was last set, ISO 8601. A week is only judged if the pledge was in force
     * before it started — a pledge made on Wednesday first applies to the following Monday, so
     * nobody is held to a promise for days that had already passed when they made it.
     */
    pledgedAt: string;
}

export type PledgeInputError = 'invalidAmount' | 'invalidCharity';

/** Validate a client-supplied pledge. Returns the error, or null when it is valid. */
export const getPledgeInputError = (input: { amount?: unknown; charityKey?: unknown }): PledgeInputError | null => {
    const amount = Number(input.amount);
    if (!Number.isInteger(amount) || amount < MIN_PLEDGE_AMOUNT || amount > MAX_PLEDGE_AMOUNT) {
        return 'invalidAmount';
    }
    if (!isPledgeCharityKey(input.charityKey)) {
        return 'invalidCharity';
    }
    return null;
};
