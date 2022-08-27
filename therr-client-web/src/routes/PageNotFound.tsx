import * as React from 'react';
import { NavigateFunction } from 'react-router-dom';
import { Status } from 'therr-react/components';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import withNavigation from '../wrappers/withNavigation';

interface IPageNotFoundRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IPageNotFoundDispatchProps {
// Add your dispatcher properties here
}

interface IPageNotFoundProps extends IPageNotFoundRouterProps, IPageNotFoundDispatchProps {}
interface IPageNotFoundState {
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * PageNotFound
 */
export class PageNotFoundComponent extends React.Component<IPageNotFoundProps, IPageNotFoundState> {
    private translate: Function;

    constructor(props: IPageNotFoundProps & IPageNotFoundDispatchProps) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.pageNotFound.pageTitle')}`;
    }

    render() {
        return (
            <Status statusCode={404} {...this.props}>
                <div id="page_page_not_found">
                    <h1>404 | {this.translate('pages.pageNotFound.pageTitle')}</h1>
                </div>
            </Status>
        );
    }
}

export default withNavigation(PageNotFoundComponent);
