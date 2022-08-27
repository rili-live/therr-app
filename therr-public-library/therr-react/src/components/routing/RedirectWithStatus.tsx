import * as React from 'react';
import { Route, NavigateProps, Navigate } from 'react-router-dom';

interface IRedirectWithStatusProps extends NavigateProps {
    from: string;
    statusCode: string | number;
}

class RedirectWithStatus extends React.Component<IRedirectWithStatusProps, any> {
    render() {
        const { from, statusCode, to } = this.props;

        const renderRoute = ({ staticContext }: any) => {
            if (staticContext) {
                staticContext.statusCode = statusCode;
            }

            return (
                <Route path={from} element={() => <Navigate to={to} replace />} />
            );
        };

        return (<Route element={renderRoute} />);
    }
}

export default RedirectWithStatus;
