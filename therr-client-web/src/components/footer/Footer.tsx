import * as React from 'react';
import { connect } from 'react-redux';
import classnames from 'classnames';
import {
    AccessControl,
    SvgButton,
} from 'therr-react/components';
import { AccessCheckType, IUserState, IMessagesState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import { AccessLevels } from 'therr-js-utilities/constants';
import { bindActionCreators } from 'redux';
import MessagingContainer, { IMessagingContext } from './MessagingContainer';
import translator from '../../services/translator';
import { INavMenuContext } from '../../types';
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
}

const mapStateToProps = (state: any) => ({
    messages: state.messages,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
}, dispatch);

export class FooterComponent extends React.Component<IFooterProps, IFooterState> {
    private translate: any;

    constructor(props) {
        super(props);

        this.state = {};
        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    handleLogout = () => {
        const { logout, user, goHome } = this.props;
        logout(user.details).then(() => {
            goHome();
        });
    };

    // eslint-disable-next-line class-methods-use-this
    handleInfoClick = () => {
        window.open('https://www.therr.app/', '_blank');
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
                        <SvgButton
                            id="footer_info"
                            name="info"
                            className="info-button"
                            onClick={this.handleInfoClick}
                            buttonType="primary"
                            aria-label="Open Therr App landing page and info"
                        />
                    </AccessControl>
                </div>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={isAuthorized}>
                        <SvgButton
                            id="footer_home"
                            name="dashboard"
                            className="home-button"
                            onClick={() => goTo('/explore')}
                            buttonType="primary"
                            aria-label="Explore"
                        />
                    </AccessControl>
                    <AccessControl publicOnly={true} isAuthorized={isAuthorized}>
                        <SvgButton id="footer_home" name="home" className="home-button" onClick={goHome} buttonType="primary" aria-label="Go home" />
                    </AccessControl>
                </div>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={UsersService.isAuthorized({
                        type: AccessCheckType.ALL,
                        levels: [AccessLevels.EMAIL_VERIFIED],
                    }, user)}>
                        <SvgButton
                            id="footer_messages"
                            name="messages"
                            className={`messages-button${messages?.hasUnreadDms ? ' has-unread-messages' : ''}`}
                            onClick={(e) => toggleNavMenu(e, INavMenuContext.FOOTER_MESSAGES)}
                            buttonType="primary"
                            aria-label="Open Messages"
                        />
                    </AccessControl>
                    <AccessControl isAuthorized={UsersService.isAuthorized({
                        type: AccessCheckType.ALL,
                        levels: [AccessLevels.EMAIL_VERIFIED],
                    }, user)} publicOnly>
                        <SvgButton
                            id="footer_locations_icon"
                            name="location"
                            className="locations-button"
                            onClick={() => goTo('/locations')}
                            buttonType="primary"
                            aria-label="View business locations on Therr App"
                        />
                    </AccessControl>
                    <AccessControl isAuthorized={UsersService.isAuthorized({
                        type: AccessCheckType.ALL,
                        levels: [AccessLevels.EMAIL_VERIFIED],
                    }, user)}>
                        <SvgButton
                            id="footer_explore"
                            name="world"
                            className="explore-button"
                            onClick={() => goTo('/explore')}
                            buttonType="primary"
                            aria-label="Explore content"
                        />
                    </AccessControl>
                </div>
            </footer>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(FooterComponent);
