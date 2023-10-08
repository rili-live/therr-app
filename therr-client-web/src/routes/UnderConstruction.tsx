import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Location, NavigateFunction } from 'react-router-dom';
import { IUserState } from 'therr-react/types';
import translator from '../services/translator';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';

interface IUnderConstructionAppRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IUnderConstructionAppDispatchProps {
    login: Function;
}

interface IStoreProps extends IUnderConstructionAppDispatchProps, IUnderConstructionAppRouterProps {
    user: IUserState;
}

// Regular component props
export interface IUnderConstructionAppProps extends IUnderConstructionAppRouterProps, IStoreProps {
}

interface IUnderConstructionAppState {
    inputs: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    login: UsersActions.login,
}, dispatch);

/**
 * Login
 */
export class UnderConstructionAppComponent extends React.Component<IUnderConstructionAppProps, IUnderConstructionAppState> {
    private translate: Function;

    constructor(props: IUnderConstructionAppProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.underConstruction.pageTitle')}`;
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        const { location } = this.props;
        const alertSuccessMessage = location.state && (location.state as any).successMessage;

        return (
            <div id="page_under_construction" className="flex-box center space-evenly row">
                <div className="margin-top-lg margin-bot-lg">
                    <div className="flex fill max-wide-40">
                        <div className="flex-box fill">
                            <img src="/assets/images/on-the-map.svg" alt="Therr users on the map" />
                        </div>
                        <h2 className="text-title-medium text-center no-bot-margin fill">
                            {this.translate('pages.underConstruction.welcome')}
                        </h2>
                        <p className="info-text text-center fill">{this.translate('pages.underConstruction.info')}</p>
                        <p className="info-text text-center fill margin-top-lg margin-bot-lg">{this.translate('pages.home.info2')}</p>
                        <p className="info-text text-center fill margin-top-lg margin-bot-lg">{this.translate('pages.home.info3')}</p>
                        <div className="store-image-links flex-box row space-around margin-top-lg">
                            <a href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                <img className="max-100" src="/assets/images/apple-store-download-button.svg" alt="Download Therr on the App Store" />
                            </a>
                            <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                <img className="max-100" src="/assets/images/play-store-download-button.svg" alt="Download Therr on Google Play" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(UnderConstructionAppComponent));
