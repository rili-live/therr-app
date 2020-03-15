import * as React from 'react';

interface IAccessControlProps {
    isAuthorized: boolean;
    publicOnly?: boolean;
}

// NOTE: Not sure why typescript is angry here
const AccessControl: React.SFC<IAccessControlProps> = ({ children, isAuthorized, publicOnly }) => { // eslint-disable-line react/prop-types
    if ((isAuthorized && !publicOnly) || (!isAuthorized && publicOnly)) {
        return (
            <>
                {children}
            </>
        );
    }

    return null;
};

export default AccessControl;
