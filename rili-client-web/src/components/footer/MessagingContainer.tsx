import * as React from 'react';
import { connect } from 'react-redux';
import {
    Input,
    SvgButton,
} from 'rili-react/components';
import { SocketActions } from 'rili-react/redux/actions';
import scrollTo from 'rili-js-utilities/scroll-to';
import { bindActionCreators } from 'redux';
import {
    IMessage,
    ISocketState,
    IUserState,
    IUserConnectionsState,
} from 'rili-react/types';
import translator from '../../services/translator';

export type IMessagingContext = any;
// export interface IMessagingContext {

// }

interface IMessagingContainerDispatchProps {
    sendDirectMessage: Function;
}

interface IStoreProps extends IMessagingContainerDispatchProps {
    socket: ISocketState;
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
    socket: state.socket,
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
        const { messagingContext, socket } = this.props;
        const messages = socket.dms && socket.dms[messagingContext && messagingContext.id];
        const prevMessages = prevProps.socket.dms && prevProps.socket.dms[messagingContext && messagingContext.id];

        const scrollDown = () => {
            const dmElements = document.getElementsByClassName('dms-body');
            Array.from(dmElements).forEach((el) => {
                scrollTo(el.scrollHeight, 200, el);
            });
        };

        if (this.shouldShowMessagingCtnr()) {
            this.messageInputRef.current.inputEl.focus();
            scrollDown();
        } else if (messages && messages.length > 3 && messages.length > prevMessages.length) {
            scrollDown();
        }
    }

    componentWillUnmount = () => {
        document.removeEventListener('click', this.handleClick);
    }

    private messageInputRef: any;

    private translate: Function;

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
            const isClickInsideNavMenu = msgsMenuEl.contains(event.target)
                || document.getElementById('nav_menu').contains(event.target)
                || document.getElementById('footer_messaging').contains(event.target)
                || document.getElementById('footer_messages').contains(event.target);

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
                to: toUser,
            });
            this.onInputChange('message', '');
        }
    }

    render() {
        const {
            isMessagingOpen,
            messagingContext,
            socket,
        } = this.props;

        const contextFirstName = messagingContext && messagingContext.firstName;
        const contextLastName = messagingContext && messagingContext.lastName;
        const messages = socket.dms && socket.dms[messagingContext && messagingContext.id];

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
                                messages && messages.length > 0
                                    ? <ul className="dms-list">
                                        {
                                            messages.map((message: IMessage) => <li key={message.key}>({message.time}) {message.text}</li>)
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
