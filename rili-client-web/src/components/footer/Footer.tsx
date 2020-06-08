import * as React from 'react';
import { connect } from 'react-redux';
import {
    AccessControl,
    SvgButton,
} from 'rili-react/components';
import { IUserState } from 'rili-react/types';
import { bindActionCreators } from 'redux';
import MessagingContainer, { IMessagingContext } from './MessagingContainer';
import { INavMenuContext } from '../../types';
import UsersActions from '../../redux/actions/UsersActions';

interface IFooterDispatchProps {
    logout: Function;
}

interface IStoreProps extends IFooterDispatchProps {
    user: IUserState;
}

interface IFooterState {
}

// Regular component props
interface IFooterProps extends IStoreProps {
    goHome: Function;
    isAuthorized: boolean;
    isMessagingOpen: boolean;
    isMsgContainerOpen: boolean;
    messagingContext: IMessagingContext;
    toggleNavMenu: Function;
    toggleMessaging: Function;
}

const mapStateToProps = (state: any) => ({
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
    }

    render() {
        const {
            goHome,
            toggleNavMenu,
            isAuthorized,
            isMsgContainerOpen,
            isMessagingOpen,
            messagingContext,
            toggleMessaging,
        } = this.props;

        return (
            <footer>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={isAuthorized}>
                        <MessagingContainer
                            isMessagingOpen={isMessagingOpen}
                            isMsgContainerOpen={isMsgContainerOpen}
                            messagingContext={messagingContext}
                            toggleMessaging={toggleMessaging}
                        />
                    </AccessControl>
                </div>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={isAuthorized}>
                        <SvgButton id="footer_home" name="dashboard" className="home-button" onClick={goHome} buttonType="primary" />
                    </AccessControl>
                    <AccessControl publicOnly={true} isAuthorized={isAuthorized}>
                        <SvgButton id="footer_home" name="home" className="home-button" onClick={goHome} buttonType="primary" />
                    </AccessControl>
                </div>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={isAuthorized}>
                        <SvgButton
                            id="footer_messages"
                            name="messages"
                            className="messages-button"
                            onClick={(e) => toggleNavMenu(e, INavMenuContext.FOOTER_MESSAGES)}
                            buttonType="primary"
                        />
                    </AccessControl>
                </div>
            </footer>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(FooterComponent);
