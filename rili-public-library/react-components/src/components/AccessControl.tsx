import * as React from 'react';

interface IAccessControlProps {
    isAuthorized: boolean;
    publicOnly?: boolean;
}

const AccessControl: React.FunctionComponent<IAccessControlProps> = ({ children, isAuthorized, publicOnly }) => {
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
