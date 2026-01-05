import * as React from 'react';
import { Route } from 'react-router-dom';

interface IStatusProps {
    children: React.ReactNode;
    statusCode: any;
}

class Status extends React.Component<IStatusProps, any> {
    render() {
        const { children, statusCode } = this.props;

        /* eslint-disable react/prop-types */
        const RouteComponent = ({ staticContext }: any) => {
            if (staticContext) {
                staticContext.statusCode = statusCode;
            }
            return <>{children}</>;
        };
        /* eslint-enable react/prop-types */

        return (<Route element={<RouteComponent />} />);
    }
}

export default Status;
