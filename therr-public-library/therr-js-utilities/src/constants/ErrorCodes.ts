const ErrorCodes = {
    ACCESS_DENIED: 'AccessDenied',
    UNKNOWN_ERROR: 'UnknownError',
    DUPLICATE_POST: 'DuplicatePost',
    NOT_FOUND: 'NotFound',
    USER_EXISTS: 'UserAlreadyExists',
    INVALID_REGION: 'InvalidRegion',
    INSUFFICIENT_THERR_COIN_FUNDS: 'InsufficientTherrCoinFunds',
    METRIC_ACCESS_RESTRICTED: 'MetricAccessRestricted',
    MOMENT_ACCESS_RESTRICTED: 'MomentAccessRestricted',
    TOO_MANY_ACCOUNTS: 'OnlyTwoAccountsPerPhoneNumber',
    THOUGHT_ACCESS_RESTRICTED: 'ThoughtAccessRestricted',
    SPACE_ACCESS_RESTRICTED: 'SpaceAccessRestricted',
    NO_SPACE_OVERLAP: 'SpacesCannotOverlap',
};

export default ErrorCodes;
