import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import * as io from 'socket.io-client';
import Status from 'rili-public-library/react-components/Status';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config.js';

interface IPageNotFoundRouterProps {

}

type IPageNotFoundProps = RouteComponentProps<IPageNotFoundRouterProps>

interface IPageNotFoundDispatchProps {
// Add your dispatcher properties here
}

interface IPageNotFoundState {
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * PageNotFound
 */
export class PageNotFoundComponent extends React.Component<IPageNotFoundProps & IPageNotFoundDispatchProps, IPageNotFoundState> {
    private translate: Function;

    constructor(props: IPageNotFoundProps & IPageNotFoundDispatchProps) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = 'Rili | Page Not Found';
    }

    render() {
        return (
            <Status statusCode={404} {...this.props}>
                <div>
                    <h1>404 | Page not found</h1>
                </div>
            </Status>
        );
    }
}

export default withRouter(PageNotFoundComponent);
