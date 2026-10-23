/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface ICreateChallengeBody {
    /** A habit the creator already tracks actively. */
    habitGoalId: string;
    /** 7, 14, 30, 60 or 90. Defaults to 30 on the server. */
    durationDays?: number;
    title?: string;
    /** The device's IANA zone, so the challenge starts on the creator's own today. */
    timeZone?: string;
}

/**
 * Join-by-link challenges (Friends with Habits). A challenge is a public scoreboard over its
 * members' own check-ins on one habit; members check in through the ordinary check-in endpoint.
 * The share link is https://habits.therr.com/c/<joinToken>.
 */
class HabitsChallengesService {
    create = (data: ICreateChallengeBody) => axios({
        method: 'post',
        url: '/users-service/habits/challenges',
        data,
    });

    getMine = (timeZone?: string) => axios({
        method: 'get',
        url: '/users-service/habits/challenges/mine',
        params: timeZone ? { timeZone } : undefined,
    });

    /** Public; a signed-in caller also gets `viewer` (isMember, isCreator, rank). */
    getByToken = (joinToken: string, timeZone?: string) => axios({
        method: 'get',
        url: `/users-service/habits/challenges/by-token/${encodeURIComponent(joinToken)}`,
        params: timeZone ? { timeZone } : undefined,
    });

    /** Starts the habit for the joiner. 402 with paywall metadata at the free-tier habit cap. */
    join = (joinToken: string, timeZone?: string) => axios({
        method: 'post',
        url: `/users-service/habits/challenges/by-token/${encodeURIComponent(joinToken)}/join`,
        data: { timeZone },
    });

    leave = (challengeId: string) => axios({
        method: 'post',
        url: `/users-service/habits/challenges/${challengeId}/leave`,
    });

    /** Creator only. */
    cancel = (challengeId: string) => axios({
        method: 'post',
        url: `/users-service/habits/challenges/${challengeId}/cancel`,
    });

    /**
     * Progress toward the founder unlock earned by bringing active friends. The grant happens
     * server-side on a friend's check-in; this only reports it.
     */
    getReferralReward = () => axios({
        method: 'get',
        url: '/users-service/habits/referral-reward',
    });
}

export default new HabitsChallengesService();
