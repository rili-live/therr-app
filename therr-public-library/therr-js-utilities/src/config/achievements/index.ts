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

// Every class currently shipped is Therr-themed (location/social/content). Niche brands
// like HABITS will land their own streak/pact-themed classes per HABITS_PROJECT_BRIEF.md;
// until those exist, niche brands earn nothing — registration seeds and activity-driven
// creates skip on a niche brand because no class is allow-listed for it.
const therrClassNames = [
    'accountability',
    'activist',
    'cleanBreak',
    'communityLeader',
    'consistency',
    'critic',
    'entrepreneur',
    'eventPlanner',
    'explorer',
    'habitBuilder',
    'humanitarian',
    'influencer',
    'journalist',
    'localPatron',
    'localScout',
    'pactPioneer',
    'resilience',
    'socialEnergizer',
    'socialite',
    'thinker',
    'tourGuide',
    'treasureBuilder',
];

// Maps an achievement class to the brands that may earn it. Without this gate,
// registration seeds and connection/thought activity would create Therr achievements
// stamped with a niche brand, which then surface in the niche app's achievements list
// even though brand-scoped SQL filters are working as intended.
export const achievementClassesByBrand: { [brand: string]: ReadonlySet<string> } = {
    [BrandVariations.THERR]: new Set(therrClassNames),
    [BrandVariations.DASHBOARD_THERR]: new Set(therrClassNames),
};

export const getAchievementsForBrand = (
    brandVariation?: BrandVariations | string,
): { [key: string]: { [key: string]: IAchievement } } => {
    const allowed = brandVariation ? achievementClassesByBrand[brandVariation] : undefined;
    if (!allowed) return {};
    const result: { [key: string]: { [key: string]: IAchievement } } = {};
    allowed.forEach((name) => {
        if (achievementsByClass[name]) {
            result[name] = achievementsByClass[name];
        }
    });
    return result;
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
