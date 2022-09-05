/* eslint-disable react/display-name */
/* eslint-disable arrow-body-style */
import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const withNavigation = (Component: any) => {
    return (props: any): any => (
        <Component
            {...props}
            routeParams={useParams()}
            location={useLocation()}
            navigation={{
                navigate: useNavigate(),
            }}
        />
    );
};

export default withNavigation;
