import * as React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { SvgButton } from 'therr-react/components';
import { MantineInput } from 'therr-react/components/mantine';
import { SocketActions, MessageActions } from 'therr-react/redux/actions';
import scrollTo from 'therr-js-utilities/scroll-to';
import { bindActionCreators } from 'redux';
import {
    IDirectMsg,
    IMessagesState,
    IUserState,
    IUserConnectionsState,
} from 'therr-react/types';
import withTranslation from '../../wrappers/withTranslation';

export type IMessagingContext = any;

interface IMessagingContainerDispatchProps {
    searchMyDMs: Function;
    sendDirectMessage: Function;
}

interface IStoreProps extends IMessagingContainerDispatchProps {
    messages: IMessagesState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IMessagingContainerProps extends IStoreProps {
    isMsgContainerOpen: boolean;
    messagingContext: IMessagingContext;
    onInitMessaging: Function;
    toggleMessaging: Function;
    translate: (key: string, params?: Record<string, string>) => string;
}

interface IMessagingContainerState {
    inputs: any;
    isPanelOpen: boolean;
    prevIsMsgContainerOpen: boolean;
    prevMessagingContext?: IMessagingContext;
}

const mapStateToProps = (state: any) => ({
    messages: state.messages,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    searchMyDMs: MessageActions.searchMyDMs,
    sendDirectMessage: SocketActions.sendDirectMessage,
}, dispatch);

export class MessagingContainerComponent extends React.Component<IMessagingContainerProps, IMessagingContainerState> {
    static getDerivedStateFromProps(nextProps: IMessagingContainerProps, nextState: IMessagingContainerState) {
        if (nextProps.messagingContext !== nextState.prevMessagingContext) {
            return {
                isPanelOpen: true,
                prevIsMsgContainerOpen: true,
                prevMessagingContext: nextProps.messagingContext,
            };
        }
        if (nextProps.isMsgContainerOpen !== nextState.prevIsMsgContainerOpen) {
            return {
                prevIsMsgContainerOpen: nextProps.isMsgContainerOpen,
            };
        }
        return {};
    }

    private messageInputRef: any;

    private panelRef: any;

    constructor(props) {
        super(props);

        this.state = {
            inputs: {},
            isPanelOpen: false,
            prevIsMsgContainerOpen: false,
            prevMessagingContext: props.messagingContext,
        };

        this.messageInputRef = React.createRef();
        this.panelRef = React.createRef();
    }

    componentDidMount() {
        this.fetchRecentChats();
        document.addEventListener('mousedown', this.handleClickOutside);
    }

    componentDidUpdate(prevProps: IMessagingContainerProps) {
        const { messagingContext, messages } = this.props;
        const dms = (messages.dms && messages.dms[messagingContext && messagingContext.id]) || [];
        const prevMessages = (prevProps.messages.dms && prevProps.messages.dms[messagingContext && messagingContext.id]) || [];

        const scrollDown = () => {
            const dmElements = document.getElementsByClassName('dms-body');
            Array.from(dmElements).forEach((el) => {
                scrollTo(el.scrollHeight, 200, el);
            });
        };

        if (this.isConversationOpen()) {
            this.messageInputRef.current?.focus();
            scrollDown();
        } else if (dms && dms.length > 3 && dms.length > prevMessages.length) {
            scrollDown();
        }

        if (!prevProps.user?.isAuthenticated && this.props.user?.isAuthenticated) {
            this.fetchRecentChats();
        }
    }

    componentWillUnmount() { // eslint-disable-line class-methods-use-this
        document.removeEventListener('mousedown', this.handleClickOutside);
    }

    fetchRecentChats = () => {
        const { searchMyDMs, user } = this.props;

        if (user?.isAuthenticated) {
            searchMyDMs({
                itemsPerPage: 20,
                pageNumber: 1,
                order: 'desc',
            }, user.details);
        }
    };

    isConversationOpen = () => {
        const { isMsgContainerOpen, messagingContext } = this.props;
        return isMsgContainerOpen && messagingContext;
    };

    togglePanel = () => {
        const { isMsgContainerOpen, toggleMessaging } = this.props;
        const { isPanelOpen } = this.state;

        if (isPanelOpen && isMsgContainerOpen) {
            toggleMessaging(null, true);
        }

        this.setState({ isPanelOpen: !isPanelOpen });
    };

    handleClickOutside = (event: MouseEvent) => {
        if (
            this.state.isPanelOpen
            && this.panelRef.current
            && !this.panelRef.current.contains(event.target)
        ) {
            const { isMsgContainerOpen, toggleMessaging } = this.props;
            if (isMsgContainerOpen) {
                toggleMessaging(null, true);
            }
            this.setState({ isPanelOpen: false });
        }
    };

    handleBackToList = (e) => {
        this.props.toggleMessaging(e, true);
    };

    shouldDisableSubmit = (buttonName: string) => {
        switch (buttonName) {
            case 'sendMessaging':
                return !this.state.inputs.message;
            default:
                return false;
        }
    };

