import KnexBuilder, { Knex } from 'knex';
import * as countryGeo from 'country-reverse-geocoding';
import { Content, Location } from 'therr-js-utilities/constants';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { storage } from '../api/aws';
import MediaStore, { ICreateMediaParams } from './MediaStore';
import getBucket from '../utilities/getBucket';
import findUsers from '../utilities/findUsers';
import { isTextUnsafe } from '../utilities/contentSafety';
import { SPACE_INCENTIVES_TABLE_NAME } from './SpaceIncentivesStore';
import { ICreateAreaParams, IDeleteAreasParams } from './common/models';
import { sanitizeNotificationMsg } from './common/utils';
import { getRatings } from '../utilities/getReactions';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACES_TABLE_NAME = 'main.spaces';

const countryReverseGeo = countryGeo.country_reverse_geocoding();
const maxNotificationMsgLength = 100;
export const DEFAULT_RADIUS_MEDIUM = 10; // Small radius default to prevent overlap db constraint

export interface ICreateSpaceParams extends ICreateAreaParams {
    addressReadable?: string;
    requestedByUserId?: string;
    organizationId?: string;
    isClaimPending?: boolean;
    incentiveCurrencyId?: string;
    thirdPartyRatings?: any;
    happyHours?: any;
    openingHours?: any;
    featuredIncentiveKey?: string;
    featuredIncentiveValue?: number;
    featuredIncentiveRewardKey?: string;
    featuredIncentiveRewardValue?: number;
    featuredIncentiveCurrencyId?: string;
    phoneNumber?: string;
    websiteUrl?: string;
    menuUrl?: string;
    orderUrl?: string;
    reservationUrl?: string;
    businessTransactionId?: string;
    businessTransactionName?: string;
    isPointOfInterest?: boolean;
    addressStreetAddress?: string;
    addressRegion?: string;
    addressLocality?: string;
    postalCode?: number;
    priceRange?: number;
}

// TODO: This needs more security logic to ensure the requesting user has permissions to view
// non-public images
const getSpacesToMediaAndUsersAndRatings = (spaces: any[], media?: any[], users?: any[], ratings?: any[]) => {
    const imageExpireTime = Date.now() + 60 * 60 * 1000; // 60 minutes
    const matchingUsers: any = {};
    const signingPromises: any = [];

    // TODO: Optimize
    const mappedSpaces = spaces.map((space, index) => {
        const modifiedSpace = space;
        modifiedSpace.media = [];
        modifiedSpace.user = {};
        modifiedSpace.rating = ratings?.[index] || {};

        // MEDIA
        if (space.medias?.length) {
            modifiedSpace.media = space.medias.filter((m) => {
                if (m.type === Content.mediaTypes.USER_IMAGE_PRIVATE) {
                    const bucket = getBucket(m.type);
                    if (bucket) {
                        let promise;
                        // TODO: Consider alternatives to cache these urls (per user) and their expire time
                        if (bucket === getBucket(Content.mediaTypes.USER_IMAGE_PRIVATE)) {
                            promise = Promise.resolve({
                                [m.path]: `${process.env.IMAGE_KIT_URL_PRIVATE}${m.path}`,
                            });
                        } else {
                            promise = storage
                                .bucket(bucket)
                                .file(m.path)
                                .getSignedUrl({
                                    version: 'v4',
                                    action: 'read',
                                    expires: imageExpireTime,
                                    // TODO: Test is cache-control headers work here
                                    extensionHeaders: {
                                        'Cache-Control': 'public, max-age=43200', // 1 day
                                    },
                                })
                                .then((urls) => ({
                                    [m.path]: urls[0],
                                }))
                                .catch((err) => {
                                    console.log(err);
                                    return {};
                                });
                        }
                        signingPromises.push(promise);
                    } else {
                        console.log('SpacesStore.ts: bucket is undefined');
                    }

                    return true;
                }

                return false;
            });
        }

        // USER
        if (users) {
            const matchingUser = users.find((user) => user.id === modifiedSpace.fromUserId);
            if (matchingUser) {
                matchingUsers[matchingUser.id] = matchingUser;
                modifiedSpace.fromUserName = matchingUser.userName;
                modifiedSpace.fromUserFirstName = matchingUser.firstName;
                modifiedSpace.fromUserLastName = matchingUser.lastName;
                modifiedSpace.fromUserMedia = matchingUser.media;
                modifiedSpace.fromUserIsSuperUser = matchingUser.isSuperUser;
            }
        }

        return modifiedSpace;
    });

    return {
        matchingUsers,
        mappedSpaces,
        signingPromises,
    };
};

