import activist from './activist';
import communityLeader from './communityLeader';
import critic from './critic';
import entrepreneur from './entrepreneur';
import eventPlanner from './eventPlanner';
import explorer from './explorer';
import humanitarian from './humanitarian';
import influencer from './influencer';
import journalist from './journalist';
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
    socialite,
    thinker,
    tourGuide,
};

export default achievements;
