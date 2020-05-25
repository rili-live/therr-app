import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { SocketActions } from 'rili-public-library/react/actions.js';
import Input from 'rili-public-library/react/Input.js';
import ButtonPrimary from 'rili-public-library/react/ButtonPrimary.js';
import scrollTo from 'rili-public-library/utilities/scroll-to.js';
import { IMessage, ISocketState } from 'types/socket';
import { IUserState } from 'types/user';
import translator from '../services/translator';
// import * as globalConfig from '../../../global-config.js';

// router params
interface IForumRouterProps {
    roomId: string;
}

interface IForumDispatchProps {
    joinForum: Function;
    leaveForum: Function;
    sendMessage: Function;
}

interface IStoreProps extends IForumDispatchProps {
    socket: ISocketState;
    user: IUserState;
}

// Regular component props
interface IForumProps extends RouteComponentProps<IForumRouterProps>, IStoreProps {
}

interface IForumState {
    inputs: any;
    previousRoomId: string;
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: IForumState | any) => ({
    socket: state.socket,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    joinForum: SocketActions.joinForum,
    leaveForum: SocketActions.leaveForum,
    sendMessage: SocketActions.sendMessage,
}, dispatch);

// TODO: Leaving a forume should emit an event to the server and leave the current forum
/**
 * Forum
 */
export class ForumComponent extends React.Component<IForumProps, IForumState> {
    static getDerivedStateFromProps(nextProps: IForumProps, nextState: IForumState) {
        if (nextProps.match.params.roomId !== nextState.previousRoomId) {
            nextProps.joinForum({
                roomId: nextProps.match.params.roomId,
                userName: nextProps.user.details.userName,
            });
            return {
                previousRoomId: nextProps.match.params.roomId,
            };
        }
        return {};
    }

    constructor(props: IForumProps) {
        super(props);

        this.state = {
            inputs: {},
            previousRoomId: props.match.params.roomId,
        };

        this.messageInputRef = React.createRef();
        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `Rili | ${this.translate('pages.chatForum.pageTitle')}`;
        this.messageInputRef.current.inputEl.focus();
        this.props.joinForum({
            roomId: this.props.match.params.roomId,
            userName: this.props.user.details.userName,
        });
    }

    componentDidUpdate(prevProps: IForumProps) {
        const currentRoom = this.props.user.socketDetails.currentRoom;
        const messages = this.props.socket.messages[currentRoom];
        if (messages && messages.length > 3 && messages.length > prevProps.socket.messages[currentRoom].length) {
            scrollTo(document.body.scrollHeight, 100);
        }
    }

    componentWillUnmount() {
        this.props.leaveForum({
            roomId: this.props.match.params.roomId,
            userName: this.props.user.details.userName,
        });
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
                    userName: this.props.user.details.userName,
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

        return (
            <div id="page_chat_forum">
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
                        placeholder={this.translate('pages.chatForum.inputPlaceholder')}
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

                <h1 id="forumTitle">{this.translate('pages.chatForum.pageTitle')}: {user.socketDetails.currentRoom}</h1>
                {
                    socket && socket.forums
                    && <span id="forums_list">
                        {
                            messages && messages.length > 0
                                ? <span className="message-list">
                                    {
                                        messages.map((message: IMessage) => <li key={message.key}>({message.time}) {message.text}</li>)
                                    }
                                </span>
                                : <span>{this.translate('pages.chatForum.welcome')}</span>
                        }
                    </span>
                }
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ForumComponent));
