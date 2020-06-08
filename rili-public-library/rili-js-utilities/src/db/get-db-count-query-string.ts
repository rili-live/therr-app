export interface ICountDbRecords {
  queryBuilder: any;
  tableName: string;
  params: {
    filterBy?: string;
    query?: any;
  };
  defaultConditions: any;
}

export default ({
    queryBuilder,
    tableName,
    params,
    defaultConditions,
}: ICountDbRecords) => {
    const where: any = defaultConditions;
    if (params.filterBy && params.query) {
        where[params.filterBy] = params.query || '';
    }

    const queryString = queryBuilder
        .count('*')
        .from(tableName)
        .where(where)
        .toString();

    return queryString;
};
