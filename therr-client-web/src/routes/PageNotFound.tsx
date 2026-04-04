import * as React from 'react';
import { NavigateFunction } from 'react-router-dom';
import * as globalConfig from '../../../global-config';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

interface IPageNotFoundRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IPageNotFoundDispatchProps {
// Add your dispatcher properties here
}

interface IPageNotFoundProps extends IPageNotFoundRouterProps, IPageNotFoundDispatchProps {
    translate: (key: string, params?: any) => string;
}
interface IPageNotFoundState {
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * PageNotFound
 */
export class PageNotFoundComponent extends React.Component<IPageNotFoundProps, IPageNotFoundState> {
    constructor(props: IPageNotFoundProps & IPageNotFoundDispatchProps) {
        super(props);

        this.state = {};
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.props.translate('pages.pageNotFound.pageTitle')}`;
    }

    render() {
        return (
            <div id="page_page_not_found">
                <h1>404 | {this.props.translate('pages.pageNotFound.pageTitle')}</h1>
            </div>
        );
    }
}

export default withNavigation(withTranslation(PageNotFoundComponent));
