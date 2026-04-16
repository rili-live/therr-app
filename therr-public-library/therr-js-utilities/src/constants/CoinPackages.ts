export type CoinPackageId = 'small' | 'medium' | 'large' | 'xlarge';

export interface ICoinPackage {
    id: CoinPackageId;
    usdCents: number;
    coins: number;
    bonusCoins: number;
}

export const COIN_PACKAGES: ICoinPackage[] = [
    {
        id: 'small', usdCents: 1000, coins: 1000, bonusCoins: 0,
    },
    {
        id: 'medium', usdCents: 2000, coins: 2000, bonusCoins: 100,
    },
    {
        id: 'large', usdCents: 5000, coins: 5000, bonusCoins: 500,
    },
    {
        id: 'xlarge', usdCents: 10000, coins: 10000, bonusCoins: 2000,
    },
];

export const COIN_PACKAGE_IDS: CoinPackageId[] = COIN_PACKAGES.map((pkg) => pkg.id);

export const getCoinPackageById = (id?: string): ICoinPackage | undefined => COIN_PACKAGES.find((pkg) => pkg.id === id);
