import * as React from 'react';
import { connect } from 'react-redux';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary.js';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
import { IUserState } from 'types/user';
import UsersActions from 'actions/Users';
import { bindActionCreators } from 'redux';
import translator from '../../services/translator';

interface IMessagesMenuDispatchProps {
    logout: Function;
}

interface IStoreProps extends IMessagesMenuDispatchProps {
    history: any;
    user: IUserState;
}

// Regular component props
interface IMessagesMenuProps extends IStoreProps {
    toggleNavMenu: Function;
}

interface IMessagesMenuState {
    activeTab: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
}, dispatch);

export class MessagesMenuComponent extends React.Component<IMessagesMenuProps, IMessagesMenuState> {
    constructor(props) {
        super(props);

        this.state = {
            activeTab: 'messages',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    private translate: Function;

    handleTabSelect = (e, tabName) => {
        this.setState({
            activeTab: tabName,
        });
    }

    navigate = (destination) => (e) => {
        this.props.toggleNavMenu(e);

        switch (destination) {
            case 'join-room':
                return this.props.history.push('/join-room');
            default:
        }
    }

    renderMessagesContent = () => (
        <>
            <h2>{this.translate('components.messagesMenu.h2.messaging')}</h2>
            <div className="rili-connect-menu">
                <ButtonPrimary
                    id="nav_menu_join_room"
                    className="menu-item"
                    name="Join Room"
                    text={this.translate('components.messagesMenu.buttons.joinRoom')}
                    onClick={this.navigate('join-room')} buttonType="primary"
                />
            </div>
        </>
    )

    renderPeopleContent = () => (
        <>
            <h2>{this.translate('components.messagesMenu.h2.riliConnect')}</h2>
        </>
    )

    renderLocationContent = () => (
        <>
            <h2>{this.translate('components.messagesMenu.h2.locationMap')}</h2>
        </>
    )

    render() {
        const { activeTab } = this.state;
        const { toggleNavMenu } = this.props;

        return (
            <>
                <div className="nav-menu-header">
                    <SvgButton
                        id="nav_menu_messages_button"
                        name="messages"
                        className={`menu-tab-button ${activeTab === 'messages' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'messages')}
                        buttonType="primary"
                    />
                    <SvgButton
                        id="nav_menu_people"
                        name="people"
                        className={`menu-tab-button ${activeTab === 'people' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'people')}
                        buttonType="primary"
                    />
                    <SvgButton
                        id="nav_menu_location"
                        name="location"
                        className={`menu-tab-button ${activeTab === 'location' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'location')}
                        buttonType="primary"
                    />
                </div>
                <div className="nav-menu-content">
                    {
                        activeTab === 'messages'
                            && this.renderMessagesContent()
                    }
                    {
                        activeTab === 'people'
                            && this.renderPeopleContent()
                    }
                    {
                        activeTab === 'location'
                            && this.renderLocationContent()
                    }
                </div>
                <div className="nav-menu-footer">
                    <SvgButton
                        id="nav_menu_footer_close"
                        name="close"
                        className="close-button"
                        onClick={toggleNavMenu}
                        buttonType="primary"
                    />
                </div>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MessagesMenuComponent);
