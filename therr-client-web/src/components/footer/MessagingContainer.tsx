import * as React from 'react';
import { connect } from 'react-redux';
import {
    Input,
    SvgButton,
} from 'therr-react/components';
import { SocketActions } from 'therr-react/redux/actions';
import scrollTo from 'therr-js-utilities/scroll-to';
import { bindActionCreators } from 'redux';
import {
    IDirectMsg,
    IMessagesState,
    IUserState,
    IUserConnectionsState,
} from 'therr-react/types';
import translator from '../../services/translator';

export type IMessagingContext = any;
// export interface IMessagingContext {

// }

interface IMessagingContainerDispatchProps {
    sendDirectMessage: Function;
}

interface IStoreProps extends IMessagingContainerDispatchProps {
    messages: IMessagesState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IMessagingContainerProps extends IStoreProps {
    isMessagingOpen: boolean;
    isMsgContainerOpen: boolean;
    messagingContext: IMessagingContext;
    toggleMessaging: Function;
}

interface IMessagingContainerState {
    inputs: any;
    prevIsMsgContainerOpen: boolean;
    prevMessagingContext?: IMessagingContext;
}

const mapStateToProps = (state: any) => ({
    messages: state.messages,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    sendDirectMessage: SocketActions.sendDirectMessage,
}, dispatch);

export class MessagingContainerComponent extends React.Component<IMessagingContainerProps, IMessagingContainerState> {
    static getDerivedStateFromProps(nextProps: IMessagingContainerProps, nextState: IMessagingContainerState) {
        if (nextProps.messagingContext !== nextState.prevMessagingContext) {
            return {
                isMsgContainerOpen: true,
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

    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            inputs: {},
            prevIsMsgContainerOpen: false,
            prevMessagingContext: props.messagingContext,
        };

        this.messageInputRef = React.createRef();
        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount = () => {
        document.addEventListener('click', this.handleClick);
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

        if (this.shouldShowMessagingCtnr()) {
            this.messageInputRef.current.inputEl.focus();
            scrollDown();
        } else if (dms && dms.length > 3 && dms.length > prevMessages.length) {
            scrollDown();
        }
    }

    componentWillUnmount = () => {
        document.removeEventListener('click', this.handleClick);
    }

    onToggleMessaging = (e) => {
        this.props.toggleMessaging(e);
    }

    shouldDisableSubmit = (buttonName: string) => {
        switch (buttonName) {
            case 'sendMessaging':
                return !this.state.inputs.message;
            default:
                return false;
        }
    }

    shouldShowMessagingCtnr = () => {
        const { isMessagingOpen, isMsgContainerOpen } = this.props;

        return isMessagingOpen && isMsgContainerOpen;
    }

    handleClick = (event: any) => {
        if (this.props.isMsgContainerOpen) {
            const msgsMenuEl = document.getElementById('msgs_container');
            const footerMsgingEl = document.getElementById('footer_messaging');
            const footerMsgsEl = document.getElementById('footer_messages');
            const navMenuEl = document.getElementById('nav_menu');
            const userConEl = document.getElementById('user-connections-container');
            const isClickInsideNavMenu = msgsMenuEl.contains(event.target)
                || (navMenuEl && navMenuEl.contains(event.target))
                || (footerMsgingEl && footerMsgingEl.contains(event.target))
                || (userConEl && userConEl.contains(event.target))
                || (footerMsgsEl && footerMsgsEl.contains(event.target));

            if (!isClickInsideNavMenu) {
                this.onToggleMessaging(event);
            }
        }
    }

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };
        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    }

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
                to: toUser || messagingContext, // fallback for connections who were not active
            });
            this.onInputChange('message', '');
        }
    }

    render() {
        const {
            isMessagingOpen,
            messagingContext,
            messages,
        } = this.props;

        const contextFirstName = messagingContext && messagingContext.firstName;
        const contextLastName = messagingContext && messagingContext.lastName;
        const dms = messages.dms && messages.dms[messagingContext && messagingContext.id];
        const reversedDms = dms ? [...dms].reverse() : [];

        return (
            <>
                {
                    isMessagingOpen
                    && <SvgButton
                        id="footer_messaging"
                        name="people-alt,messages,world"
                        className="messaging-button"
                        onClick={this.onToggleMessaging}
                        buttonType="primary"
                    />
                }
                <div
                    id="msgs_container"
                    className={`messaging-container ${this.shouldShowMessagingCtnr() ? 'open' : ''}`}
                >
                    <div className="dms-header">
                        {this.translate('components.messagingContainer.conversation.to', { firstName: contextFirstName, lastName: contextLastName })}
                    </div>
                    {
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
                                    : <span className="dms-first-info">{this.translate('components.messagingContainer.welcome')}</span>
                            }
                        </span>
                    }
                    <div className="form-field-wrapper inline dms-input">
                        <Input
                            id="messaging_input"
                            ref={this.messageInputRef}
                            autoComplete="off"
                            type="text"
                            name="message"
                            value={this.state.inputs.message}
                            onChange={this.onInputChange}
                            onEnter={this.onSendMessage}
                            placeholder={this.translate('components.messagingContainer.inputPlaceholder')}
                            translate={this.translate}
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
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MessagingContainerComponent);
