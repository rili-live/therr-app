import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import SocketActions from 'actions/Socket';
import Input from 'rili-public-library/react-components/Input.js';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary.js';
import scrollTo from 'rili-public-library/utilities/scroll-to.js';
import { IMessage, ISocketState } from 'types/socket';
import { IUserState } from 'types/user';
import translator from '../services/translator';
// import * as globalConfig from '../../../global-config.js';

// router params
interface IChatRoomRouterProps {
    roomId: string;
}

interface IChatRoomDispatchProps {
    joinRoom: Function;
    sendMessage: Function;
}

interface IStoreProps extends IChatRoomDispatchProps {
    socket: ISocketState;
    user: IUserState;
}

// Regular component props
interface IChatRoomProps extends RouteComponentProps<IChatRoomRouterProps>, IStoreProps {
}

interface IChatRoomState {
    inputs: any;
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: IChatRoomState | any) => ({
    socket: state.socket,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    joinRoom: SocketActions.joinRoom,
    sendMessage: SocketActions.sendMessage,
}, dispatch);

const shouldRender = (props: IChatRoomProps) => !!props.user;

// TODO: Leaving a roome should emit an event to the server and leave the current room
/**
 * ChatRoom
 */
export class ChatRoomComponent extends React.Component<IChatRoomProps, IChatRoomState> {
    static getDerivedStateFromProps(nextProps: IChatRoomProps) {
        if (!shouldRender(nextProps)) {
            nextProps.history.push('/login');
            return null;
        }
        return {};
    }

    constructor(props: IChatRoomProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.messageInputRef = React.createRef();
        // this.sessionToken = '';
        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `Rili | ${this.translate('pages.chatRoom.pageTitle')}`;
        if (shouldRender(this.props)) {
            this.messageInputRef.current.inputEl.focus();
            this.props.joinRoom({
                roomId: this.props.match.params.roomId,
                userName: this.props.user.details.userName,
            });
        }
    }

    componentDidUpdate(prevProps: IChatRoomProps) {
        const currentRoom = this.props.user.socketDetails.currentRoom;
        const messages = this.props.socket.messages[currentRoom];
        if (messages && messages.length > 3 && messages.length > prevProps.socket.messages[currentRoom].length) {
            scrollTo(document.body.scrollHeight, 100);
        }
    }

    private messageInputRef: any;

    private translate: Function;

    // private sessionToken: string;

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

    onButtonClick = (event: any) => {
        event.preventDefault();
        switch (event.target.id) {
            case 'enter_message':
            case 'message':
                this.props.sendMessage({
                    roomId: this.props.user.socketDetails.currentRoom,
                    message: this.state.inputs.message,
                    userName: this.props.user.socketDetails.session.userName,
                });
                return this.onInputChange('message', '');
            default:
        }
    }

    shouldDisableInput = (buttonName: string) => {
        switch (buttonName) {
            case 'sendMessage':
                return !this.state.inputs.message;
            default:
                return false;
        }
    }

    render() {
        const { socket, user } = this.props;
        const messages = socket.messages[user.socketDetails.currentRoom];

        if (!shouldRender(this.props)) {
            return null;
        }

        return (
            <div id="page_chat_room">
                <div className="form-field-wrapper inline message-input">
                    <Input
                        ref={this.messageInputRef}
                        autoComplete="off"
                        type="text"
                        id="message"
                        name="message"
                        value={this.state.inputs.message}
                        onChange={this.onInputChange}
                        onEnter={this.onButtonClick}
                        placeholder="Enter a message"
                        translate={this.translate}
                    />
                    <div className="form-field">
                        <ButtonPrimary
                            id="enter_message"
                            text="Send"
                            onClick={this.onButtonClick}
                            disabled={this.shouldDisableInput('sendMessage')}
                        />
                    </div>
                </div>

                <h1 id="roomTitle">{this.translate('pages.chatRoom.pageTitle')}: {user.socketDetails.currentRoom}</h1>
                {
                    socket && socket.rooms
                    && <span id="rooms_list">
                        {
                            messages && messages.length > 0
                                ? <span className="message-list">
                                    {
                                        messages.map((message: IMessage) => <li key={message.key}>({message.time}) {message.text}</li>)
                                    }
                                </span>
                                : <span>{this.translate('pages.chatRoom.welcome')}</span>
                        }
                    </span>
                }
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ChatRoomComponent));
