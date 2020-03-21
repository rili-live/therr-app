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
    returning?: string | string[];
}

export default ({
    queryBuilder,
    execQuery,
    tableName,
    conditions,
    returning,
}: ISearchDbRecords) => {
    const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
    const limit = conditions.pagination.itemsPerPage;
    let queryString = queryBuilder
        .select(returning || '*')
        .from(tableName);

    if (conditions.filterBy && conditions.query) {
        const operator = conditions.filterOperator || '=';
        const query = operator === 'like' ? `%${conditions.query}%` : conditions.query;
        queryString = queryString.where(conditions.filterBy, operator, query);
    }

    queryString = queryString
        .limit(limit)
        .offset(offset)
        .toString();

    return execQuery(queryString);
};
