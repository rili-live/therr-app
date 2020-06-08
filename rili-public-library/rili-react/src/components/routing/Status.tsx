import * as React from 'react';
import { Route } from 'react-router-dom';

interface IStatusProps {
    statusCode: any;
}

class Status extends React.Component<IStatusProps, any> {
    render() {
        const { children, statusCode } = this.props;

        const renderRoute = ({ staticContext }: any) => {
            if (staticContext) {
                staticContext.statusCode = statusCode;
            }
            return children;
        };

        return (<Route render={renderRoute} />);
    }
}

export default Status;
