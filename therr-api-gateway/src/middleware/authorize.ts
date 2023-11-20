import handleHttpError from '../utilities/handleHttpError';

// eslint-disable-next-line no-shadow
export enum AccessCheckType {
    ALL = 'all', // User has all of the access levels from the check
    ANY = 'any', // User has at least one of the access levels from the check
    NONE = 'none', // User does not have any of the access levels from the check
}

interface IAccess {
    type: AccessCheckType;
    levels: Array<string>;
    isPublic?: boolean;
}

const isAuthorized = (access: IAccess, userAccessLevels: string[]) => {
    if (access.isPublic || userAccessLevels) {
        if (!userAccessLevels) {
            return true;
        }
        if (access.type === AccessCheckType.NONE) {
            // User does not have any of the access levels from the check
            return !access.levels.some((lvl) => userAccessLevels.includes(lvl));
        }
        if (access.type === AccessCheckType.ANY) {
            // User has at least one of the access levels from the check
            return access.levels.some((lvl) => userAccessLevels.includes(lvl));
        }
        if (access.type === AccessCheckType.ALL) {
            // User has all of the access levels from the check
            return !access.levels.some((lvl) => !userAccessLevels.includes(lvl));
        }
    }

    return false;
};

/**
 * Checks user access levels after the authenticate middleware.
 * This ensures that we can expect authorization headers to be present before gate-keeping.
 *
 * When verifying organization access levels, the organization being requested should be taken into account.
 *
 * NOTE that we will not always be able to verify organization access in API gateway.
 * In some cases it may need to be verified at a lower level in the request pipeline (microservices).
 */
const authorize = (access: IAccess, orgAccess?: IAccess) => async (req, res, next) => {
    let userAccessLevels = [];
    let userOrgsAccess = {};
    const contextOrgId = req.params.organizationId;

    try {
        userAccessLevels = JSON.parse(req['x-user-access-levels'] || '[]');
        userOrgsAccess = JSON.parse(req['x-organizations'] || '{}');
    } catch (e) {
        console.log('Failed to parse x-user-access-levels OR x-organizations header', e);
    }

    if (contextOrgId && orgAccess) {
        const organizationAccessLevels = userOrgsAccess[contextOrgId] || [];
        if (!isAuthorized(orgAccess, organizationAccessLevels)) {
            return handleHttpError({
                res,
                message: 'Invalid Organization Access Levels',
                statusCode: 403,
            });
        }
    }

    if (!isAuthorized(access, userAccessLevels)) {
        return handleHttpError({
            res,
            message: 'Invalid Access Levels',
            statusCode: 403,
        });
    }

    return next();
};

// TODO: Implement and test this across the api gateway endpoints
export default authorize;
