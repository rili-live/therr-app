/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Link, NavigateFunction } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { IUserState } from 'therr-react/types';
import { Categories, Cities } from 'therr-js-utilities/constants';
import IosWaitlistModal from '../components/IosWaitlistModal';
import LoginForm from '../components/forms/LoginForm';
import { shouldRenderLoginForm, ILoginProps, getRouteAfterLogin } from './Login';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

// Featured city slugs shown on the home page (surface internal links to ~12 top landing pages).
// The full list of supported cities lives at /locations/cities.
const FEATURED_CITY_SLUGS = [
    'new-york-ny', 'los-angeles-ca', 'chicago-il', 'houston-tx',
    'san-francisco-ca', 'seattle-wa', 'denver-co', 'austin-tx',
    'nashville-tn', 'atlanta-ga', 'portland-or', 'tampa-fl',
];

const formatCategoryLabelForHome = (categoryKey: string): string => {
    if (!categoryKey) return '';
    const label = categoryKey.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

interface IHomeRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IHomeDispatchProps {
    login: Function;
}

interface IStoreProps extends IHomeDispatchProps {
    user: IUserState;
}

// Regular component props
interface IHomeProps extends IHomeRouterProps, IStoreProps {
    locale: string;
    translate: (key: string, params?: any) => string;
}

interface IHomeState {
    inputs: any;
    isIosWaitlistModalOpen: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    login: UsersActions.login,
}, dispatch);

/**
 * Home
 */
export class HomeComponent extends React.Component<IHomeProps, IHomeState> {
    static getDerivedStateFromProps(nextProps: IHomeProps) {
        if (!shouldRenderLoginForm(nextProps as unknown as ILoginProps)) {
            const destination = getRouteAfterLogin(nextProps.user);
            setTimeout(() => nextProps.navigation.navigate(destination));
            return null;
        }
        return {};
    }

    constructor(props: IHomeProps) {
        super(props);

        this.state = {
            inputs: {},
            isIosWaitlistModalOpen: false,
        };
    }

    componentDidMount() {
        document.title = `Therr | ${this.props.translate('pages.home.pageTitle')}`;
    }

    login = (credentials: any) => this.props.login(credentials);

    loginSSO = (ssoData: any) => this.props.login(ssoData, { google: ssoData.idToken });

    /**
     * There is no published Therr iOS build (docs/niche-sub-apps/PROJECT_BRIEF.md), so this
     * badge used to send visitors to a dead App Store listing and the size of the iOS
     * audience was unknowable. The click is now the demand metric and the modal explains why
     * nothing downloaded. Mark `ios_interest_click` as a key event in GA4 admin so it is
     * reportable, and keep the event name identical to the habits landing page's.
     */
    onIosClick = () => {
        ReactGA.event('ios_interest_click', {
            app: 'therr',
            location: 'home_hero',
        });
        this.setState({ isIosWaitlistModalOpen: true });
    };

    onIosWaitlistClose = () => this.setState({ isIosWaitlistModalOpen: false });

    public render(): JSX.Element | null {
        const { locale, translate } = this.props;
        const { isIosWaitlistModalOpen } = this.state;
        const localePrefixMap: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };
        const localePath = localePrefixMap[locale] || '';

        const featuredCities = FEATURED_CITY_SLUGS
            .map((slug) => Cities.CitySlugMap[slug])
            .filter(Boolean);
        const categoryEntries = Object.entries(Categories.CategorySlugMap)
            .map(([key, slug]) => ({ key, slug: slug as string, label: formatCategoryLabelForHome(key) }))
            .sort((a, b) => a.label.localeCompare(b.label));

