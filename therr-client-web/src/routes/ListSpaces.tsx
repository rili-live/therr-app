/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Link, NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import { ILocationState } from '../types/redux/location';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
// import * as globalConfig from '../../../global-config';

export const DEFAULT_ITEMS_PER_PAGE = 5;
export const DEFAULT_LATITUDE = 37.1261664; // Middle of U.S. - TODO: Use browser location
export const DEFAULT_LONGITUDE = -106.2447206; // Middle of U.S. - TODO: Use browser location

interface IListSpacesRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        pageNumber: string;
    }
}

interface IListSpacesDispatchProps {
    login: Function;
    listSpaces: Function;
    updateUserCoordinates: Function;
}

interface IStoreProps extends IListSpacesDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
interface IListSpacesProps extends IListSpacesRouterProps, IStoreProps {
}

interface IListSpacesState {
    itemsPerPage: number;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    location: state.location,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    listSpaces: MapActions.listSpaces,
    updateUserCoordinates: MapActions.updateUserCoordinates,
}, dispatch);

/**
 * ListSpaces
 */
export class ListSpacesComponent extends React.Component<IListSpacesProps, IListSpacesState> {
    private translate: Function;

    constructor(props: IListSpacesProps) {
        super(props);

        this.state = {
            itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { map, routeParams } = this.props;
        const { pageNumber: pn } = routeParams;
        const pageNumberStr = pn || '1';

        document.title = `Therr | ${this.translate('pages.spaces.pageTitle')}`;

        const isValidPage = !Number.isNaN(pageNumberStr) && !Number.isNaN(parseInt(pageNumberStr, 10));
        if (!isValidPage) {
            setTimeout(() => this.props.navigation.navigate('/locations'));
        } else {
            const pageNumber = parseInt(pageNumberStr, 10);

            this.getLocation();

            if (!Object.values(map?.spaces || {}).length) {
                this.searchPaginatedSpaces(pageNumber);
            }
        }
    }

    componentDidUpdate(prevProps: Readonly<IListSpacesProps>, prevState: Readonly<IListSpacesState>, snapshot?: any): void {
        if (prevProps.routeParams.pageNumber !== this.props.routeParams.pageNumber) {
            const { location } = this.props;
            const latitude = location?.user?.latitude || DEFAULT_LATITUDE;
            const longitude = location?.user?.longitude || DEFAULT_LONGITUDE;
            this.searchPaginatedSpaces(parseInt(this.props.routeParams.pageNumber, 10), DEFAULT_ITEMS_PER_PAGE, latitude, longitude);
        }
    }

    searchPaginatedSpaces = (
        pageNumber: number,
        itemsPerPage: number = DEFAULT_ITEMS_PER_PAGE,
        lat = DEFAULT_LATITUDE, // Middle of U.S. - TODO: Use browser location
        lon = DEFAULT_LONGITUDE, // Middle of U.S. - TODO: Use browser location
    ) => {
        const { listSpaces, map } = this.props;
        this.setState({
            itemsPerPage,
        });

        listSpaces({
            // query: '',
            itemsPerPage,
            pageNumber,
            filterBy: 'distance',
            latitude: lat,
            longitude: lon,
        }, {
            distanceOverride: 40075 * (1000 / 2), // estimated half distance around world in meters
        }).catch((err) => {
            console.log(err);
        });
    };

    handleLocation = ({
        coords: {
            latitude,
            longitude,
        },
    }) => {
        const { itemsPerPage } = this.state;
        const { routeParams } = this.props;
        const { pageNumber: pageNumberStr } = routeParams;
        this.props.updateUserCoordinates({
            latitude,
            longitude,
        });
        this.searchPaginatedSpaces(parseInt(pageNumberStr, 10), itemsPerPage, latitude, longitude);
    };

    // eslint-disable-next-line class-methods-use-this
    handleLocationError = (err) => {
        console.log(err);
    };

    getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this.handleLocation, this.handleLocationError);
        }
    };

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        const { routeParams, map } = this.props;
        const { pageNumber: pageNumberStr } = routeParams;
        const { itemsPerPage } = this.state;
        const spacesArray = Object.values(map?.spaces || {});
        const pageNumber = parseInt(pageNumberStr || '1', 10);

        return (
            <div id="page_view_spaces" className="flex-box space-evenly center row wrap-reverse">
                <div className="login-container info-container">
                    <div className="flex fill max-wide-40">
                        <div className="flex-box fill">
                            <img src="/assets/images/on-the-map.svg" alt="Therr users on the map" />
                        </div>
                        <h2 className="text-title-medium no-bot-margin fill">
                            {this.translate('pages.home.welcome')}
                        </h2>
                        <p className="info-text fill">{this.translate('pages.home.info')}</p>
                        <p className="info-text fill margin-top-lg margin-bot-lg">{this.translate('pages.home.info2')}</p>
                        <div className="store-image-links margin-top-lg">
                            <a href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                <img aria-label="apple store link" className="max-100" src="/assets/images/apple-store-download-button.svg" alt="Download Therr on the App Store" />
                            </a>
                            <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                <img aria-label="play store link" className="max-100" src="/assets/images/play-store-download-button.svg" alt="Download Therr on Google Play" />
                            </a>
                        </div>
                        <div className="text-center" style={{ padding: '1.5rem 0 0 1rem' }}>
                            <a href="https://www.therr.app/privacy-policy.html" target="_blank" className="link-plain-white">{this.translate('components.loginForm.buttons.privacyPolicy')}</a> | <a href="https://www.therr.app/terms-and-conditions.html" target="_blank" className="link-plain-white">{this.translate('components.loginForm.buttons.toc')}</a>
                        </div>
                    </div>
                </div>
                <div className="login-container info-container">
                    <div className="flex fill max-wide-50">
                        <h1 className="text-title-medium no-bot-margin fill">
                            {this.translate('pages.spaces.header1')}
                        </h1>
                        <div className="flex fill max-tall-60 overflow-scroll">
                            {
                                spacesArray.map((space) => (
                                    <section key={space.id}>
                                        <h2>
                                            <span>
                                                <Link to={`/spaces/${space.id}`}>
                                                    {space.notificationMsg}
                                                </Link>
                                            </span>
                                            {
                                                space.websiteUrl && <span> • <a href={space.websiteUrl}>website</a></span>
                                            }
                                        </h2>
                                        {
                                            space.addressReadable && <h4 style={{
                                                marginLeft: '1rem',
                                            }}>{space.addressReadable}</h4>
                                        }
                                    </section>
                                ))
                            }
                        </div>
                        <div className="flex-box row fill space-around">
                            {
                                pageNumber > 1
                                    && <Link to={`/locations/${pageNumber - 1}`}>{this.translate('pages.spaces.previousPage', {
                                        pageNumber: pageNumber - 1,
                                    })}</Link>
                            }
                            {
                                spacesArray.length >= itemsPerPage
                                    && <Link to={`/locations/${pageNumber + 1}`}>{this.translate('pages.spaces.nextPage', {
                                        pageNumber: pageNumber + 1,
                                    })}</Link>
                            }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ListSpacesComponent));
