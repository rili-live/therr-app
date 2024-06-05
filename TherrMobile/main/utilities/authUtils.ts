import { UsersService } from 'therr-react/services';
import { AccessCheckType } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';

const isUserAuthenticated = (user) => UsersService.isAuthorized(
    {
        type: AccessCheckType.ANY,
        levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
    },
    user
);

const isUserEmailVerified = (user) => {
    return UsersService.isAuthorized(
        {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        user
    );
};

export {
    isUserAuthenticated,
    isUserEmailVerified,
};
