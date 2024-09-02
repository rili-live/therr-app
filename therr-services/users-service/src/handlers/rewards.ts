import { CurrencyTransactionMessages, ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import sendRewardsExchangeEmail from '../api/email/admin/sendRewardsExchangeEmail';
import { parseConfigValue } from './config';
import sendCoinsReceivedEmail from '../api/email/for-social/sendCoinsReceivedEmail';
import sendInsufficientFundsEmail from '../api/email/admin/sendInsufficientFundsEmail';

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
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return Store.users.getUserById(userId, ['userName', 'email', 'settingsTherrCoinTotal']).then(([user]) => {
        if (!user) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return fetchExchangeRate()
            .then((exchangeRate) => {
                logSpan({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: ['User requested to exchange coins'],
                    traceArgs: {
                        'coins.amount': req.body.amount || user.settingsTherrCoinTotal,
                        'giftcard.provider': req.body.provider,
                        'coins.exchangeRate': exchangeRate,
                        'user.id': userId,
                    },
                });

                return sendRewardsExchangeEmail({
                    subject: '[Rewards Requested] Coin Exchange',
                    toAddresses: [],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                }, {
                    amount: req.body.amount || user.settingsTherrCoinTotal,
                    exchangeRate,
                    provider: req.body.provider || 'amazon',
                    userId: req.headers['x-userid'],
                    userName: user.userName,
                    userEmail: user.email,
                });
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
    const whiteLabelOrigin = req.headers['x-therr-origin-host'] || '';

    return fetchExchangeRate().then((exchangeRate) => res.status(200).send({ exchangeRate }))
        .catch((err) => handleHttpError({
            res,
            err,
            message: err.message,
            statusCode: 500,
        }));
};

const transferCoins = (req, res) => {
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const {
        fromUserId, toUserId, amount, spaceId, spaceName,
    } = req.body;

    return Store.users.getUsers({ id: fromUserId }, { id: toUserId }, {}, ['id', 'email', 'userName', 'settingsEmailReminders']).then((usersResult) => {
        if (!usersResult || !usersResult.length) {
            return handleHttpError({
                res,
                message: 'One or both users not found',
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        return Store.users.transferTherrCoin(fromUserId, toUserId, amount)
            .then((result) => {
                if (result?.transactionStatus !== 'success') {
                    if (result.transactionStatus === CurrencyTransactionMessages.INSUFFICIENT_FUNDS) {
                        if (spaceId && process.env.AWS_FEEDBACK_EMAIL_ADDRESS) {
                            const { userName, email } = usersResult.find((user) => user.id === fromUserId);
                            sendInsufficientFundsEmail({
                                subject: `[Insufficient Coins] Request for ${amount} TherrCoin(s) rejected!`,
                                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS],
                                agencyDomainName: whiteLabelOrigin,
                                brandVariation,
                            }, {
                                coinTotal: amount,
                                userName,
                                email,
                                spaceName,
                            });
                        }
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

                const {
                    id,
                    userName,
                    email,
                    settingsEmailReminders,
                } = usersResult.find((user) => user.id === toUserId);
                if (amount > 0 && userName && email) {
                    sendCoinsReceivedEmail({
                        subject: `[Coins Received] You earned ${amount} TherrCoin(s)!`,
                        toAddresses: [email],
                        agencyDomainName: whiteLabelOrigin,
                        brandVariation,
                        recipientIdentifiers: {
                            id,
                            accountEmail: email,
                            settingsEmailReminders,
                        },
                    }, {
                        coinTotal: amount,
                        userName,
                    });
                }

                return res.status(200).send({ message: 'Coins transferred successfully!', ...result });
            });
    });
};

export {
    requestRewardsExchange,
    getCurrentExchangeRate,
    transferCoins,
};
