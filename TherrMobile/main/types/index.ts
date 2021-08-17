export interface ISearchQuery {
    filterBy?: string;
    filterOperator: string;
    query?: string;
    itemsPerPage?: string;
    pageNumber?: string;
    returning?: string;
    shouldCheckReverse?: string;
}

// IDs of the elements on page, used to select/focus tabs
export enum INavMenuContext {
    HEADER_PROFILE = 'header_profile',
    FOOTER_MESSAGES = 'footer_messages',
}
