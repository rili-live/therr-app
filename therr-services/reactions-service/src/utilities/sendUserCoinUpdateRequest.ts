import getReactionValuation from './getReactionValuation';
import requestUsersService from './requestUsersService';

const sendUserCoinUpdateRequest = (req, currentReaction) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const coinValue = getReactionValuation(currentReaction, req.body);

    if (coinValue !== 0) {
        return requestUsersService({
            authorization: req.headers.authorization,
            userId,
            locale,
        }, {
            path: `/users/${userId}/coins`,
            method: 'put',
        }, {
            settingsTherrCoinTotal: coinValue,
        });
    }

    return Promise.resolve();
};

export default sendUserCoinUpdateRequest;
