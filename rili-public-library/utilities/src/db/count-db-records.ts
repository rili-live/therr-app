export interface ICountDbRecords {
  queryBuilder: any;
  execQuery: Function;
  tableName: string;
  params: {
    filterBy?: string;
    query?: any;
  };
}

export default ({
    queryBuilder,
    execQuery,
    tableName,
    params,
}: ICountDbRecords) => {
    const where: any = {};
    if (params.filterBy && params.query) {
        where[params.filterBy] = params.query || '';
    }

    const queryString = queryBuilder
        .count('*')
        .from(tableName)
        .where(where)
        .toString();

    return execQuery(queryString);
};