    onInputChange = (name: string, value: string) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: value,
            },
        });
    };

    onSendMessage = (event) => {
        if (!this.shouldDisableSubmit('sendMessaging')) {
            const {
                userConnections,
                messagingContext,
                sendDirectMessage,
                user,
            } = this.props;
            event.preventDefault();
            const toUser = userConnections.activeConnections.find((connection) => connection.id === messagingContext.id);
            sendDirectMessage({
                message: this.state.inputs.message,
                userId: user.details.id,
                userName: user.details.userName,
                to: toUser || messagingContext,
            });
            this.onInputChange('message', '');
        }
    };

    handleChatClick = (e, dm) => {
        const { onInitMessaging } = this.props;
        const connectionDetails = {
            id: dm.userDetails?.id,
            firstName: dm.userDetails?.firstName,
            lastName: dm.userDetails?.lastName,
            userName: dm.userDetails?.userName,
        };
        onInitMessaging(e, connectionDetails, 'recent-chats');
    };

    // eslint-disable-next-line class-methods-use-this
    getInitials = (firstName?: string, lastName?: string) => {
        const first = firstName ? firstName.charAt(0).toUpperCase() : '';
        const last = lastName ? lastName.charAt(0).toUpperCase() : '';
        return first + last || '?';
    };

    // eslint-disable-next-line class-methods-use-this
    truncateMessage = (message: string, maxLength = 40) => {
        if (!message) return '';
        return message.length > maxLength ? `${message.substring(0, maxLength)}...` : message;
    };

    renderRecentChats = () => {
        const { messages } = this.props;
        const recentChats = messages?.myDMs ? Object.values(messages.myDMs) : [];

        return (
            <div className="recent-chats-list">
                {recentChats.length > 0 ? (
                    recentChats.map((dm: any) => {
                        const firstName = dm.userDetails?.firstName;
                        const lastName = dm.userDetails?.lastName;

                        return (
                            <div
                                key={dm.id}
                                role="button"
                                tabIndex={0}
                                className="recent-chat-item"
                                onClick={(e) => this.handleChatClick(e, dm)}
                                onKeyDown={(e) => e.key === 'Enter' && this.handleChatClick(e, dm)}
                            >
                                <div className="chat-avatar">
                                    {this.getInitials(firstName, lastName)}
                                </div>
                                <div className="chat-info">
                                    <div className="chat-name">
                                        {firstName} {lastName}
                                    </div>
                                    <div className="chat-preview">
                                        {this.truncateMessage(dm.message)}
                                    </div>
                                </div>
                                <div className="chat-date">
                                    {dm.createdAtFormatted}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="recent-chats-empty">
                        {this.props.translate('components.messagingContainer.noRecentConversations')}
                    </div>
                )}
            </div>
        );
    };

    renderConversation = () => {
        const { messagingContext, messages } = this.props;

        const contextFirstName = messagingContext && messagingContext.firstName;
        const contextLastName = messagingContext && messagingContext.lastName;
        const dms = messages.dms && messages.dms[messagingContext && messagingContext.id];
        const reversedDms = dms ? [...dms].reverse() : [];

        return (
            <div id="msgs_container" className="messaging-conversation">
                <div className="dms-header">
                    <button type="button" className="back-button" onClick={this.handleBackToList}>
                        &larr;
                    </button>
                    <Link to={`/users/${messagingContext?.id}`}>
                        {this.props.translate('components.messagingContainer.conversation.to', { firstName: contextFirstName, lastName: contextLastName })}
                    </Link>
                </div>
                <span className="dms-body">
                    {
                        reversedDms && reversedDms.length > 0
                            ? <ul className="dms-list">
                                {
                                    reversedDms.map((message: IDirectMsg) => {
                                        const className = message.fromUserName && message.fromUserName.toLowerCase().includes('you')
                                            ? 'dm-item message-left'
                                            : 'dm-item message-right';
                                        return (
                                            <li className={className} key={message.key}>
                                                <span className="dm-message">{message.text}</span>
                                                <span className="dm-date">({message.time})</span>
                                            </li>
                                        );
                                    })
                                }
                            </ul>
                            : <span className="dms-first-info">{this.props.translate('components.messagingContainer.welcome')}</span>
                    }
                </span>
                <div className="form-field-wrapper inline dms-input">
                    <MantineInput
                        id="messaging_input"
                        ref={this.messageInputRef}
                        autoComplete="off"
                        type="text"
                        name="message"
                        value={this.state.inputs.message}
                        onChange={this.onInputChange}
                        onEnter={this.onSendMessage}
                        placeholder={this.props.translate('components.messagingContainer.inputPlaceholder')}
                        translateFn={this.props.translate}
                    />
                    <div className="form-field">
                        <SvgButton
                            id="messaging_send"
                            name="send"
                            onClick={this.onSendMessage}
                            disabled={this.shouldDisableSubmit('sendMessaging')}
                            iconClassName="send-icon"
                            buttonType="primary"
                        />
                    </div>
                </div>
            </div>
        );
    };

    render() {
        const { isPanelOpen } = this.state;
        const showConversation = this.isConversationOpen();

        return (
            <div ref={this.panelRef} className={`messaging-panel ${isPanelOpen ? 'is-open' : ''}`}>
                <button
                    type="button"
                    id="footer_messaging"
                    className="messaging-panel-header"
                    onClick={this.togglePanel}
                >
                    <span className="messaging-panel-title">
                        {this.props.translate('components.messagingContainer.panelTitle')}
                    </span>
                    <span className={`chevron ${isPanelOpen ? 'down' : 'up'}`} />
                </button>
                {isPanelOpen && (
                    <div className="messaging-panel-body">
                        {showConversation
                            ? this.renderConversation()
                            : this.renderRecentChats()}
                    </div>
                )}
            </div>
        );
    }
}

export default withTranslation(connect(mapStateToProps, mapDispatchToProps)(MessagingContainerComponent));
