import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { SocketActions } from 'therr-react/redux/actions';
import {
    Input,
    ButtonPrimary,
} from 'therr-react/components';
import scrollTo from 'therr-js-utilities/scroll-to';
import {
    IForumMsg,
    IMessagesState,
    IUserState,
} from 'therr-react/types';
import translator from '../services/translator';

const verifyAndJoinForum = (props) => {
    if (!props.location?.state || !props.match.params?.roomId) {
        props.history.push('/create-forum');
        return;
    }

    props.joinForum({
        roomId: props.match.params.roomId,
        roomName: (props.location?.state as any)?.roomName,
        userName: props.user.details.userName,
    });
};

// router params
interface IForumRouterProps {
    roomName: string;
    roomId: string;
}

interface IForumDispatchProps {
    joinForum: Function;
    leaveForum: Function;
    sendForumMessage: Function;
}

interface IStoreProps extends IForumDispatchProps {
    messages: IMessagesState;
    user: IUserState;
}

// Regular component props
interface IForumProps extends RouteComponentProps<IForumRouterProps>, IStoreProps {
}

interface IForumState {
    inputs: any;
    isFirstLoad: boolean;
    previousRoomId: string;
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: IForumState | any) => ({
    messages: state.messages,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    joinForum: SocketActions.joinForum,
    leaveForum: SocketActions.leaveForum,
    sendForumMessage: SocketActions.sendForumMessage,
}, dispatch);

// TODO: Leaving a forum should emit an event to the server and leave the current forum
/**
 * Forum
 */
export class ForumComponent extends React.Component<IForumProps, IForumState> {
    static getDerivedStateFromProps(nextProps: IForumProps, nextState: IForumState) {
        if (nextState.isFirstLoad || nextProps.match.params.roomId !== nextState.previousRoomId) {
            verifyAndJoinForum(nextProps);

            return {
                isFirstLoad: false,
                previousRoomId: nextProps.match.params.roomId,
            };
        }
        return {};
    }

    private messageInputRef: any;

    private translate: Function;

    // private sessionToken: string;

    constructor(props: IForumProps) {
        super(props);

        this.state = {
            inputs: {},
            isFirstLoad: true,
            previousRoomId: props.match.params.roomId,
        };

        this.messageInputRef = React.createRef();
        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const { isFirstLoad } = this.state;
        document.title = `Therr | ${this.translate('pages.chatForum.pageTitle')}`;
        this.messageInputRef.current.inputEl.focus();
        if (isFirstLoad) {
            verifyAndJoinForum(this.props);
        }
    }

    componentDidUpdate(prevProps: IForumProps) {
        const currentRoom = this.props.user.socketDetails.currentRoom;
        const messages = this.props.messages.forumMsgs[currentRoom];
        if (messages && messages.length > 3 && messages.length > prevProps.messages.forumMsgs[currentRoom].length) {
            scrollTo(document.body.scrollHeight, 100);
        }
    }

    componentWillUnmount() {
        this.props.leaveForum({
            roomId: this.props.match.params.roomId,
            userName: this.props.user.details.userName,
        });
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

    onButtonClick = (event: any) => {
        event.preventDefault();
        switch (event.target.id) {
            case 'enter_message':
            case 'message':
                this.props.sendForumMessage({
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
            case 'sendForumMessage':
                return !this.state.inputs.message;
            default:
                return false;
        }
    }

    render() {
        const { location, messages, user } = this.props;
        const forumMessages = messages.forumMsgs[user.socketDetails.currentRoom];

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
                            disabled={this.shouldDisableInput('sendForumMessage')}
                        />
                    </div>
                </div>

                <h1 id="forumTitle">{this.translate('pages.chatForum.pageTitle')}: {(location.state as any).roomName || user.socketDetails.currentRoom}</h1>
                {
                    <span id="forums_list">
                        {
                            forumMessages && forumMessages.length > 0
                                ? <span className="message-list">
                                    {
                                        forumMessages.map((message: IForumMsg) => <li key={message.key}>({message.time}) {message.text}</li>)
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
