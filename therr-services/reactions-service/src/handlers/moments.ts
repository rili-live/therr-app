import { RequestHandler } from 'express';
import axios from 'axios';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

const searchActiveMoments: RequestHandler = async (req: any, res: any) => {
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const {
        limit,
        offset,
        withMedia,
        withUser,
    } = req.body;

    const conditions: any = {
        userId,
        userHasActivated: true,
    };

    return Store.momentReactions.get(conditions, undefined, {
        limit,
        offset,
    })
        .then((reactions) => {
            const momentIds = reactions?.map((reaction) => reaction.momentId) || [];

            return axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/moments/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                },
                data: {
                    momentIds,
                    withMedia,
                    withUser,
                },
            });
        })
        .then((response) => res.status(200).send({
            moments: response?.data?.moments,
            media: response?.data?.media,
            pagination: {
                itemsPerPage: limit,
                offset,
                isLastPage: response?.data?.moments?.length < limit,
            },
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

export {
    searchActiveMoments,
};
