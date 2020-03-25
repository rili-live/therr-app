export enum AccessCheckType {
  ALL = 'all', // User has all of the access levels from the check
  ANY = 'any', // User has at least one of the access levels from the check
  NONE = 'none', // User does not have any of the access levels from the check
}

export interface IAccess {
  type: AccessCheckType;
  levels: Array<string>;
}

export interface ISearchQuery {
  filterBy?: string;
  filterOperator: string;
  query?: string;
  itemsPerPage?: string;
  pageNumber?: string;
  returning?: string;
}
