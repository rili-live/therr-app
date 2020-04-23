import * as React from 'react';
import { connect } from 'react-redux';
import AccessControl from 'rili-public-library/react-components/AccessControl.js';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
import { IUserState } from 'types/user';
import UsersActions from 'actions/Users';
import { bindActionCreators } from 'redux';
import { INavMenuContext } from '../types';

export type IMessagingContext = any;
// export interface IMessagingContext {

// }
interface IFooterDispatchProps {
    logout: Function;
}

interface IStoreProps extends IFooterDispatchProps {
    user: IUserState;
}

interface IFooterState {
    prevMessagingContext?: IMessagingContext;
}

// Regular component props
interface IFooterProps extends IStoreProps {
    goHome: Function;
    isAuthorized: boolean;
    isMessagingOpen: boolean;
    messagingContext: IMessagingContext;
    toggleNavMenu: Function;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
}, dispatch);

export class FooterComponent extends React.Component<IFooterProps, IFooterState> {
    static getDerivedStateFromProps(nextProps: IFooterProps, nextState: IFooterState) {
        if (nextProps.messagingContext !== nextState.prevMessagingContext) {
            console.log('NEXT', nextProps.messagingContext);
            return {
                prevMessagingContext: nextProps.messagingContext,
            };
        }
        return {};
    }

    constructor(props) {
        super(props);

        this.state = {
            prevMessagingContext: props.messagingContext,
        };
    }

    handleLogout = () => {
        const { logout, user, goHome } = this.props;
        logout(user.details).then(() => {
            goHome();
        });
    }

    toggleMessaging = (e) => {
        console.log(e);
    }

    render() {
        const {
            goHome,
            toggleNavMenu,
            isAuthorized,
            isMessagingOpen,
            messagingContext,
        } = this.props;

        return (
            <footer>
                <div className="footer-menu-item">
                    <AccessControl isAuthorized={isAuthorized}>
                        {
                            isMessagingOpen
                            && <SvgButton
                                id="footer_messaging"
                                name="people-alt,messages,world"
                                className="messaging-button"
                                onClick={this.toggleMessaging}
                                buttonType="primary"
                            />
                        }
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
