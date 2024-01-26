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

    getRecentThoughts(limit = 1, returning = ['id']) {
        const queryString = knexBuilder.select(returning)
            .from(THOUGHTS_TABLE_NAME)
            .where('createdAt', '>', new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)) // 3 days
            .andWhere({
                isPublic: true,
                isMatureContent: false,
            })
            .limit(limit)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    // eslint-disable-next-line default-param-last
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

    /**
     * This is used to check for duplicates before creating a new thought
     */
    get(filters) {
        // hard limit to prevent overloading client
        let query = knexBuilder
            .from(THOUGHTS_TABLE_NAME)
            .where({
                fromUserId: filters.fromUserId,
                message: filters.message,
            });

        if (!filters.parentId) {
            query = query.whereNull('parentId');
        } else {
            query = query.where('parentId', filters.parentId);
        }

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    getById(thoughtId, filters, options: any = {}) {
        // hard limit to prevent overloading client
        let query = knexBuilder
            .from(THOUGHTS_TABLE_NAME)
            .where(`${THOUGHTS_TABLE_NAME}.id`, thoughtId);

        if (options.withReplies) {
            query = query
                .leftJoin(`${THOUGHTS_TABLE_NAME} as replies`, 'replies.parentId', `${THOUGHTS_TABLE_NAME}.id`)
                .columns([
                    `${THOUGHTS_TABLE_NAME}.*`,
                    'replies.id as replies[].id',
                    'replies.fromUserId as replies[].fromUserId',
                    'replies.parentId as replies[].parentId',
                    'replies.isPublic as replies[].isPublic',
                    'replies.isRepost as replies[].isRepost',
                    'replies.message as replies[].message',
                    'replies.mediaIds as replies[].mediaIds',
                    'replies.mentionsIds as replies[].mentionsIds',
                    'replies.hashTags as replies[].hashTags',
                    'replies.maxViews as replies[].maxViews',
                    'replies.isMatureContent as replies[].isMatureContent',
                    'replies.isModeratorApproved as replies[].isModeratorApproved',
                    'replies.isForSale as replies[].isForSale',
                    'replies.isHirable as replies[].isHirable',
                    'replies.isPromotional as replies[].isPromotional',
                    'replies.isExclusiveToGroups as replies[].isExclusiveToGroups',
                    'replies.category as replies[].category',
                    'replies.isScheduledAt as replies[].isScheduledAt',
                    'replies.createdAt as replies[].createdAt',
                    'replies.updatedAt as replies[].updatedAt',
                ]);
        }

        if (options?.shouldHideMatureContent) {
            query = query.where(`${THOUGHTS_TABLE_NAME}.isMatureContent`, false);
        }

        return this.db.read.query(query.toString()).then(async ({ rows }) => {
            const thoughts = formatSQLJoinAsJSON(rows, [{ propKey: 'replies', propId: 'id' }]);
            if (options.withUser) {
                const userIds: string[] = [];
                const thoughtDetailsPromises: Promise<any>[] = [];

                thoughts.forEach((thought) => {
                    userIds.push(thought.fromUserId);

                    if (options.withReplies) {
                        thought.replies.forEach((reply) => {
                            userIds.push(reply.fromUserId);
                        });
                    }
                });
                // TODO: Try fetching from redis/cache first, before fetching remaining media from DB
                thoughtDetailsPromises.push(options.withUser
                    ? this.usersStore.findUsers({ ids: userIds })
                    : Promise.resolve(null));

                const [users] = await Promise.all(thoughtDetailsPromises);
                const usersMap = (users || []).reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {});

                const mappedThoughts = thoughts.map((thought) => {
                    const modifiedThought = thought;

                    // USER
                    const matchingUser = usersMap[modifiedThought.fromUserId];
                    if (matchingUser) {
                        modifiedThought.user = matchingUser;
                        modifiedThought.fromUserName = matchingUser.userName;
                        modifiedThought.fromUserFirstName = matchingUser.firstName;
                        modifiedThought.fromUserLastName = matchingUser.lastName;
                        modifiedThought.fromUserMedia = matchingUser.media;

                        // Replies
                        if (options.withReplies) {
                            modifiedThought.replies = modifiedThought.replies.map((reply) => {
                                const modifiedReply = reply;
                                const matchingReplyUser = usersMap[modifiedReply.fromUserId];
                                if (matchingReplyUser) {
                                    modifiedReply.user = matchingReplyUser;
                                    modifiedReply.fromUserName = matchingReplyUser.userName;
                                    modifiedReply.fromUserFirstName = matchingReplyUser.firstName;
                                    modifiedReply.fromUserLastName = matchingReplyUser.lastName;
                                    modifiedReply.fromUserMedia = matchingReplyUser.media;
                                }

                                return modifiedReply;
                            });
                        }
                    }

                    return modifiedThought;
                });

                return {
                    thoughts: mappedThoughts,
                    users: usersMap,
                };
            }

            return {
                thoughts,
                media: {},
                users: {},
            };
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
            .where(`${THOUGHTS_TABLE_NAME}.createdAt`, '<', filters.before || new Date())
            .andWhere(`${THOUGHTS_TABLE_NAME}.parentId`, null)
            .limit(restrictedLimit);

        if (filters.authorId) {
            // TODO: Also return private posts if users are friends
            query = query.andWhere((builder) => {
                builder
                    .andWhere(`${THOUGHTS_TABLE_NAME}.fromUserId`, filters.authorId)
                    .andWhere(`${THOUGHTS_TABLE_NAME}.isPublic`, true);
            });
        }

        // This restricts the query to only return thoughts that are in the list of thoughtIds
        // when the user is not viewing their own thoughts.
        // This ensures a thought is "activated" for the user when they view it.
        if (!options?.isMe) {
            query = query.andWhere((builder) => {
                builder
                    .whereIn(`${THOUGHTS_TABLE_NAME}.id`, thoughtIds || []);
            });
        }

        if (options.withReplies) {
            query = query
                .leftJoin(`${THOUGHTS_TABLE_NAME} as replies`, 'replies.parentId', `${THOUGHTS_TABLE_NAME}.id`)
                .columns([
                    `${THOUGHTS_TABLE_NAME}.*`,
                    'replies.id as replies[].id', // Just the id so we can count replies in list view
                ]);
        }

        if (options?.shouldHideMatureContent) {
            query = query.where(`${THOUGHTS_TABLE_NAME}.isMatureContent`, false);
        }

        return this.db.read.query(query.toString()).then(async ({ rows }) => {
            // Use raw rows to determine count and isLastPage
            const isLastPage = rows.length < restrictedLimit;
            const thoughts = formatSQLJoinAsJSON(rows, [{ propKey: 'replies', propId: 'id' }]);
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
                    isLastPage,
                };
            }

            return {
                thoughts,
                media: {},
                users: {},
                isLastPage,
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
            message: params.message.substring(0, 255),
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
