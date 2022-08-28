import * as React from 'react';
import { Route, NavigateProps, Navigate } from 'react-router-dom';

interface IRedirectWithStatusProps extends NavigateProps {
    from: string;
    statusCode: string | number;
}

const RedirectWithStatus = (props: IRedirectWithStatusProps) => <Route path={props.from} element={<Navigate to={props.to} replace />} />;

export default RedirectWithStatus;
