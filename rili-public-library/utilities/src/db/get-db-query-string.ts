export interface ISearchDbRecords {
    queryBuilder: any;
    execQuery: Function;
    tableName: string;
    conditions: {
        filterBy?: string;
        filterOperator?: string;
        query?: string | number | boolean;
        pagination: {
            itemsPerPage: number;
            pageNumber: number;
        };
    };
    defaultConditions: any;
    groupBy?: string;
    orderBy?: string;
    returning?: string | string[];
}

export default ({
    queryBuilder,
    tableName,
    conditions,
    defaultConditions,
    groupBy,
    orderBy,
    returning,
}: ISearchDbRecords): string => {
    const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
    const limit = conditions.pagination.itemsPerPage;
    let queryString = queryBuilder
        .select(returning || '*')
        .from(tableName)
        .where(defaultConditions);

    if (conditions.filterBy && conditions.query) {
        const operator = conditions.filterOperator || '=';
        const query = operator === 'like' ? `%${conditions.query}%` : conditions.query;
        queryString = queryString.andWhere(conditions.filterBy, operator, query);
    }

    if (groupBy) {
        queryString = queryString.groupBy(groupBy);
    }

    if (orderBy) {
        queryString = queryString.orderBy(orderBy);
    }

    queryString = queryString
        .limit(limit)
        .offset(offset)
        .toString();

    return queryString;
};
