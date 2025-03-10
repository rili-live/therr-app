import KnexBuilder, { Knex } from 'knex';
import * as countryGeo from 'country-reverse-geocoding';
import { Categories, Content, Location } from 'therr-js-utilities/constants';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { IConnection } from './connection';
import { storage } from '../api/aws';
import MediaStore, { ICreateMediaParams } from './MediaStore';
import getBucket from '../utilities/getBucket';
import findUsers from '../utilities/findUsers';
import { isTextUnsafe } from '../utilities/contentSafety';
import { ICreateAreaParams, IDeleteAreasParams } from './common/models';
import { sanitizeNotificationMsg } from './common/utils';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const MOMENTS_TABLE_NAME = 'main.moments';

const countryReverseGeo = countryGeo.country_reverse_geocoding();
const maxNotificationMsgLength = 100;

interface INearbySpacesSnapshot {
    id: string;
    title: string;
}

export interface ICreateMomentParams extends ICreateAreaParams {
    isDraft?: boolean;
    nearbySpacesSnapshot?: INearbySpacesSnapshot[];
    spaceId?: string;
}

// TODO: This needs more security logic to ensure the requesting user has permissions to view
// non-public images
const getMomentsToMediaAndUsers = (moments: any[], media?: any[], users?: any[]) => {
    const imageExpireTime = Date.now() + 60 * 60 * 1000; // 60 minutes
    const matchingUsers: any = {};
    const signingPromises: any = [];

    // TODO: Optimize
    const mappedMoments = moments.map((moment) => {
        const modifiedMoment = moment;
        modifiedMoment.media = [];
        modifiedMoment.user = {};

        // MEDIA
        if (moment.medias?.length) {
            modifiedMoment.media = moment.medias.filter((m) => {
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
                        console.log('MomentsStore.ts: bucket is undefined');
                    }

                    return true;
                }

                return false;
            });
        }

        // USER
        if (users) {
            const matchingUser = users.find((user) => user.id === modifiedMoment.fromUserId);
            if (matchingUser) {
                matchingUsers[matchingUser.id] = matchingUser;
                modifiedMoment.fromUserName = matchingUser.userName;
                modifiedMoment.fromUserFirstName = matchingUser.firstName;
                modifiedMoment.fromUserLastName = matchingUser.lastName;
                modifiedMoment.fromUserMedia = matchingUser.media;
                modifiedMoment.fromUserIsSuperUser = matchingUser.isSuperUser;
            }
        }

        return modifiedMoment;
    });

    return {
        matchingUsers,
        mappedMoments,
        signingPromises,
    };
};

export default class MomentsStore {
    db: IConnection;

    mediaStore: MediaStore;

    constructor(dbConnection, mediaStore) {
        this.db = dbConnection;
        this.mediaStore = mediaStore;
    }

