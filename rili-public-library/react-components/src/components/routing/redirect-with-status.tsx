import * as React from 'react';
import { Route, Redirect, RedirectProps } from 'react-router-dom';

class RedirectWithStatus extends React.Component<RedirectProps, any> {
    constructor(props: RedirectProps) {
        super(props);
    }

    render() {
        const renderRoute = ({ staticContext }: any) => {
            if (staticContext) {
                staticContext.status = status;
            }

            return (
                <Redirect from={this.props.from} to={this.props.to}/>
            );
        };

        return (<Route render={renderRoute} /> );
    }
}

export default RedirectWithStatus;