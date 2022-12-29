import KnexBuilder, { Knex } from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { isTextUnsafe } from '../utilities/contentSafety';
import UsersStore from './UsersStore';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const THOUGHTS_TABLE_NAME = 'main.thoughts';

const maxMessageLength = 300;
export interface ICreateThoughtParams {
    parentId?: string;
    areaType?: string;
    category?: string;
    expiresAt?: any;
    fromUserId: number;
    locale: string;
    isPublic?: boolean;
    isMatureContent?: boolean;
    isRepost?: boolean;
    message: string;
    notificationMsg?: string;
    mediaIds?: string;
    media?: any;
    mentionsIds?: string;
    hashTags?: string;
    maxViews?: number;
}

interface IDeleteThoughtsParams {
    fromUserId: string;
    ids: string[];
}

export default class ThoughtsStore {
    db: IConnection;

    usersStore: UsersStore;

    constructor(dbConnection, usersStore) {
        this.db = dbConnection;
        this.usersStore = usersStore;
    }

    // Combine with search to avoid getting count out of sync
    countRecords(params, fromUserIds) {
        let queryString = knexBuilder
            .from(THOUGHTS_TABLE_NAME)
            .count('*');

        if (params.filterBy === 'fromUserIds') {
            queryString = queryString.andWhere((builder) => { // eslint-disable-line func-names
                builder.whereIn('fromUserId', fromUserIds);
            });
        } else if (params.query != undefined) { // eslint-disable-line eqeqeq
            queryString = queryString.andWhere({
                [params.filterBy]: params.query || '',
            });
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    search(conditions: any = {}, returning, fromUserIds = [], overrides?: any, includePublicResults = true) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : '*')
            .from(THOUGHTS_TABLE_NAME)
            // TODO: Determine a better way to select thoughts that are most relevant to the user
            // .orderBy(`${THOUGHTS_TABLE_NAME}.updatedAt`) // Sorting by updatedAt is very expensive/slow
            .where({
                isMatureContent: false, // content that has been blocked
            });

        if (conditions.filterBy && conditions.query != undefined) { // eslint-disable-line eqeqeq
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

        return this.db.read.query(queryString).then((response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            return configuredResponse;
        });
    }

    find(thoughtIds, filters, options: any = {}) {
        // hard limit to prevent overloading client
        const restrictedLimit = (filters.limit) > 1000 ? 1000 : filters.limit;
        const orderBy = filters.orderBy || `${THOUGHTS_TABLE_NAME}.createdAt`;
        const order = filters.order || 'DESC';

        let query = knexBuilder
            .from(THOUGHTS_TABLE_NAME)
            .orderBy(orderBy, order)
            .offset(filters.offset || 0)
            .whereIn('id', thoughtIds || [])
            .orWhere('isPublic', true)
            .limit(restrictedLimit);

        if (options?.shouldHideMatureContent) {
            query = query.where({ isMatureContent: false });
        }

        return this.db.read.query(query.toString()).then(async ({ rows: thoughts }) => {
            if (options.withUser) {
                const userIds: string[] = [];
                const thoughtDetailsPromises: Promise<any>[] = [];
                const matchingUsers: any = {};

                thoughts.forEach((thought) => {
                    if (options.withUser) {
                        userIds.push(thought.fromUserId);
                    }
                });
                // TODO: Try fetching from redis/cache first, before fetching remaining media from DB
                thoughtDetailsPromises.push(options.withUser
                    ? this.usersStore.findUsers({ ids: userIds })
                    : Promise.resolve(null));

                const [users] = await Promise.all(thoughtDetailsPromises);

                // TODO: Optimize
                const mappedThoughts = thoughts.map((thought) => {
                    const modifiedThought = thought;
                    modifiedThought.user = {};

                    // USER
                    if (options.withUser) {
                        const matchingUser = users.find((user) => user.id === modifiedThought.fromUserId);
                        if (matchingUser) {
                            matchingUsers[matchingUser.id] = matchingUser;
                            modifiedThought.fromUserName = matchingUser.userName;
                            modifiedThought.fromUserFirstName = matchingUser.firstName;
                            modifiedThought.fromUserLastName = matchingUser.lastName;
                            modifiedThought.fromUserMedia = matchingUser.media;
                        }
                    }

                    return modifiedThought;
                });

                return {
                    thoughts: mappedThoughts,
                    users: matchingUsers,
                };
            }

            return {
                thoughts,
                media: {},
                users: {},
            };
        });
    }

    create(params: ICreateThoughtParams) {
        // TODO: Support creating multiple
        const isTextMature = isTextUnsafe([params.message, params.hashTags || '']);

        const sanitizedParams = {
            category: params.category || 'uncategorized',
            expiresAt: params.expiresAt,
            fromUserId: params.fromUserId,
            locale: params.locale,
            isPublic: isTextMature ? false : !!params.isPublic, // NOTE: For now make this content private to reduce public, mature content
            isMatureContent: isTextMature || !!params.isMatureContent,
            isRepost: !!params.isRepost,
            message: params.message,
            mentionsIds: params.mentionsIds || '',
            parentId: params.parentId,
            hashTags: params.hashTags || '',
            maxViews: params.maxViews || 0,
        };

        const queryString = knexBuilder.insert(sanitizedParams)
            .into(THOUGHTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, isMatureContent: boolean) {
        const queryString = knexBuilder.update({
            isMatureContent,
            isPublic: !isMatureContent, // NOTE: For now make this content private to reduce public, mature content
        })
            .into(THOUGHTS_TABLE_NAME)
            .where({ id })
            .returning(['id'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    delete(fromUserId: string) {
        const queryString = knexBuilder.delete()
            .from(THOUGHTS_TABLE_NAME)
            .where('fromUserId', fromUserId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    deleteThoughts(params: IDeleteThoughtsParams) {
        // TODO: RSERV-52 | Consider archiving only, and delete associated reactions from reactions-service
        const queryString = knexBuilder.delete()
            .from(THOUGHTS_TABLE_NAME)
            .where('fromUserId', params.fromUserId)
            .whereIn('id', params.ids)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
