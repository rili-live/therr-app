import * as React from 'react';
import { NavigateProps, Navigate } from 'react-router-dom';

interface IRedirectWithStatusProps extends NavigateProps {
    statusCode: string | number;
}

const RedirectWithStatus = (props: IRedirectWithStatusProps) => <Navigate to={props.to} replace />;

export default RedirectWithStatus;
