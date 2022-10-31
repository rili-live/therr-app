import * as express from 'express';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import sendRewardsExchangeEmail from '../api/email/admin/sendRewardsExchangeEmail';
// import {
//     verifyEmail,
// } from '../handlers/email';

const router = express.Router();

router.post('/', (req, res) => {
    const userId = req.headers['x-userid'] as string;
    return Store.users.getUserById(userId, ['userName', 'email', 'settingsTherrCoinTotal']).then(([user]) => {
        if (!user) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return sendRewardsExchangeEmail({
            subject: '[Rewards Requested] Coin Exchange',
            toAddresses: [],
        }, {
            amount: req.body.amount || user.settingsTherrCoinTotal,
            userId: req.headers['x-userid'],
            userName: user.userName,
            userEmail: user.email,
        })
            .then(() => res.status(200).send({ message: 'Rewards request sent successfully!' }))
            .catch((err) => handleHttpError({
                res,
                err,
                message: err.message,
                statusCode: 500,
            }));
    });
});

export default router;
