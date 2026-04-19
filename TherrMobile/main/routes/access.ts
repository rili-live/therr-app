import { AccessLevels } from 'therr-js-utilities/constants';
import { IAccess, AccessCheckType } from 'therr-react/types';

export const AccessPresets: Record<string, IAccess> = {
    EMAIL_VERIFIED: {
        type: AccessCheckType.ALL,
        levels: [AccessLevels.EMAIL_VERIFIED],
    },
    EMAIL_VERIFIED_MISSING_PROPERTIES: {
        type: AccessCheckType.ALL,
        levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
    },
    PUBLIC_DEFAULT: {
        type: AccessCheckType.NONE,
        levels: [
            AccessLevels.DEFAULT,
            AccessLevels.EMAIL_VERIFIED,
            AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES,
        ],
        isPublic: true,
    },
    PUBLIC_AUTHENTICATED: {
        type: AccessCheckType.NONE,
        levels: [
            AccessLevels.EMAIL_VERIFIED,
            AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES,
        ],
        isPublic: true,
    },
    PUBLIC_PARTIAL: {
        type: AccessCheckType.NONE,
        levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        isPublic: true,
    },
};
