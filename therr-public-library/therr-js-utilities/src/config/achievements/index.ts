import { BrandVariations } from '../../constants/enums/Branding';
import activist from './activist';
import communityLeader from './communityLeader';
import critic from './critic';
import entrepreneur from './entrepreneur';
import eventPlanner from './eventPlanner';
import explorer from './explorer';
import humanitarian from './humanitarian';
import influencer from './influencer';
import journalist from './journalist';
import localPatron from './localPatron';
import localScout from './localScout';
import socialite from './socialite';
import thinker from './thinker';
import tourGuide from './tourGuide';

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
    ...activist,
    ...communityLeader,
    ...critic,
    ...entrepreneur,
    ...eventPlanner,
    ...explorer,
    ...humanitarian,
    ...influencer,
    ...journalist,
    ...localPatron,
    ...localScout,
    ...socialite,
    ...thinker,
    ...tourGuide,
};

export const achievementsByClass: { [key: string]: { [key: string]: IAchievement } } = {
    activist,
    communityLeader,
    critic,
    entrepreneur,
    eventPlanner,
    explorer,
    humanitarian,
    influencer,
    journalist,
    localPatron,
    localScout,
    socialite,
    thinker,
    tourGuide,
};

// Maps an achievement class to the brands that may earn it. Every existing class
// is Therr-themed (location/social/content), so non-Therr brands are excluded
// until they ship their own classes (e.g., streak-based for HABITS — see
// docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md). Without this gate, registration
// seeds and connection/thought activity would create Therr achievements stamped
// with the niche brand, which then surface in the niche app's achievements list
// even though brand-scoped SQL filters are working as intended.
const ALL_THERR_CLASSES = Object.keys(achievementsByClass);
export const achievementClassesByBrand: { [brand: string]: ReadonlySet<string> } = {
    [BrandVariations.THERR]: new Set(ALL_THERR_CLASSES),
    [BrandVariations.DASHBOARD_THERR]: new Set(ALL_THERR_CLASSES),
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
