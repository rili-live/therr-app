import { BrandVariations } from '../../constants';
import accountability from './accountability';
import activist from './activist';
import cleanBreak from './cleanBreak';
import communityLeader from './communityLeader';
import consistency from './consistency';
import critic from './critic';
import entrepreneur from './entrepreneur';
import eventPlanner from './eventPlanner';
import explorer from './explorer';
import habitBuilder from './habitBuilder';
import humanitarian from './humanitarian';
import influencer from './influencer';
import journalist from './journalist';
import localPatron from './localPatron';
import localScout from './localScout';
import pactPioneer from './pactPioneer';
import resilience from './resilience';
import socialEnergizer from './socialEnergizer';
import socialite from './socialite';
import thinker from './thinker';
import tourGuide from './tourGuide';
import treasureBuilder from './treasureBuilder';

export interface IAchievement {
    title: string;
    description: string;
    bonusAbilityId: string;
    prerequisite: (userAchievements: { [key: string]: any }) => boolean;
    countToComplete: number;
    xp: number;
    pointReward: number;
    mediaId?: string;
    tier: string;
    version: number;
}

const achievements: { [key: string]: IAchievement } = {
    ...accountability,
    ...activist,
    ...cleanBreak,
    ...communityLeader,
    ...consistency,
    ...critic,
    ...entrepreneur,
    ...eventPlanner,
    ...explorer,
    ...habitBuilder,
    ...humanitarian,
    ...influencer,
    ...journalist,
    ...localPatron,
    ...localScout,
    ...pactPioneer,
    ...resilience,
    ...socialEnergizer,
    ...socialite,
    ...thinker,
    ...tourGuide,
    ...treasureBuilder,
};

export const achievementsByClass: { [key: string]: { [key: string]: IAchievement } } = {
    accountability,
    activist,
    cleanBreak,
    communityLeader,
    consistency,
    critic,
    entrepreneur,
    eventPlanner,
    explorer,
    habitBuilder,
    humanitarian,
    influencer,
    journalist,
    localPatron,
    localScout,
    pactPioneer,
    resilience,
    socialEnergizer,
    socialite,
    thinker,
    tourGuide,
    treasureBuilder,
};

const therrClassNames = [
    'activist',
    'communityLeader',
    'critic',
    'entrepreneur',
    'eventPlanner',
    'explorer',
    'humanitarian',
    'influencer',
    'journalist',
    'localPatron',
    'localScout',
    'socialite',
    'thinker',
    'tourGuide',
];

const habitsClassNames = [
    'accountability',
    'cleanBreak',
    'consistency',
    'habitBuilder',
    'pactPioneer',
    'resilience',
    'socialEnergizer',
    'socialite',
    'treasureBuilder',
];

const pickClasses = (names: string[]) => names.reduce((acc, name) => {
    if (achievementsByClass[name]) {
        acc[name] = achievementsByClass[name];
    }
    return acc;
}, {} as { [key: string]: { [key: string]: IAchievement } });

export const getAchievementsForBrand = (
    brandVariation?: BrandVariations | string,
): { [key: string]: { [key: string]: IAchievement } } => {
    if (brandVariation === BrandVariations.HABITS) {
        return pickClasses(habitsClassNames);
    }
    return pickClasses(therrClassNames);
};

// Maps an achievement class to the brands that may earn it. The Therr classes are
// location/social/content-themed; HABITS has its own 8 streak/pact-themed classes plus
// the reused `socialite` for invite virality. Without this gate, registration seeds and
// connection/thought activity would create Therr achievements stamped with the niche
// brand, which then surface in the niche app's achievements list even though brand-scoped
// SQL filters are working as intended.
export const achievementClassesByBrand: { [brand: string]: ReadonlySet<string> } = {
    [BrandVariations.THERR]: new Set(therrClassNames),
    [BrandVariations.DASHBOARD_THERR]: new Set(therrClassNames),
    [BrandVariations.HABITS]: new Set(habitsClassNames),
};

export const isAchievementClassEnabledForBrand = (
    achievementClass: string,
    brand: BrandVariations | string | undefined | null,
): boolean => {
    if (!brand) return false;
    const allowed = achievementClassesByBrand[brand];
    return !!allowed && allowed.has(achievementClass);
};

export default achievements;