export default class SpacesStore {
    db: IConnection;

    mediaStore: MediaStore;

    constructor(dbConnection, mediaStore) {
        this.db = dbConnection;
        this.mediaStore = mediaStore;
    }

    /**
     * This is used to check for duplicates before creating a new spaces
     */
    get(filters) {
        const notificationMsg = filters.notificationMsg
            ? `${sanitizeNotificationMsg(filters.notificationMsg).substring(0, maxNotificationMsgLength)}`
            : `${sanitizeNotificationMsg(filters.message).substring(0, maxNotificationMsgLength)}`;
        // hard limit to prevent overloading client
        const query = knexBuilder
            .from(SPACES_TABLE_NAME)
            .where({
                fromUserId: filters.fromUserId,
                message: filters.message,
                notificationMsg,
            });

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    /**
     * This is used to check for duplicates/overlaps before creating a new spaces for events
     */
    getByLocation(coords, radius = DEFAULT_RADIUS_MEDIUM) {
        const newGeom = `ST_SetSRID(ST_Buffer(ST_MakePoint(${coords.longitude}, ${coords.latitude})::geography, ${radius})::geometry, 4326)`;
        const query = knexBuilder
            .from(SPACES_TABLE_NAME)
            .where(knexBuilder.raw(`
                ST_Relate(geom, ${newGeom}, '2********')
            `));

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    // eslint-disable-next-line default-param-last
    searchMySpaces(conditions: any = {}, returning, userId: string, overrides?: any, includePublicResults = true) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : '*')
            .from(SPACES_TABLE_NAME)
            // TODO: Determine a better way to select spaces that are most relevant to the user
            // .orderBy(`${SPACES_TABLE_NAME}.updatedAt`) // Sorting by updatedAt is very expensive/slow
            // NOTE: Cast to a geography type to search distance within n meters
            .where({
                fromUserId: userId,
                isMatureContent: false, // content that has been blocked
            });

        if (conditions.query != undefined && conditions.filterBy) { // eslint-disable-line eqeqeq
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;

            queryString = queryString.andWhere(conditions.filterBy, operator, query);
            queryString = queryString.andWhere((builder) => { // eslint-disable-line func-names
                builder.where(conditions.filterBy, operator, query);
                if (includePublicResults) {
                    builder.orWhere({ isPublic: true });
                }
            });
        }

        if (overrides?.userOrganizations?.length) {
            queryString = queryString.orWhereIn('organizationId', overrides?.userOrganizations);
        }

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            return configuredResponse;
        });
    }

    getById(id) {
        const query = knexBuilder
            .select([
                `${SPACES_TABLE_NAME}.id`,
                `${SPACES_TABLE_NAME}.fromUserId`,
                `${SPACES_TABLE_NAME}.notificationMsg`,
            ])
            .from(SPACES_TABLE_NAME)
            .leftJoin(SPACE_INCENTIVES_TABLE_NAME, `${SPACES_TABLE_NAME}.id`, `${SPACE_INCENTIVES_TABLE_NAME}.spaceId`)
            .columns([
                `${SPACE_INCENTIVES_TABLE_NAME}.id as incentives[].id`,
                `${SPACE_INCENTIVES_TABLE_NAME}.incentiveKey as incentives[].incentiveKey`,
                `${SPACE_INCENTIVES_TABLE_NAME}.incentiveValue as incentives[].incentiveValue`,
                `${SPACE_INCENTIVES_TABLE_NAME}.incentiveRewardKey as incentives[].incentiveRewardKey`,
                `${SPACE_INCENTIVES_TABLE_NAME}.incentiveRewardValue as incentives[].incentiveRewardValue`,
                `${SPACE_INCENTIVES_TABLE_NAME}.incentiveCurrencyId as incentives[].incentiveCurrencyId`,
                `${SPACE_INCENTIVES_TABLE_NAME}.isActive as incentives[].isActive`,
                `${SPACE_INCENTIVES_TABLE_NAME}.isFeatured as incentives[].isFeatured`,
                `${SPACE_INCENTIVES_TABLE_NAME}.maxUseCount as incentives[].maxUseCount`,
                `${SPACE_INCENTIVES_TABLE_NAME}.minUserDataProps as incentives[].minUserDataProps`,
                `${SPACE_INCENTIVES_TABLE_NAME}.region as incentives[].region`,
                `${SPACE_INCENTIVES_TABLE_NAME}.requiredUserDataProps as incentives[].requiredUserDataProps`,
                `${SPACE_INCENTIVES_TABLE_NAME}.startsAt as incentives[].startsAt`,
                `${SPACE_INCENTIVES_TABLE_NAME}.endsAt as incentives[].endsAt`,
            ])
            .where({
                [`${SPACES_TABLE_NAME}.id`]: id,
            });

        return this.db.read.query(query.toString())
            .then((response) => formatSQLJoinAsJSON(response.rows, [{ propKey: 'incentives', propId: 'id' }]));
    }

    getByIdSimple(id) {
        const query = knexBuilder
            .select([
                'id',
                'category',
                'fromUserId',
                'requestedByUserId',
                'organizationId',
                'isPublic',
                'isMatureContent',
                'latitude',
                'longitude',
                'message',
                'notificationMsg',
                'radius',
                'region',
            ])
            .from(SPACES_TABLE_NAME)
            .where({
                id,
            });

        return this.db.read.query(query.toString())
            .then((response) => response.rows);
    }

    // Combine with search to avoid getting count out of sync
    countRecords(params, fromUserIds) {
        let proximityMax = Location.AREA_PROXIMITY_METERS;
        if ((params.filterBy && params.filterBy === 'distance') && params.query) {
            proximityMax = params.query;
        }
        let queryString = knexBuilder
            .from(SPACES_TABLE_NAME)
            .count('*')
            // NOTE: Cast to a geography type to search distance within n meters
            .where(knexBuilder.raw(`ST_DWithin(geom, ST_MakePoint(${params.longitude}, ${params.latitude})::geography, ${proximityMax})`));

        if ((params.filterBy && params.filterBy !== 'distance')) {
            if (params.filterBy === 'fromUserIds') {
                queryString = queryString.andWhere((builder) => { // eslint-disable-line func-names
                    builder.whereIn('fromUserId', fromUserIds);
                });
            } else if (params.query != undefined) { // eslint-disable-line eqeqeq
                queryString = queryString.andWhere({
                    [params.filterBy]: params.query || '',
                });
            }
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    // eslint-disable-next-line default-param-last
    searchSpaces(conditions: any = {}, returning, fromUserIds: string[] = [], overrides?: any, includePublicResults = true) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let proximityMax = overrides?.distanceOverride || Location.AREA_PROXIMITY_METERS;
        if ((conditions.filterBy && conditions.filterBy === 'distance') && conditions.query) {
            proximityMax = conditions.query;
        }
        let returningMod = ((returning && returning.length) ? returning : '*');
        returningMod = overrides?.shouldLimitDetail
            ? ['id', 'addressReadable', 'category', 'websiteUrl', 'notificationMsg']
            : returningMod;
        const firstWhere: any = {
            isMatureContent: false, // content that has been blocked
        };
        if (conditions.filterBy !== 'isClaimPending') {
            firstWhere.isClaimPending = false; // hide pending claim requests
        }
        let queryString: any = knexBuilder
            .select(returningMod)
            .from(SPACES_TABLE_NAME)
            // TODO: Determine a better way to select spaces that are most relevant to the user
            // .orderBy(`${SPACES_TABLE_NAME}.updatedAt`) // Sorting by updatedAt is very expensive/slow
            // NOTE: Cast to a geography type to search distance within n meters
            .where(knexBuilder.raw(`ST_DWithin(geom, ST_MakePoint(${conditions.longitude}, ${conditions.latitude})::geography, ${proximityMax})`)) // eslint-disable-line quotes, max-len
            .andWhere(firstWhere);

        if ((conditions.filterBy && conditions.filterBy !== 'distance') && conditions.query != undefined) { // eslint-disable-line eqeqeq
            const operator = conditions.filterOperator || '=';
            let query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
            if (query === 'true') {
                query = true;
            }
            if (query === 'false') {
                query = false;
            }

            if (conditions.filterBy === 'fromUserIds') {
                queryString = queryString.andWhere((builder) => { // eslint-disable-line func-names
                    builder.whereIn('fromUserId', fromUserIds);
                    if (includePublicResults) {
                        builder.orWhere({ isPublic: true });
                    }
                });
            } else {
                queryString = queryString.andWhere(conditions.filterBy, operator, query);
                queryString = queryString.andWhere((builder) => { // eslint-disable-line func-names
                    builder.where(conditions.filterBy, operator, query);
                    if (includePublicResults) {
                        builder.orWhere({ isPublic: true });
                    }
                });
            }
        }

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            return configuredResponse;
        });
    }

    searchRelatedSpaces(relatedCoordinates: [string, string][], relatedInterestsKeys: string[] = [], overrides: any = {}, returning: string[] = ['*']) {
        const proximityMax = overrides?.distanceOverride || Location.AREA_PROXIMITY_METERS;
        const coordsAsString = relatedCoordinates.map((coord) => `${coord[1]} ${coord[0]}`);
        const centroidGeom = knexBuilder.raw(`(SELECT ST_SetSRID(ST_Centroid('MULTIPOINT (${coordsAsString.join(', ')})'), 4326))`);
        const interestsKeysStr = relatedInterestsKeys.map((key) => `'${key}'`).join(',');

        const returningMod = returning?.length ? returning : ['*'];
        const firstWhere: any = {
            isClaimPending: false, // hide pending claim requests
            isMatureContent: false, // content that has been blocked
        };

        let query = knexBuilder
            .select(
                ...returningMod,
                knexBuilder.raw(`"geomCenter" <-> ${centroidGeom} AS dist`),
                knexBuilder.raw(`"geomCenter"::geography <-> ${centroidGeom}::geography AS "distInMeters"`),
                knexBuilder.raw(`ST_Y(${centroidGeom}) AS "centroidLatitude"`),
                knexBuilder.raw(`ST_X(${centroidGeom}) AS "centroidLongitude"`),
            )
            .from(SPACES_TABLE_NAME)
            .where(firstWhere);

        if (overrides.requestorLatitude && overrides.requestorLongitude) {
            query = query
                .andWhere(
                    // eslint-disable-next-line max-len
                    knexBuilder.raw(`ST_DWithin(geom, ST_MakePoint(${overrides.requestorLongitude}, ${overrides.requestorLatitude})::geography, ${proximityMax})`),
                );
        }

        if (relatedInterestsKeys?.length) {
            // TODO: Test this with various interests lists
            query = query.whereRaw(`"interestsKeys" \\?| array[${interestsKeysStr}]`);
        }

        query = query.orderBy('dist')
            .limit(5);

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    findSpaces(spaceIds, filters, options: any = {}) {
        // hard limit to prevent overloading client
        let restrictedLimit = filters?.limit || 1000;
        restrictedLimit = restrictedLimit > 1000 ? 1000 : restrictedLimit;
        const orderBy = filters.orderBy || `${SPACES_TABLE_NAME}.updatedAt`;
        const order = filters.order || 'DESC';

        let query = knexBuilder
            .from(SPACES_TABLE_NAME)
            .orderBy(orderBy, order)
            .where('isClaimPending', false)
            .whereIn('id', spaceIds || [])
            .limit(restrictedLimit);

        if (filters.before) {
            query = query.andWhere('createdAt', '<', filters.before);
        }

        if (options?.shouldHideMatureContent) {
            query = query.where({ isMatureContent: false });
        }

        return this.db.read.query(query.toString()).then(async ({ rows: spaces }) => {
            if (options.withMedia || options.withUser || options.withRatings) {
                const mediaIds: string[] = [];
                const userIds: string[] = [];
                const spaceResultIds: string[] = [];
                const spaceDetailsPromises: Promise<any>[] = [];

                spaces.forEach((space) => {
                    if (options.withMedia && space.mediaIds) {
                        mediaIds.push(...space.mediaIds.split(','));
                    }
                    if (options.withUser) {
                        userIds.push(space.fromUserId);
                    }
                    if (options.withRatings) {
                        spaceResultIds.push(space.id);
                    }
                });
                // NOTE: The media db was replaced by moment.medias JSONB
                spaceDetailsPromises.push(Promise.resolve(null));
                spaceDetailsPromises.push(options.withUser ? findUsers({ ids: userIds }) : Promise.resolve(null));
                spaceDetailsPromises.push(options.withRatings ? getRatings('space', spaceResultIds) : Promise.resolve(null));

                const [media, users, ratings] = await Promise.all(spaceDetailsPromises);

                const spacesMedia = getSpacesToMediaAndUsersAndRatings(spaces, media, users, ratings);

                return Promise.all(spacesMedia.signingPromises).then((signedUrlResponses) => ({
                    spaces: spacesMedia.mappedSpaces,
                    media: signedUrlResponses.reduce((prev: any, curr: any) => ({ ...curr, ...prev }), {}),
                    users: spacesMedia.matchingUsers,
                }));
            }

            return {
                spaces,
                media: {},
                users: {},
            };
        });
    }

    createSpace(params: ICreateSpaceParams) {
        const region = countryReverseGeo.get_country(params.latitude, params.longitude);
        const notificationMsg = params.notificationMsg
            ? `${sanitizeNotificationMsg(params.notificationMsg).substring(0, maxNotificationMsgLength)}`
            : `${sanitizeNotificationMsg(params.message).substring(0, maxNotificationMsgLength)}`;

        // TODO: Support creating multiple
        // eslint-disable-next-line no-param-reassign
        params.media = params.media
            ? params.media.map((media, index): ICreateMediaParams => ({
                ...media,
                fromUserId: params.fromUserId,
                altText: `${notificationMsg} ${index}`,
            }))
            : undefined;

        const mediaPromise: Promise<string | undefined> = params.media
            ? this.mediaStore.create(params.media[0]).then((mediaIds) => mediaIds.toString()).catch((err) => {
                console.log(err);
                return '[]';
            })
            : Promise.resolve(undefined);

        const isTextMature = isTextUnsafe([notificationMsg, params.message, params.hashTags || '']);

        return mediaPromise.then((mediaIds: string | undefined) => {
            const radius = params.radius || DEFAULT_RADIUS_MEDIUM;
            const sanitizedParams: Partial<ICreateSpaceParams> = {
                addressReadable: params.addressReadable || '',
                areaType: params.areaType || 'spaces',
                category: params.category || 'uncategorized',
                expiresAt: params.expiresAt,
                fromUserId: params.fromUserId,
                requestedByUserId: params.requestedByUserId,
                locale: params.locale,
                isPublic: isTextMature ? false : !!params.isPublic, // NOTE: For now make this content private to reduce public, mature content
                isClaimPending: params.isClaimPending || false,
                isMatureContent: isTextMature || !!params.isMatureContent,
                message: params.message,
                notificationMsg,
                mediaIds: mediaIds || params.mediaIds || '',
                mentionsIds: params.mentionsIds || '',
                hashTags: params.hashTags || '',
                maxViews: params.maxViews || 0,
                maxProximity: params.maxProximity,
                latitude: params.latitude,
                longitude: params.longitude,
                radius,
                region: region.code,
                polygonCoords: params.polygonCoords ? JSON.stringify(params.polygonCoords) : JSON.stringify([]),
                featuredIncentiveKey: params.featuredIncentiveKey,
                featuredIncentiveValue: params.featuredIncentiveValue,
                featuredIncentiveRewardKey: params.featuredIncentiveRewardKey,
                featuredIncentiveRewardValue: params.featuredIncentiveRewardValue,
                featuredIncentiveCurrencyId: params.featuredIncentiveCurrencyId,
                phoneNumber: params.phoneNumber,
                websiteUrl: params.websiteUrl,
                menuUrl: params.menuUrl,
                orderUrl: params.orderUrl,
                reservationUrl: params.reservationUrl,
                businessTransactionId: params.businessTransactionId,
                businessTransactionName: params.businessTransactionName,
                isPointOfInterest: params.isPointOfInterest,
                addressStreetAddress: params.addressStreetAddress,
                addressRegion: params.addressRegion,
                addressLocality: params.addressLocality,
                postalCode: params.postalCode,
                priceRange: params.priceRange,
                // eslint-disable-next-line max-len
                geom: knexBuilder.raw(`ST_SetSRID(ST_Buffer(ST_MakePoint(${params.longitude}, ${params.latitude})::geography, ${radius})::geometry, 4326)`),
            };

            if (params.medias) {
                (sanitizedParams as any).medias = JSON.stringify(params.medias);
            }

            if (params.happyHours) {
                sanitizedParams.happyHours = JSON.stringify(params.happyHours);
            }

            if (params.openingHours) {
                sanitizedParams.openingHours = JSON.stringify(params.openingHours);
            }

            if (params.thirdPartyRatings) {
                sanitizedParams.thirdPartyRatings = params.thirdPartyRatings ? JSON.stringify(params.thirdPartyRatings) : JSON.stringify({});
            }

            if (params.interestsKeys) {
                sanitizedParams.interestsKeys = JSON.stringify(params.interestsKeys) as any;
            } else if (Content.interestsMap[`forms.editMoment.categories.${params.category}`]) {
                // Set a default interests where ever valid
                const interests = [Content.interestsMap[`forms.editMoment.categories.${params.category}`]];
                sanitizedParams.interestsKeys = JSON.stringify(interests) as any;
            }

            const queryString = knexBuilder.insert(sanitizedParams)
                .into(SPACES_TABLE_NAME)
                .returning('*')
                .toString();

            return this.db.write.query(queryString).then((response) => response.rows);
        });
    }

    updateSpace(id: string, params: any = {}) {
        // TODO: Support creating multiple
        // eslint-disable-next-line no-param-reassign
        params.media = params.media
            ? params.media.map((media, index): ICreateMediaParams => ({
                ...media,
                fromUserId: params.fromUserId,
                altText: `${params.notificationMsg} ${index}`,
            }))
            : undefined;

        const mediaPromise: Promise<string | undefined> = params.media
            ? this.mediaStore.create(params.media[0]).then((mediaIds) => mediaIds.toString()).catch((err) => {
                console.log(err);
                return '[]';
            })
            : Promise.resolve(undefined);

        return mediaPromise.then((mediaIds: string | undefined) => {
            const isTextMature = isTextUnsafe([params.notificationMsg, params.message, params.hashTags || '']);

            const sanitizedParams: Partial<ICreateSpaceParams> = {
                requestedByUserId: params.requestedByUserId,
                addressReadable: params.addressReadable,
                notificationMsg: params.notificationMsg,
                message: params.message,
                category: params.category,
                isMatureContent: params.isMatureContent || isTextMature ? true : undefined,
                isClaimPending: params.isClaimPending,
                isPublic: params.isMatureContent === true ? true : undefined, // NOTE: For now make this content private to reduce public, mature content
                featuredIncentiveKey: params.featuredIncentiveKey,
                featuredIncentiveValue: params.featuredIncentiveValue,
                featuredIncentiveRewardKey: params.featuredIncentiveRewardKey,
                featuredIncentiveRewardValue: params.featuredIncentiveRewardValue,
                incentiveCurrencyId: params.incentiveCurrencyId,
                mediaIds: mediaIds || params.mediaIds || undefined,
                phoneNumber: params.phoneNumber,
                websiteUrl: params.websiteUrl,
                menuUrl: params.menuUrl,
                orderUrl: params.orderUrl,
                reservationUrl: params.reservationUrl,
                businessTransactionId: params.businessTransactionId,
                businessTransactionName: params.businessTransactionName,
                isPointOfInterest: params.isPointOfInterest,
                addressStreetAddress: params.addressStreetAddress,
                addressRegion: params.addressRegion,
                addressLocality: params.addressLocality,
                postalCode: params.postalCode,
                priceRange: params.priceRange,
            };

            if (params.medias) {
                (sanitizedParams as any).medias = JSON.stringify(params.medias);
            }

            if (params.thirdPartyRatings) {
                sanitizedParams.thirdPartyRatings = JSON.stringify(params.thirdPartyRatings);
            }

            if (params.openingHours) {
                sanitizedParams.openingHours = JSON.stringify(params.openingHours);
            }

            if (params.interestsKeys) {
                sanitizedParams.interestsKeys = JSON.stringify(params.interestsKeys) as any;
            }

            (sanitizedParams as any).updatedAt = new Date();

            const queryString = knexBuilder.update(sanitizedParams)
                .into(SPACES_TABLE_NAME)
                .where({ id, fromUserId: params.fromUserId }) // users can only update their own spaces
                .returning('*')
                .toString();

            return this.db.write.query(queryString).then((response) => response.rows);
        });
    }

    reassign(fromUserId: string, toUserId: string) {
        const queryString = knexBuilder.update({
            id: toUserId,
        })
            .from(SPACES_TABLE_NAME)
            .where('fromUserId', fromUserId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    delete(fromUserId: string) {
        const queryString = knexBuilder.delete()
            .from(SPACES_TABLE_NAME)
            .where('fromUserId', fromUserId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    deleteSpaces(params: IDeleteAreasParams) {
        // TODO: RSERV-52 | Consider archiving only, and delete associated reactions from reactions-service
        const queryString = knexBuilder.delete()
            .from(SPACES_TABLE_NAME)
            .where('fromUserId', params.fromUserId)
            .whereIn('id', params.ids)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
