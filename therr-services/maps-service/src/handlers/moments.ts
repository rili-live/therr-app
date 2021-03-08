import axios from 'axios';
import { getSearchQueryArgs, getSearchQueryString } from 'therr-js-utilities/http';
import { RequestHandler } from 'express';
import * as globalConfig from '../../../../global-config';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// CREATE
const createMoment = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];

    return Store.moments.createMoment({
        ...req.body,
        locale,
        fromUserId: userId,
    })
        .then(([moments]) => res.status(201).send(moments))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

// READ
const searchMoments: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        filterBy,
        query,
        itemsPerPage,
        longitude,
        latitude,
        pageNumber,
    } = req.query;
    const integerColumns = ['maxViews', 'longitude', 'latitude'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    let fromUserIds;
    if (query === 'me') {
        fromUserIds = [userId];
    } else if (query === 'connections') {
        let queryString = getSearchQueryString({
            filterBy: 'acceptingUserId',
            query: userId,
            itemsPerPage: 50,
            pageNumber: 1,
            orderBy: 'interactionCount',
            order: 'desc',
        });
        queryString = `${queryString}&shouldCheckReverse=true`;
        const connectionsResponse: any = await axios({
            method: 'get',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections${queryString}`,
            headers: {
                authorization: req.headers.authorization,
                'x-localecode': req.headers['x-localecode'] || 'en-us',
                'x-userid': userId,
            },
        });
        fromUserIds = connectionsResponse.data.results
            .map((connection: any) => connection.users.filter((user: any) => user.id != userId)[0].id); // eslint-disable-line eqeqeq
    }
    const searchPromise = Store.moments.searchMoments(searchArgs[0], searchArgs[1], fromUserIds);
    const countPromise = Store.moments.countRecords({
        filterBy,
        query,
        longitude,
        latitude,
    }, fromUserIds);

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

// DELETE
const deleteMoments = (req, res) => {
    const userId = req.headers['x-userid'];

    return Store.moments.deleteMoments({
        ...req.body,
        fromUserId: userId,
    })
        .then(([moments]) => res.status(202).send(moments))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

export {
    createMoment,
    searchMoments,
    deleteMoments,
};
