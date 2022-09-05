import * as React from 'react';

interface IAccessControlProps {
    children: React.ReactElement;
    isAuthorized: boolean;
    publicOnly?: boolean;
}

// NOTE: Not sure why typescript is angry here
const AccessControl: React.FunctionComponent<IAccessControlProps> = ({ children, isAuthorized, publicOnly }: IAccessControlProps) => {
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