        return (
            <div id="page_home">
                <div className="flex-box space-evenly center row wrap-reverse">
                    <div className="login-container info-container">
                        <div className="flex fill max-wide-40">
                            <div className="flex-box fill">
                                <img src="/assets/images/on-the-map.svg" alt="Therr users on the map" width="400" height="300" />
                            </div>
                            <h1 className="text-title-medium no-bot-margin fill">
                                {translate('pages.home.welcome')}
                            </h1>
                            <p className="info-text fill">{translate('pages.home.info')}</p>
                            <p className="info-text fill margin-top-lg margin-bot-lg">{translate('pages.home.info2')}</p>
                            <p className="info-text fill margin-top-lg margin-bot-lg">{translate('pages.home.info3')}</p>
                            <div className="store-image-links margin-top-lg">
                                <button
                                    type="button"
                                    className="button-plain-image"
                                    onClick={this.onIosClick}
                                    aria-haspopup="dialog"
                                    aria-label={translate('components.iosWaitlistModal.buttonLabel')}
                                >
                                    {/* alt="" because the button's aria-label is already the accessible name; a
                                        duplicate would be announced twice. */}
                                    <img className="max-100" src="/assets/images/apple-store-download-button.svg" alt="" width="150" height="50" loading="lazy" />
                                </button>
                                <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                    <img aria-label="play store link" className="max-100" src="/assets/images/play-store-download-button.svg" alt="Download Therr on Google Play" width="150" height="50" loading="lazy" />
                                </a>
                            </div>
                            <div className="text-center" style={{ padding: '1.5rem 0 0 1rem' }}>
                                <a href={`https://www.therr.app${localePath}/privacy-policy.html`} target="_blank" className="link-plain-white">{translate('components.loginForm.buttons.privacyPolicy')}</a> | <a href={`https://www.therr.app${localePath}/terms-and-conditions.html`} target="_blank" className="link-plain-white">{translate('components.loginForm.buttons.toc')}</a>
                            </div>
                        </div>
                    </div>
                    <LoginForm login={this.login} onGoogleLogin={this.loginSSO} />
                </div>
                <section className="home-seo-section" aria-labelledby="home-discover-heading" style={{ width: '100%', padding: '2rem 1rem' }}>
                    <div style={{ maxWidth: 960, margin: '0 auto' }}>
                        <h2 id="home-discover-heading" className="text-title-medium">
                            {translate('pages.home.seo.discoverHeading')}
                        </h2>
                        <p className="info-text">{translate('pages.home.seo.discoverBody')}</p>

                        <h3 className="text-title-small">{translate('pages.home.seo.popularCitiesHeading')}</h3>
                        <nav aria-label={translate('pages.home.seo.popularCitiesHeading')}>
                            <ul className="home-link-grid">
                                {featuredCities.map((city) => (
                                    <li key={city.slug}>
                                        <Link to={`/locations/city/${city.slug}`}>
                                            {city.name}, {city.stateAbbr}
                                        </Link>
                                    </li>
                                ))}
                                <li>
                                    <Link to="/locations/cities"><strong>{translate('pages.home.seo.viewAllCities')}</strong></Link>
                                </li>
                            </ul>
                        </nav>

                        <h3 className="text-title-small">{translate('pages.home.seo.popularCategoriesHeading')}</h3>
                        <nav aria-label={translate('pages.home.seo.popularCategoriesHeading')}>
                            <ul className="home-link-grid">
                                {categoryEntries.map((cat) => (
                                    <li key={cat.slug}>
                                        <Link to={`/locations/${cat.slug}`}>{cat.label}</Link>
                                    </li>
                                ))}
                                <li>
                                    <Link to="/locations/categories"><strong>{translate('pages.home.seo.viewAllCategories')}</strong></Link>
                                </li>
                            </ul>
                        </nav>

                        <h3 className="text-title-small">{translate('pages.home.seo.forBusinessesHeading')}</h3>
                        <p className="info-text">{translate('pages.home.seo.forBusinessesBody')}</p>
                    </div>
                </section>
                <IosWaitlistModal
                    opened={isIosWaitlistModalOpen}
                    onClose={this.onIosWaitlistClose}
                    location="home_hero"
                />
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(HomeComponent)));
