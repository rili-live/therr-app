import * as React from 'react';
import { connect } from 'react-redux';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
import { IUserState } from 'types/user';
import SocketActions from 'actions/Socket';
import { bindActionCreators } from 'redux';

interface IMessagesMenuDispatchProps {
    logout: Function;
}

interface IStoreProps extends IMessagesMenuDispatchProps {
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
    logout: SocketActions.logout,
}, dispatch);

export class MessagesMenuComponent extends React.Component<IMessagesMenuProps, IMessagesMenuState> {
    constructor(props) {
        super(props);

        this.state = {
            activeTab: 'messages',
        };
    }

    handleTabSelect = (e, tabName) => {
        this.setState({
            activeTab: tabName,
        });
    }

    renderMessagesContent = () => (
        <>
            <h2>Messages</h2>
        </>
    )

    renderPeopleContent = () => (
        <>
            <h2>Rili Connect</h2>
        </>
    )

    renderLocationContent = () => (
        <>
            <h2>Locations Map</h2>
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
