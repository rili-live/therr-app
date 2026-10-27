import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import { getReferralRewardProgress } from './helpers/referralReward';

/**
 * The founder unlock as a referral reward: progress toward it, for the invite screen and the
 * paywall to render ("2 of 3 friends active"). The grant itself happens on the friend's check-in
 * (see `helpers/referralReward.ts`), never on a client request.
 */
const getMyReferralReward: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    try {
        return res.status(200).send(await getReferralRewardProgress(userId));
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:REFERRAL_REWARDS_ROUTES:ERROR' });
    }
};

export {
    getMyReferralReward,
};
