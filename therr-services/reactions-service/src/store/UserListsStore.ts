import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_LISTS_TABLE_NAME = 'main.userLists';

export interface ICreateUserListParams {
    userId: string;
    name: string;
    description?: string;
    iconName?: string;
    colorHex?: string;
    isPublic?: boolean;
    isDefault?: boolean;
}

export interface IUpdateUserListConditions {
    id?: string;
    userId?: string;
}

export interface IUpdateUserListParams {
    name?: string;
    description?: string;
    iconName?: string;
    colorHex?: string;
    isPublic?: boolean;
    isDefault?: boolean;
    itemCount?: number;
}

export default class UserListsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: any = {}, filters = { limit: 100, offset: 0, order: 'DESC' }) {
        const restrictedLimit = Math.min(filters.limit || 100, 500);

        const queryString = knexBuilder.select('*')
            .from(USER_LISTS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit)
            .orderBy('updatedAt', filters.order || 'DESC')
            .offset(filters.offset || 0);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select('*')
            .from(USER_LISTS_TABLE_NAME)
            .where({ id })
            .limit(1);

        return this.db.read.query(queryString.toString()).then((response) => response.rows[0]);
    }

    getByIds(ids: string[]) {
        if (!ids?.length) {
            return Promise.resolve([]);
        }
        const queryString = knexBuilder.select('*')
            .from(USER_LISTS_TABLE_NAME)
            .whereIn('id', ids);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    findDefaultForUser(userId: string) {
        const queryString = knexBuilder.select('*')
            .from(USER_LISTS_TABLE_NAME)
            .where({ userId, isDefault: true })
            .limit(1);

        return this.db.read.query(queryString.toString()).then((response) => response.rows[0]);
    }

    findByUserAndName(userId: string, name: string) {
        // Case-insensitive match against the unique index on (userId, LOWER(name))
        const queryString = knexBuilder.select('*')
            .from(USER_LISTS_TABLE_NAME)
            .where({ userId })
            .whereRaw('LOWER(name) = LOWER(?)', [name])
            .limit(1);

        return this.db.read.query(queryString.toString()).then((response) => response.rows[0]);
    }

    create(params: ICreateUserListParams) {
        const queryString = knexBuilder(USER_LISTS_TABLE_NAME)
            .insert({
                userId: params.userId,
                name: params.name,
                description: params.description || null,
                iconName: params.iconName || null,
                colorHex: params.colorHex || null,
                isPublic: params.isPublic ?? false,
                isDefault: params.isDefault ?? false,
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    update(conditions: IUpdateUserListConditions, params: IUpdateUserListParams) {
        const queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(USER_LISTS_TABLE_NAME)
            .where(conditions)
            .returning('*');

        return this.db.write.query(queryString.toString()).then((response) => response.rows);
    }

    incrementItemCount(listId: string, delta: number) {
        const queryString = knexBuilder(USER_LISTS_TABLE_NAME)
            .where({ id: listId })
            .update({
                itemCount: knexBuilder.raw('GREATEST("itemCount" + ?, 0)', [delta]),
                updatedAt: new Date(),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    delete(conditions: IUpdateUserListConditions) {
        const queryString = knexBuilder.delete()
            .from(USER_LISTS_TABLE_NAME)
            .where(conditions)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
