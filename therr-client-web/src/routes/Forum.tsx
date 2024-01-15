import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import classnames from 'classnames';
import randomColor from 'randomcolor';
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
import withNavigation from '../wrappers/withNavigation';

const userColors: any = {}; // local state

const verifyAndJoinForum = (props) => {
    // if (!props.location?.state || !props.routeParams?.roomId) {
    //     props.navigation.navigate('/create-forum');
    //     return;
    // }

    props.joinForum({
        roomId: props.routeParams?.roomId,
        roomName: (props.location?.state as any)?.roomName,
        userId: props.user.details.id,
        userName: props.user.details.userName,
        userImgSrc: `https://robohash.org/${props.user.details.id}`,
    });
};

const renderMessage = (message: IForumMsg, index, user: IUserState) => {
    const senderTitle = !message.isAnnouncement ? message.fromUserName : '';
    const isYou = message.fromUserName?.toLowerCase().includes('you');
    const yourColor = 'green';
    const timeSplit = message.time.split(', ');
    const msgClassNames = classnames({
        'forum-message': true,
        indented: message.isAnnouncement,
    });

    if (!userColors[message.fromUserName]) {
        userColors[message.fromUserName] = isYou ? yourColor : randomColor({
            luminosity: 'dark',
        });
    }

    const messageColor = isYou
        ? (userColors[message.fromUserName] || yourColor)
        : (userColors[message.fromUserName] || 'blue');

    return (
        <React.Fragment key={message.key}>
            {
                (index !== 0 && index % 10 === 0)
                    && <div className="forums-messages-date">{timeSplit[0]}</div>
            }
            <div
                className={msgClassNames}
                style={{
                    borderLeftColor: messageColor,
                }}
            >
                <div className="forum-message-user-image">
                    <img
                        src={`${message.fromUserImgSrc}?size=50x50`}
                        alt={`Profile Picture: ${user.details.userName}`}
                    />
                </div>
                <div className="forum-message-content-container">
                    <div className="forum-message-header">
                        {
                            !!senderTitle && <div className="sender-text">{senderTitle}</div>
                        }
                        <div className="forum-message-time">{timeSplit[1]}</div>
                    </div>
                    <div>{message.text}</div>
                </div>
            </div>
        </React.Fragment>
    );
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
    routeParams: IForumRouterProps
}

// Regular component props
interface IForumProps extends IStoreProps {
    location: any;
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
        if (nextState.isFirstLoad || nextProps.routeParams?.roomId !== nextState.previousRoomId) {
            verifyAndJoinForum(nextProps);

            return {
                isFirstLoad: false,
                previousRoomId: nextProps.routeParams?.roomId,
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
            previousRoomId: props.routeParams?.roomId,
        };

        this.messageInputRef = React.createRef();
        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const { isFirstLoad } = this.state;
        document.title = `Therr | ${this.translate('pages.chatForum.pageTitle')}`;
        this.messageInputRef.current.inputEl.focus();
        // if (isFirstLoad) {
        //     verifyAndJoinForum(this.props);
        // }
        verifyAndJoinForum(this.props);
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
            roomId: this.props.routeParams?.roomId,
            userName: this.props.user.details.userName,
            userImgSrc: `https://robohash.org/${this.props.user.details.id}`,
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
    };

    onButtonClick = (event: any) => {
        event.preventDefault();
        switch (event.target.id) {
            case 'enter_message':
            case 'message':
                this.props.sendForumMessage({
                    roomId: this.props.user.socketDetails.currentRoom,
                    message: this.state.inputs.message,
                    userId: this.props.user.details.id,
                    userName: this.props.user.details.userName,
                    userImgSrc: `https://robohash.org/${this.props.user.details.id}`,
                });
                return this.onInputChange('message', '');
            default:
        }
    };

    shouldDisableInput = (buttonName: string) => {
        switch (buttonName) {
            case 'sendForumMessage':
                return !this.state.inputs.message;
            default:
                return false;
        }
    };

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

                <h1 id="forumTitle">{this.translate('pages.chatForum.pageTitle')}: {(location.state as any)?.roomName || user.socketDetails.currentRoom}</h1>
                {
                    <div id="forums_list">
                        {
                            forumMessages && forumMessages.length > 0
                                ? <div className="message-list">
                                    {
                                        forumMessages.map((message: IForumMsg, index) => renderMessage(message, index, user))
                                    }
                                </div>
                                : <div>{this.translate('pages.chatForum.welcome')}</div>
                        }
                    </div>
                }
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ForumComponent));
