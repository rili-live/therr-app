export interface IReqQuery {
  filterBy?: string;
  filterOperator: string;
  query?: string;
  itemsPerPage?: string;
  pageNumber?: string;
  returning?: string;
  orderBy?: string;
  order?: string;
}

export default (reqQuery: IReqQuery, integerColumns: string[]) => {
    let returningArr;
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
    const searchConditions = {
        filterBy,
        filterOperator,
        query: integerColumns.includes(filterBy) ? (query && Number(query)) : query,
        pagination: {
            itemsPerPage: itemsPerPage || 100,
            pageNumber: pageNumber || 1,
        },
        order: (order && order.toLowerCase()) || 'asc',
        orderBy,
    };

    if (returning) {
        returningArr = returning.split(',');
    }

    return [searchConditions, returningArr];
};
