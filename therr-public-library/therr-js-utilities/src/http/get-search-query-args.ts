export interface IReqQuery {
  filterBy?: string;
  filterOperator?: string;
  query?: string;
  itemsPerPage?: number;
  pageNumber?: number;
  returning?: string;
  orderBy?: string;
  order?: string;
  longitude?: number;
  latitude?: number;
  withMedia?: string;
}

export default (reqQuery: IReqQuery, numberColumns: string[]): [any, string[] | undefined] => {
    let returningArr: any[] = [];
    const {
        filterBy = '',
        filterOperator = '=',
        query = '',
        itemsPerPage,
        pageNumber,
        returning,
        orderBy,
        order,
        longitude,
        latitude,
    } = reqQuery;
    const searchConditions = {
        filterBy,
        filterOperator,
        query: numberColumns.includes(filterBy) ? (query && Number(query)) : query,
        pagination: {
            itemsPerPage: itemsPerPage || 100,
            pageNumber: pageNumber || 1,
        },
        order: (order && order.toLowerCase()) || 'asc',
        orderBy,
        longitude: longitude ? Number(longitude) : undefined,
        latitude: latitude ? Number(latitude) : undefined,
    };

    if (returning) {
        returningArr = returning.split(',');
    }

    return [searchConditions, returningArr];
};
