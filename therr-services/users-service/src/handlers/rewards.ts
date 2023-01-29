import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import sendRewardsExchangeEmail from '../api/email/admin/sendRewardsExchangeEmail';

const calculateExchangeRate = (totalCoins, therrDollarReserves = 100) => {
    // Ensure we don't divide by zero
    const coinsInCirculation = totalCoins || therrDollarReserves;
    return therrDollarReserves / coinsInCirculation;
};

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
};

const getCurrentExchangeRate = (req, res) => {
    const userId = req.headers['x-userid'] as string;

    return Store.users.sumTotalCoins()
        .then((results) => {
            const totalCoins = results[0]?.totalTherrCoinSupply;
            if (!totalCoins) {
                return handleHttpError({
                    res,
                    message: 'Zero coins found in Therr reserves',
                    statusCode: 400,
                });
            }

            /**
             * TODO: Fetch remaining dollar reserve balance from source
             * We will need to update the reserve balance on each exchange
             * and each time we "mint" new coins
             */
            const exchangeRate = calculateExchangeRate(totalCoins);
            res.status(200).send({ exchangeRate });
        })
        .catch((err) => handleHttpError({
            res,
            err,
            message: err.message,
            statusCode: 500,
        }));
};

export {
    requestRewardsExchange,
    getCurrentExchangeRate,
};
