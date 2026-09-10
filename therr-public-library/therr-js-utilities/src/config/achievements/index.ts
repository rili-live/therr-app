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
import weeklyChampion from './weeklyChampion';

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
    ...weeklyChampion,
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
    weeklyChampion,
};

// Therr-themed classes (location/social/content) — locked to the Therr apps so
// registration seeds and connection/thought activity never surface Therr-shaped
// achievements inside a niche app.
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
    'weeklyChampion',
];

// HABITS ladder (2026-07, leaderboards release): the streak/pact-themed classes plus
// `socialite` (invite virality) are now allow-listed for Friends with Habits, ending the
// interim "HABITS earns nothing" policy from a55bce90d. The awarding side has been wired
// since the streaks release (users-service handlers/helpers/awardHabitAchievements.ts);
// this list is what lets those calls write rows instead of silently no-oping.
// `weeklyChampion` is brand-agnostic — every brand with a leaderboard earns it.
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
    'weeklyChampion',
];

// Maps an achievement class to the brands that may earn it. Without this gate,
// registration seeds and connection/thought activity would create Therr achievements
// stamped with a niche brand, which then surface in the niche app's achievements list
// even though brand-scoped SQL filters are working as intended.
export const achievementClassesByBrand: { [brand: string]: ReadonlySet<string> } = {
    [BrandVariations.THERR]: new Set(therrClassNames),
    [BrandVariations.DASHBOARD_THERR]: new Set(therrClassNames),
    [BrandVariations.HABITS]: new Set(habitsClassNames),
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
