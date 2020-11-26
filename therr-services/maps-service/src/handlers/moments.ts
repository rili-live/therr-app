import { RequestHandler } from 'express';
import { getSearchQueryArgs } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// CREATE
const createMoment = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';

    return Store.moments.createMoment({
        ...req.body,
        locale,
    })
        .then(([moments]) => res.status(201).send(moments))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

// READ
const searchMoments: RequestHandler = (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        filterBy,
        query,
        itemsPerPage,
        longitude,
        latitude,
        pageNumber,
    } = req.query;
    const integerColumns = ['fromUserId', 'maxViews', 'longitude', 'latitude'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.moments.searchMoments(searchArgs[0], searchArgs[1]);
    const countPromise = Store.moments.countRecords({
        filterBy,
        query,
        longitude,
        latitude,
    });

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results,
            pagination: {
                totalItems: Number(countResult[0].count),
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

export {
    createMoment,
    searchMoments,
};