    /**
     * This is used to check for duplicates before creating a new moments
     */
    get(filters) {
        const notificationMsg = filters.notificationMsg
            ? `${sanitizeNotificationMsg(filters.notificationMsg).substring(0, maxNotificationMsgLength)}`
            : `${sanitizeNotificationMsg(filters.message).substring(0, maxNotificationMsgLength)}`;
        // hard limit to prevent overloading client
        const query = knexBuilder
            .from(MOMENTS_TABLE_NAME)
            .where({
                fromUserId: filters.fromUserId,
                message: filters.message,
                notificationMsg,
            });

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    // Combine with search to avoid getting count out of sync
    countRecords(params, fromUserIds) {
        let proximityMax = Location.AREA_PROXIMITY_METERS;
        if ((params.filterBy && params.filterBy === 'distance') && params.query) {
            proximityMax = params.query;
        }
        let queryString = knexBuilder
            .from(MOMENTS_TABLE_NAME)
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
    searchMoments(internalReqHeaders: InternalConfigHeaders, conditions: any = {}, returning, fromUserIds = [], overrides?: any, includePublicResults = true) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let proximityMax = overrides?.distanceOverride || Location.AREA_PROXIMITY_METERS;
        if ((conditions.filterBy && conditions.filterBy === 'distance') && conditions.query) {
            proximityMax = conditions.query;
        }
        let returningMod = (returning && returning.length) ? returning : '*';
        if (!overrides?.isRequestAuthorized) {
            // Public listing/summary view
            returningMod = [
                'id',
                'areaType',
                'locale',
                'category',
                'notificationMsg',
                'medias',
                'mediaIds',
                'hashTags',
                'latitude',
                'longitude',
                'radius',
                'isMatureContent',
                'isModeratorApproved',
                'createdAt',
                'updatedAt',
                'interestsKeys',
                'spaceId',
            ];
        }
        let queryString: any = knexBuilder
            .select(returningMod)
            .from(MOMENTS_TABLE_NAME)
            // TODO: Determine a better way to select moments that are most relevant to the user
            // .orderBy(`${MOMENTS_TABLE_NAME}.updatedAt`) // Sorting by updatedAt is very expensive/slow
            // NOTE: Cast to a geography type to search distance within n meters
            .where(knexBuilder.raw(`ST_DWithin(geom, ST_MakePoint(${conditions.longitude}, ${conditions.latitude})::geography, ${proximityMax})`)) // eslint-disable-line quotes, max-len
            .andWhere({
                // TODO: Check user settings to determine if content should be included
                isMatureContent: false, // content that has been blocked
            });

        if ((conditions.filterBy && conditions.filterBy !== 'distance') && conditions.query != undefined) { // eslint-disable-line eqeqeq
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;

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

        return this.db.read.query(queryString).then(async (response) => {
            const moments = formatSQLJoinAsJSON(response.rows, []);

            if (overrides.withUser) {
                const userIds: string[] = [];
                const momentDetailsPromises: Promise<any>[] = [];

                moments.forEach((moment) => {
                    if (overrides.withUser) {
                        userIds.push(moment.fromUserId);
                    }
                });
                momentDetailsPromises.push(overrides.withUser ? findUsers({ ids: userIds }, internalReqHeaders) : Promise.resolve(null));

                const [users] = await Promise.all(momentDetailsPromises);

                const momentsMediaUsers = getMomentsToMediaAndUsers(moments, [], users);

                return Promise.all(momentsMediaUsers.signingPromises).then(() => momentsMediaUsers.mappedMoments);
            }

            return moments;
        });
    }

    // eslint-disable-next-line default-param-last
    searchMyMoments(
        internalReqHeaders: InternalConfigHeaders,
        userId: string,
        requirements: any = {},
        conditions: any = {},
        returning: string | any[] = '*',
        overrides: any = {},
    ) {
        const modifiedConditions: any = {
            ...conditions,
            fromUserId: userId,
        };
        const offset = modifiedConditions.pagination.itemsPerPage * (modifiedConditions.pagination.pageNumber - 1);
        const limit = modifiedConditions.pagination.itemsPerPage;
        let proximityMax = overrides?.distanceOverride || Location.AREA_PROXIMITY_METERS;
        if ((modifiedConditions.filterBy && modifiedConditions.filterBy === 'distance') && modifiedConditions.query) {
            proximityMax = modifiedConditions.query;
        }
        let queryString: any = knexBuilder
            .select(returning)
            .from(MOMENTS_TABLE_NAME);

        if (modifiedConditions.longitude && modifiedConditions.latitude) {
            // NOTE // Sorting by updatedAt is very expensive/slow
            // NOTE: Cast to a geography type to search distance within n meters
            queryString = queryString.where(knexBuilder.raw(`ST_DWithin(geom, ST_MakePoint(${modifiedConditions.longitude}, ${modifiedConditions.latitude})::geography, ${proximityMax})`)) // eslint-disable-line max-len
                .andWhere(requirements); // eslint-disable-line quotes, max-len
        } else {
            queryString = queryString.where(requirements); // eslint-disable-line quotes, max-len
        }

        queryString = queryString
            .limit(limit || 50)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then(async (response) => {
            const moments = formatSQLJoinAsJSON(response.rows, []);

            if (overrides.withMedia || overrides.withUsers) {
                const mediaIds: string[] = [];
                const userIds: string[] = [];
                const momentDetailsPromises: Promise<any>[] = [];

                moments.forEach((moment) => {
                    if (overrides.withMedia && moment.mediaIds) {
                        mediaIds.push(...moment.mediaIds.split(','));
                    }
                    if (overrides.withUser) {
                        userIds.push(moment.fromUserId);
                    }
                });
                // NOTE: The media db was replaced by moment.medias JSONB
                momentDetailsPromises.push(Promise.resolve(null));
                momentDetailsPromises.push(overrides.withUser ? findUsers({ ids: userIds }, internalReqHeaders) : Promise.resolve(null));

                const [media, users] = await Promise.all(momentDetailsPromises);

                const momentsMediaUsers = getMomentsToMediaAndUsers(moments, media, users);

                return Promise.all(momentsMediaUsers.signingPromises).then((signedUrlResponses) => ({
                    moments: momentsMediaUsers.mappedMoments,
                    media: signedUrlResponses.reduce((prev: any, curr: any) => ({ ...curr, ...prev }), {}),
                    users: momentsMediaUsers.matchingUsers,
                }));
            }

            return {
                moments,
                media: {},
            };
        });
    }

    findSpaceMoments(internalReqHeaders: InternalConfigHeaders, spaceIds: string[], options = {
        withMedia: false,
        withUser: false,
    }, limit = 10, offset = 0, returning = '*') {
        const now = new Date();
        const query = knexBuilder
            .from(MOMENTS_TABLE_NAME)
            .returning(returning)
            .limit(limit)
            .offset(offset)
            .whereIn('spaceId', spaceIds)
            .where({
                isPublic: true, // TODO: Show activated posts from friends/connections
            })
            .where('createdAt', '>', new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000));

        return this.db.read.query(query.toString()).then(async ({ rows: moments }) => {
            if (options.withMedia || options.withUser) {
                const mediaIds: string[] = [];
                const userIds: string[] = [];
                const momentDetailsPromises: Promise<any>[] = [];

                moments.forEach((moment) => {
                    if (options.withMedia && moment.mediaIds) {
                        mediaIds.push(...moment.mediaIds.split(','));
                    }
                    if (options.withUser) {
                        userIds.push(moment.fromUserId);
                    }
                });
                // NOTE: The media db was replaced by moment.medias JSONB
                momentDetailsPromises.push(Promise.resolve(null));
                momentDetailsPromises.push(options.withUser ? findUsers({ ids: userIds }, internalReqHeaders) : Promise.resolve(null));

                const [media, users] = await Promise.all(momentDetailsPromises);

                const momentsMediaUsers = getMomentsToMediaAndUsers(moments, media, users);

                return Promise.all(momentsMediaUsers.signingPromises).then((signedUrlResponses) => ({
                    moments: momentsMediaUsers.mappedMoments,
                    media: signedUrlResponses.reduce((prev: any, curr: any) => ({ ...curr, ...prev }), {}),
                    users: momentsMediaUsers.matchingUsers,
                }));
            }

            return {
                moments,
                media: {},
                users: {},
            };
        });
    }

    findMoments(internalReqHeaders: InternalConfigHeaders, momentIds, filters, options: any = {}) {
        // hard limit to prevent overloading client
        let restrictedLimit = filters?.limit || 1000;
        restrictedLimit = restrictedLimit > 1000 ? 1000 : restrictedLimit;
        const orderBy = filters.orderBy || `${MOMENTS_TABLE_NAME}.updatedAt`;
        const order = filters.order || 'DESC';

        let query = knexBuilder
            .from(MOMENTS_TABLE_NAME)
            .orderBy(orderBy, order)
            .where('createdAt', '<', filters.before || new Date(Date.now() + 24 * 60 * 60 * 1000))
            .whereIn('id', momentIds || [])
            .limit(restrictedLimit);

        if (filters.isDraft != null) {
            query = query.andWhere({
                isDraft: filters.isDraft,
            });
        }

        if (filters.authorId) {
            query = query.andWhere('fromUserId', filters.authorId);
        }

        if (filters?.fromUserId) {
            query = query.where({ fromUserId: filters.fromUserId });
        }

        if (options?.shouldHideMatureContent) {
            query = query.where({ isMatureContent: false });
        }

        return this.db.read.query(query.toString()).then(async ({ rows: moments }) => {
            if (options.withMedia || options.withUser) {
                const mediaIds: string[] = [];
                const userIds: string[] = [];
                const momentDetailsPromises: Promise<any>[] = [];

                moments.forEach((moment) => {
                    if (options.withMedia && moment.mediaIds) {
                        mediaIds.push(...moment.mediaIds.split(','));
                    }
                    if (options.withUser) {
                        userIds.push(moment.fromUserId);
                    }
                });
                // NOTE: The media db was replaced by moment.medias JSONB
                momentDetailsPromises.push(Promise.resolve(null));
                momentDetailsPromises.push(options.withUser ? findUsers({ ids: userIds }, internalReqHeaders) : Promise.resolve(null));

                const [media, users] = await Promise.all(momentDetailsPromises);

                const momentsMediaUsers = getMomentsToMediaAndUsers(moments, media, users);

                return Promise.all(momentsMediaUsers.signingPromises).then((signedUrlResponses) => ({
                    moments: momentsMediaUsers.mappedMoments,
                    media: signedUrlResponses.reduce((prev: any, curr: any) => ({ ...curr, ...prev }), {}),
                    users: momentsMediaUsers.matchingUsers,
                }));
            }

            return {
                moments,
                media: {},
                users: {},
            };
        });
    }

    createMoment(params: ICreateMomentParams) {
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
            const sanitizedParams: Partial<ICreateMomentParams> = {
                areaType: params.areaType || 'moments',
                category: params.category || 'uncategorized',
                createdAt: params.createdAt || undefined, // TODO: make more secure (only for social sync)
                expiresAt: params.expiresAt,
                fromUserId: params.fromUserId,
                spaceId: params.spaceId,
                locale: params.locale,
                isPublic: isTextMature ? false : !!params.isPublic, // NOTE: For now make this content private to reduce public, mature content
                isDraft: !!params.isDraft,
                isMatureContent: isTextMature || !!params.isMatureContent,
                message: params.message,
                notificationMsg: notificationMsg.replace(/#/g, ''),
                mediaIds: mediaIds || params.mediaIds || '',
                mentionsIds: params.mentionsIds || '',
                hashTags: params.hashTags || '',
                maxViews: params.maxViews || 0,
                maxProximity: params.maxProximity,
                // nearbySpacesSnapshot is used for drafted moments so we can get nearby spaces without requiring location
                // to edit a drafted moment
                latitude: params.latitude,
                longitude: params.longitude,
                radius: params.radius,
                region: region?.code,
                polygonCoords: params.polygonCoords ? JSON.stringify(params.polygonCoords) : JSON.stringify([]),
                geom: knexBuilder.raw(`ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)`),
            };

            (sanitizedParams as any).nearbySpacesSnapshot = params.nearbySpacesSnapshot ? JSON.stringify(params.nearbySpacesSnapshot) : JSON.stringify([]);

            if (params.medias) {
                (sanitizedParams as any).medias = JSON.stringify(params.medias);
            }

            if (params.interestsKeys) {
                sanitizedParams.interestsKeys = JSON.stringify(params.interestsKeys) as any;
            } else if (Categories.MomentCategories.includes(params.category) && Categories.CategoryToInterestsMap[params.category]) {
                const interests = Categories.CategoryToInterestsMap[params.category];
                sanitizedParams.interestsKeys = JSON.stringify(interests) as any;
            } else if (Content.interestsMap[`forms.editMoment.categories.${params.category}`]) {
                // Set a default interests where ever valid
                const interests = [Content.interestsMap[`forms.editMoment.categories.${params.category}`]];
                sanitizedParams.interestsKeys = JSON.stringify(interests) as any;
            }

            const queryString = knexBuilder.insert(sanitizedParams)
                .into(MOMENTS_TABLE_NAME)
                .returning('*')
                .toString();

            return this.db.write.query(queryString).then((response) => response.rows);
        });
    }

