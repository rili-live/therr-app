const ErrorCodes = {
    ACCESS_DENIED: 'AccessDenied',
    BAD_REQUEST: 'BadRequest',
    UNKNOWN_ERROR: 'UnknownError',
    DUPLICATE_POST: 'DuplicatePost',
    NOT_FOUND: 'NotFound',
    // Correct credentials on an account that has never confirmed its e-mail. Distinct from a
    // credential rejection so clients can point the user at their inbox instead of at a
    // password reset they don't need.
    NOT_VERIFIED: 'AccountNotVerified',
    USER_EXISTS: 'UserAlreadyExists',
    INVALID_REGION: 'InvalidRegion',
    INSUFFICIENT_THERR_COIN_FUNDS: 'InsufficientTherrCoinFunds',
    LOCATION_REQUIRED: 'LocationRequired',
    METRIC_ACCESS_RESTRICTED: 'MetricAccessRestricted',
    MOMENT_ACCESS_RESTRICTED: 'MomentAccessRestricted',
    EVENT_ACCESS_RESTRICTED: 'EventAccessRestricted',
    TOO_MANY_ACCOUNTS: 'OnlyThreeAccountsPerPhoneNumber',
    THOUGHT_ACCESS_RESTRICTED: 'ThoughtAccessRestricted',
    SPACE_ACCESS_RESTRICTED: 'SpaceAccessRestricted',
    NO_SPACE_OVERLAP: 'SpacesCannotOverlap',
    NOT_PERMITTED: 'NotPermitted',
};

export default ErrorCodes;
