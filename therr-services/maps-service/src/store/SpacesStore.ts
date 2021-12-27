import KnexBuilder, { Knex } from 'knex';
import * as countryGeo from 'country-reverse-geocoding';
import { Location } from 'therr-js-utilities/constants';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { storage } from '../api/aws';
import MediaStore, { ICreateMediaParams } from './MediaStore';
import getBucket from '../utilities/getBucket';
import findUsers from '../utilities/findUsers';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACES_TABLE_NAME = 'main.spaces';

const countryReverseGeo = countryGeo.country_reverse_geocoding();
const maxNotificationMsgLength = 100;
export interface ICreateSpaceParams {
    areaType?: string;
    category?: string;
    expiresAt?: any;
    fromUserId: number;
    locale: string;
    isPublic?: boolean;
    message: string;
    notificationMsg?: string;
    mediaIds?: string;
    media?: ICreateMediaParams[];
    mentionsIds?: string;
    hashTags?: string;
    maxViews?: number;
    maxProximity?: number;
    latitude: number;
    longitude: number;
    radius?: string;
    polygonCoords?: string;
}

interface IDeleteSpacesParams {
    fromUserId: string;
    ids: string[];
}

const sanitizeNotificationMsg = (message = '') => message.replace(/\r?\n+|\r+/gm, ' ');

export default class SpacesStore {
    db: IConnection;

    mediaStore: MediaStore;

    constructor(dbConnection, mediaStore) {
        this.db = dbConnection;
        this.mediaStore = mediaStore;
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

    searchSpaces(conditions: any = {}, returning, fromUserIds = [], overrides?: any, includePublicResults = true) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let proximityMax = overrides?.distanceOverride || Location.AREA_PROXIMITY_METERS;
        if ((conditions.filterBy && conditions.filterBy === 'distance') && conditions.query) {
            proximityMax = conditions.query;
        }
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : '*')
            .from(SPACES_TABLE_NAME)
            // TODO: Determine a better way to select spaces that are most relevant to the user
            // .orderBy(`${SPACES_TABLE_NAME}.updatedAt`) // Sorting by updatedAt is very expensive/slow
            // NOTE: Cast to a geography type to search distance within n meters
            .where(knexBuilder.raw(`ST_DWithin(geom, ST_MakePoint(${conditions.longitude}, ${conditions.latitude})::geography, ${proximityMax})`)) // eslint-disable-line quotes, max-len
            .andWhere({
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
                queryString = queryString.andWandWhere(conditions.filterBy, operator, query);
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

    findSpaces(spaceIds, filters, options: any = {}) {
        // hard limit to prevent overloading client
        const restrictedLimit = (filters.limit) > 1000 ? 1000 : filters.limit;
        const orderBy = filters.orderBy || `${SPACES_TABLE_NAME}.updatedAt`;
        const order = filters.order || 'DESC';

        const query = knexBuilder
            .from(SPACES_TABLE_NAME)
            .orderBy(orderBy, order)
            .whereIn('id', spaceIds || [])
            .limit(restrictedLimit);

        return this.db.read.query(query.toString()).then(async ({ rows: spaces }) => {
            if (options.withMedia || options.withUser) {
                const mediaIds: string[] = [];
                const userIds: number[] = [];
                const signingPromises: any = [];
                const imageExpireTime = Date.now() + 60 * 60 * 1000; // 60 minutes
                const spaceDetailsPromises: Promise<any>[] = [];
                const matchingUsers: any = {};

                spaces.forEach((space) => {
                    if (options.withMedia && space.mediaIds) {
                        mediaIds.push(...space.mediaIds.split(','));
                    }
                    if (options.withUser) {
                        userIds.push(space.fromUserId);
                    }
                });
                // TODO: Try fetching from redis/cache first, before fetching remaining media from DB
                spaceDetailsPromises.push(options.withMedia ? this.mediaStore.get(mediaIds) : Promise.resolve(null));
                spaceDetailsPromises.push(options.withUser ? findUsers({ ids: userIds }) : Promise.resolve(null));

                const [media, users] = await Promise.all(spaceDetailsPromises);

                // TODO: Optimize
                const mappedSpaces = spaces.map((space) => {
                    const modifiedSpace = space;
                    modifiedSpace.media = [];
                    modifiedSpace.user = {};

                    // MEDIA
                    if (options.withMedia && space.mediaIds) {
                        const ids = modifiedSpace.mediaIds.split(',');
                        modifiedSpace.media = media.filter((m) => {
                            if (ids.includes(m.id)) {
                                const bucket = getBucket(m.type);
                                if (bucket) {
                                    // TODO: Consider alternatives to cache these urls (per user) and their expire time
                                    const promise = storage
                                        .bucket(bucket)
                                        .file(m.path)
                                        .getSignedUrl({
                                            version: 'v4',
                                            action: 'read',
                                            expires: imageExpireTime,
                                        }).then((urls) => ({
                                            [m.id]: urls[0],
                                        }));
                                    signingPromises.push(promise);
                                } else {
                                    console.log('MometsStore.ts: bucket is undefined');
                                }

                                return true;
                            }

                            return false;
                        });
                    }

                    // USER
                    if (options.withUser) {
                        const matchingUser = users.find((user) => user.id === modifiedSpace.fromUserId);
                        if (matchingUser) {
                            matchingUsers[matchingUser.id] = matchingUser;
                            modifiedSpace.fromUserName = matchingUser.userName;
                            modifiedSpace.fromUserFirstName = matchingUser.firstName;
                            modifiedSpace.fromUserLastName = matchingUser.lastName;
                        }
                    }

                    return modifiedSpace;
                });

                return Promise.all(signingPromises).then((signedUrlResponses) => ({
                    spaces: mappedSpaces,
                    media: signedUrlResponses.reduce((prev: any, curr: any) => ({ ...curr, ...prev }), {}),
                    users: matchingUsers,
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
            ? this.mediaStore.create(params.media[0]).then((mediaIds) => mediaIds.toString())
            : Promise.resolve(undefined);

        return mediaPromise.then((mediaIds: string | undefined) => {
            const sanitizedParams = {
                areaType: params.areaType || 'spaces',
                category: params.category || 'uncategorized',
                expiresAt: params.expiresAt,
                fromUserId: params.fromUserId,
                locale: params.locale,
                isPublic: !!params.isPublic,
                message: params.message,
                notificationMsg,
                mediaIds: mediaIds || params.mediaIds || '',
                mentionsIds: params.mentionsIds || '',
                hashTags: params.hashTags || '',
                maxViews: params.maxViews || 0,
                maxProximity: params.maxProximity,
                latitude: params.latitude,
                longitude: params.longitude,
                radius: params.radius,
                region: region.code,
                polygonCoords: params.polygonCoords ? JSON.stringify(params.polygonCoords) : JSON.stringify([]),
                // eslint-disable-next-line max-len
                geom: knexBuilder.raw(`ST_SetSRID(ST_Buffer(ST_MakePoint(${params.longitude}, ${params.latitude})::geography, ${params.radius})::geometry, 4326)`),
            };

            const queryString = knexBuilder.insert(sanitizedParams)
                .into(SPACES_TABLE_NAME)
                .returning('*')
                .toString();

            return this.db.write.query(queryString).then((response) => response.rows);
        });
    }

    deleteSpaces(params: IDeleteSpacesParams) {
        // TODO: RSERV-52 | Consider archiving only, and delete associated reactions from reactions-service
        const queryString = knexBuilder.delete()
            .from(SPACES_TABLE_NAME)
            .where('fromUserId', params.fromUserId)
            .whereIn('id', params.ids)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
