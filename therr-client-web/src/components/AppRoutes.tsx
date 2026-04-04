/* eslint-disable react/display-name */
/* eslint-disable arrow-body-style */
import * as React from 'react';
import { useRoutes } from 'react-router-dom';
import getRoutes from '../routes';

const Routes = ({ initMessaging, isAuthorized }) => (
    useRoutes(
        getRoutes({
            onInitMessaging: initMessaging,
            isAuthorized,
        }),
    )
);

const AppRoutes = (props) => (
    <React.Suspense fallback={<div className="view" />}>
        <Routes {...props} />
    </React.Suspense>
);

export default AppRoutes;
