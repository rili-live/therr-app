import { AccessLevels, ErrorCodes } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import { RequestHandler } from 'express';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import { SUPER_ADMIN_ID } from '../constants';
import { DisplayType } from '../store/SpaceDisplayRequestsStore';

const VALID_DISPLAY_TYPES: DisplayType[] = ['coaster', 'table_tent', 'window_cling'];

// POST /space-display-requests
const createSpaceDisplayRequest: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userAccessLevels: accessLevels,
    } = parseHeaders(req.headers);

    const {
        spaceId,
        displayType,
        shippingName,
        shippingAddress,
        shippingCity,
        shippingRegion,
        shippingPostalCode,
        shippingCountry,
    } = req.body;

    if (!spaceId) {
        return handleHttpError({ res, message: translate(locale, 'spaceDisplayRequests.missingSpaceId'), statusCode: 400 });
    }

    if (!displayType || !VALID_DISPLAY_TYPES.includes(displayType)) {
        return handleHttpError({
            res,
            message: translate(locale, 'spaceDisplayRequests.invalidDisplayType'),
            statusCode: 400,
        });
    }

    const [space] = await Store.spaces.getByIdForDisplayRequest(spaceId).catch(() => []);

    if (!space) {
        return handleHttpError({
            res,
            message: translate(locale, 'spaces.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    // Only the space owner may request a display kit
    if (space.fromUserId !== userId && !accessLevels?.includes(AccessLevels.SUPER_ADMIN)) {
        return handleHttpError({
            res,
            message: translate(locale, 'spaces.mustBeOwner'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    // Reject unclaimed spaces (owned by super admin with no pending claim)
    const isUnclaimed = space.fromUserId === SUPER_ADMIN_ID && !space.requestedByUserId;
    if (isUnclaimed || space.isClaimPending) {
        return handleHttpError({
            res,
            message: translate(locale, 'spaceDisplayRequests.spaceMustBeClaimed'),
            statusCode: 400,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    // Require a verified business address on the space
    if (!space.addressStreetAddress || !space.addressLocality || !space.addressRegion) {
        return handleHttpError({
            res,
            message: translate(locale, 'spaceDisplayRequests.businessAddressRequired'),
            statusCode: 400,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    return Store.spaceDisplayRequests.create({
        spaceId,
        fromUserId: userId,
        displayType,
        shippingName,
        shippingAddress,
        shippingCity,
        shippingRegion,
        shippingPostalCode,
        shippingCountry,
    }).then(([displayRequest]) => res.status(201).send({ displayRequest }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_DISPLAY_REQUESTS:ERROR' }));
};

// GET /space-display-requests (admin only)
const listSpaceDisplayRequests: RequestHandler = async (req: any, res: any) => {
    const {
        userAccessLevels: accessLevels,
    } = parseHeaders(req.headers);

    if (!accessLevels?.includes(AccessLevels.SUPER_ADMIN)) {
        return handleHttpError({
            res,
            message: 'Forbidden',
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    const {
        status,
        spaceId,
        limit,
        offset,
    } = req.query;

    return Store.spaceDisplayRequests.list({
        status: status || undefined,
        spaceId: spaceId || undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
    }).then((requests) => res.status(200).send({ requests }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_DISPLAY_REQUESTS:ERROR' }));
};

export {
    createSpaceDisplayRequest,
    listSpaceDisplayRequests,
};