    updateMoment(id: string, params: ICreateMomentParams) {
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
            const sanitizedParams: Partial<ICreateMomentParams> = {
                areaType: params.areaType || 'moments',
                category: params.category || 'uncategorized',
                expiresAt: params.expiresAt,
                fromUserId: params.fromUserId,
                spaceId: params.spaceId,
                locale: params.locale,
                isPublic: isTextMature ? false : !!params.isPublic, // NOTE: For now make this content private to reduce public, mature content
                isDraft: !!params.isDraft,
                isMatureContent: isTextMature || !!params.isMatureContent,
                message: params.message,
                notificationMsg,
                mediaIds: mediaIds || params.mediaIds || undefined,
                mentionsIds: params.mentionsIds || '',
                hashTags: params.hashTags || '',
                maxViews: params.maxViews || 0,
                maxProximity: params.maxProximity,
                // latitude: params.latitude,
                // longitude: params.longitude,
                radius: params.radius,
                region: region?.code,
                // polygonCoords: params.polygonCoords ? JSON.stringify(params.polygonCoords) : JSON.stringify([]),
                // geom: knexBuilder.raw(`ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)`),
            };

            (sanitizedParams as any).nearbySpacesSnapshot = params.nearbySpacesSnapshot ? JSON.stringify(params.nearbySpacesSnapshot) : undefined;

            if (params.medias) {
                (sanitizedParams as any).medias = JSON.stringify(params.medias);
            }

            if (params.interestsKeys) {
                sanitizedParams.interestsKeys = JSON.stringify(params.interestsKeys) as any;
            }

            (sanitizedParams as any).updatedAt = new Date();

            const queryString = knexBuilder.update(sanitizedParams)
                .into(MOMENTS_TABLE_NAME)
                .where({ id })
                .returning('*')
                .toString();

            return this.db.write.query(queryString).then((response) => response.rows);
        });
    }

    delete(fromUserId: string) {
        const queryString = knexBuilder.delete()
            .from(MOMENTS_TABLE_NAME)
            .where('fromUserId', fromUserId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    deleteMoments(params: IDeleteAreasParams) {
        // TODO: RSERV-52 | Consider archiving only, and delete associated reactions from reactions-service
        const queryString = knexBuilder.delete()
            .from(MOMENTS_TABLE_NAME)
            .where('fromUserId', params.fromUserId)
            .whereIn('id', params.ids)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
