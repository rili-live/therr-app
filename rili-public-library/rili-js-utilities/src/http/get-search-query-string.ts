import { IReqQuery } from './get-search-query-args';

export default (reqQuery: IReqQuery) => {
    let queryString = '';
    const {
        filterBy,
        filterOperator,
        query,
        itemsPerPage,
        pageNumber,
        returning,
        orderBy,
        order,
    } = reqQuery;

    const sanitizedQuery: any = {
        filterBy,
        filterOperator,
        query,
        itemsPerPage,
        pageNumber,
        returning,
        orderBy,
        order,
    };

    Object.keys(sanitizedQuery).forEach((key) => {
        if ((sanitizedQuery)[key]) {
            const prefix = queryString.length ? '&' : '?';
            queryString += `${prefix}${key}=${sanitizedQuery[key]}`;
        }
    });

    return queryString;
};
