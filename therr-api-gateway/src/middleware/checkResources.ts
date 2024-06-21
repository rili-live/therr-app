// import { ResourceExchangeRates } from 'therr-js-utilities/constants';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';

const checkResources = (action) => (req, res, next) => {
    const locale = req.headers['x-localecode'] || 'en-us';

    // TODO: Implement use of user points/resources/karma...
    if (action === 'createForum') {
        // TODO: RSERV-53 - Check if user has enough userResources to satisfy the exchange rate
        // Determine how to update user resources to reflect the consumption
        return handleHttpError({
            res,
            message: translate(locale, 'validation.notEnoughEnergy'),
            statusCode: 400,
        });
    }

    return next();
};

export default checkResources;
