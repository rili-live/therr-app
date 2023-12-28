import { parseHeaders } from 'therr-js-utilities/http';
import getReactionValuation from './getReactionValuation';
import requestUsersService from './requestUsersService';

const sendUserCoinUpdateRequest = (req, currentReaction) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    const coinValue = getReactionValuation(currentReaction, req.body);

    if (coinValue !== 0) {
        return requestUsersService({
            authorization: req.headers.authorization,
            userId,
            locale,
            whiteLabelOrigin,
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
