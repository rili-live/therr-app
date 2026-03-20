import * as React from 'react';
import { connect } from 'react-redux';
import classnames from 'classnames';
import { Text } from '@mantine/core';
import {
    AccessControl,
    SvgButton,
} from 'therr-react/components';
import { AccessCheckType, IUserState, IMessagesState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import { AccessLevels } from 'therr-js-utilities/constants';
import { bindActionCreators } from 'redux';
import MessagingContainer, { IMessagingContext } from './MessagingContainer';
import { INavMenuContext } from '../../types';
import withTranslation from '../../wrappers/withTranslation';
import UsersActions from '../../redux/actions/UsersActions';

interface IFooterDispatchProps {
    logout: Function;
}

interface IStoreProps extends IFooterDispatchProps {
    messages: IMessagesState;
    user: IUserState;
}

interface IFooterState {
}

// Regular component props
interface IFooterProps extends IStoreProps {
    goHome: Function;
    goTo: Function;
    isAuthorized: boolean;
    isMsgContainerOpen: boolean;
    messagingContext: IMessagingContext;
    onInitMessaging: Function;
    toggleNavMenu: Function;
    toggleMessaging: Function;
    isLandingStylePage?: boolean;
    locale: string;
    translate: (key: string, params?: any) => string;
}

const mapStateToProps = (state: any) => ({
    messages: state.messages,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
}, dispatch);

export class FooterComponent extends React.Component<IFooterProps, IFooterState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    handleLogout = () => {
        const { logout, user, goHome } = this.props;
        logout(user.details).then(() => {
            goHome();
        });
    };

    // eslint-disable-next-line class-methods-use-this
    handleInfoClick = () => {
        const { locale } = this.props;
        const localePrefixMap: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };
        const localePath = localePrefixMap[locale] || '';
        window.open(`https://www.therr.app${localePath}/`, '_blank');
    };

    render() {
        const {
            goHome,
            goTo,
            messages,
            toggleNavMenu,
            isAuthorized,
            isMsgContainerOpen,
            messagingContext,
            onInitMessaging,
            toggleMessaging,
            user,
            isLandingStylePage,
        } = this.props;
        const headerClassNames = classnames({
            'no-shadow': isLandingStylePage,
        });

        return (
            <footer className={headerClassNames}>
                <AccessControl isAuthorized={UsersService.isAuthorized({
                    type: AccessCheckType.ALL,
                    levels: [AccessLevels.EMAIL_VERIFIED],
                }, user)}>
                    <MessagingContainer
                        isMsgContainerOpen={isMsgContainerOpen}
                        messagingContext={messagingContext}
                        onInitMessaging={onInitMessaging}
                        toggleMessaging={toggleMessaging}
                    />
                </AccessControl>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={UsersService.isAuthorized({
                        type: AccessCheckType.ALL,
                        levels: [AccessLevels.EMAIL_VERIFIED],
                    }, user)} publicOnly>
                        <div className="footer-nav-item" onClick={this.handleInfoClick} role="button" tabIndex={0}>
                            <SvgButton
                                id="footer_info"
                                name="info"
                                className="info-button"
                                onClick={this.handleInfoClick}
                                buttonType="primary"
                                aria-label="Open Therr App landing page and info"
                            />
                            <Text size="xs" className="footer-nav-label">
                                {this.props.translate('components.footer.labels.info')}
                            </Text>
                        </div>
                    </AccessControl>
                </div>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={isAuthorized}>
                        <div className="footer-nav-item" onClick={() => goTo('/explore')} role="button" tabIndex={0}>
                            <SvgButton
                                id="footer_home"
                                name="dashboard"
                                className="home-button"
                                onClick={() => goTo('/explore')}
                                buttonType="primary"
                                aria-label="Explore"
                            />
                            <Text size="xs" className="footer-nav-label">
                                {this.props.translate('components.footer.labels.home')}
                            </Text>
                        </div>
                    </AccessControl>
                    <AccessControl publicOnly={true} isAuthorized={isAuthorized}>
                        <div className="footer-nav-item" onClick={() => goHome()} role="button" tabIndex={0}>
                            <SvgButton id="footer_home" name="home" className="home-button" onClick={goHome} buttonType="primary" aria-label="Go home" />
                            <Text size="xs" className="footer-nav-label">
                                {this.props.translate('components.footer.labels.home')}
                            </Text>
                        </div>
                    </AccessControl>
                </div>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={UsersService.isAuthorized({
                        type: AccessCheckType.ALL,
                        levels: [AccessLevels.EMAIL_VERIFIED],
                    }, user)}>
                        <div className="footer-nav-item" onClick={(e) => toggleNavMenu(e, INavMenuContext.FOOTER_MESSAGES)} role="button" tabIndex={0}>
                            <SvgButton
                                id="footer_messages"
                                name="forum"
                                className={`messages-button${messages?.hasUnreadDms ? ' has-unread-messages' : ''}`}
                                onClick={(e) => toggleNavMenu(e, INavMenuContext.FOOTER_MESSAGES)}
                                buttonType="primary"
                                aria-label="Open Groups"
                            />
                            <Text size="xs" className="footer-nav-label">
                                {this.props.translate('components.footer.labels.messages')}
                            </Text>
                        </div>
                    </AccessControl>
                    <AccessControl isAuthorized={UsersService.isAuthorized({
                        type: AccessCheckType.ALL,
                        levels: [AccessLevels.EMAIL_VERIFIED],
                    }, user)} publicOnly>
                        <div className="footer-nav-item" onClick={() => goTo('/locations')} role="button" tabIndex={0}>
                            <SvgButton
                                id="footer_locations_icon"
                                name="location"
                                className="locations-button"
                                onClick={() => goTo('/locations')}
                                buttonType="primary"
                                aria-label="View business locations on Therr App"
                            />
                            <Text size="xs" className="footer-nav-label">
                                {this.props.translate('components.footer.labels.locations')}
                            </Text>
                        </div>
                    </AccessControl>
                    <AccessControl isAuthorized={UsersService.isAuthorized({
                        type: AccessCheckType.ALL,
                        levels: [AccessLevels.EMAIL_VERIFIED],
                    }, user)}>
                        <div className="footer-nav-item" onClick={() => goTo('/explore')} role="button" tabIndex={0}>
                            <SvgButton
                                id="footer_explore"
                                name="world"
                                className="explore-button"
                                onClick={() => goTo('/explore')}
                                buttonType="primary"
                                aria-label="Explore content"
                            />
                            <Text size="xs" className="footer-nav-label">
                                {this.props.translate('components.footer.labels.explore')}
                            </Text>
                        </div>
                    </AccessControl>
                </div>
            </footer>
        );
    }
}

export default withTranslation(connect(mapStateToProps, mapDispatchToProps)(FooterComponent));
