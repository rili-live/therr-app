import { ErrorCodes } from 'therr-js-utilities/constants';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import sendRewardsExchangeEmail from '../api/email/admin/sendRewardsExchangeEmail';
import { parseConfigValue } from './config';

const calculateExchangeRate = (totalCoins, therrDollarReserves = 100) => {
    // Ensure we don't divide by zero
    const coinsInCirculation = totalCoins || therrDollarReserves;
    const unrounded = therrDollarReserves / coinsInCirculation;
    const deducted = unrounded * 0.90; // 10% service fee
    return Math.round((Number(deducted) + Number.EPSILON) * 100) / 100;
};

const fetchExchangeRate = () => Store.users.sumTotalCoins()
    .then((results) => {
        const totalCoins = results[0]?.totalTherrCoinSupply;
        if (!totalCoins) {
            return Promise.reject(new Error('zero-coins'));
        }

        return Store.config.get('therrDollarReserves').then((configResults: any) => {
            if (!configResults.length) {
                return Promise.reject(new Error('missing-config'));
            }
            /**
             * Fetch remaining dollar reserve balance from source
             * We will need to update the reserve balance on each exchange
             * and each time we "mint" new coins
             */
            const therrDollarReserves = parseConfigValue(configResults[0].value, configResults[0].type);
            const exchangeRate = calculateExchangeRate(totalCoins, therrDollarReserves);
            return exchangeRate;
        });
    });

const requestRewardsExchange = (req, res) => {
    const userId = req.headers['x-userid'] as string;
    return Store.users.getUserById(userId, ['userName', 'email', 'settingsTherrCoinTotal']).then(([user]) => {
        if (!user) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return fetchExchangeRate()
            .then((exchangeRate) => sendRewardsExchangeEmail({
                subject: '[Rewards Requested] Coin Exchange',
                toAddresses: [],
            }, {
                amount: req.body.amount || user.settingsTherrCoinTotal,
                exchangeRate,
                userId: req.headers['x-userid'],
                userName: user.userName,
                userEmail: user.email,
            }))
            .then(() => res.status(200).send({ message: 'Rewards request sent successfully!' }))
            .catch((err) => handleHttpError({
                res,
                err,
                message: err.message,
                statusCode: 500,
            }));
    });
};

const getCurrentExchangeRate = (req, res) => {
    const userId = req.headers['x-userid'] as string;

    return fetchExchangeRate().then((exchangeRate) => res.status(200).send({ exchangeRate }))
        .catch((err) => handleHttpError({
            res,
            err,
            message: err.message,
            statusCode: 500,
        }));
};

const transferCoins = (req, res) => {
    const { fromUserId, toUserId, amount } = req.body;

    return Store.users.transferTherrCoin(fromUserId, toUserId, amount)
        .then((result) => {
            if (result?.transactionStatus !== 'success') {
                if (result.transactionStatus === 'insufficient-funds') {
                    return handleHttpError({
                        res,
                        message: result.transactionStatus,
                        statusCode: 400,
                        errorCode: ErrorCodes.INSUFFICIENT_THERR_COIN_FUNDS,
                    });
                }

                return handleHttpError({
                    res,
                    message: result.transactionStatus,
                    statusCode: 500,
                    errorCode: ErrorCodes.UNKNOWN_ERROR,
                });
            }

            return res.status(200).send({ message: 'Coins transferred successfully!', ...result });
        });
};

export {
    requestRewardsExchange,
    getCurrentExchangeRate,
    transferCoins,
};
