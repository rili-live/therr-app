/* eslint-disable react/display-name */
/* eslint-disable arrow-body-style */
import * as React from 'react';
import { useRoutes } from 'react-router-dom';
import getRoutes from '../routes';

const AppRoutes = ({ initMessaging, isAuthorized }) => (
    useRoutes(
        getRoutes({
            onInitMessaging: initMessaging,
            isAuthorized,
        }),
    )
);

export default AppRoutes;
