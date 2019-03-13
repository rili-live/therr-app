import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import SocketActions from 'actions/socket';
import Input from 'rili-public-library/react-components/input';
import ButtonSecondary from 'rili-public-library/react-components/button-secondary';
import scrollTo from 'rili-public-library/utilities/scroll-to';
import { IMessage, ISocketState } from 'types/socket';
import translator from '../services/translator';
// import * as globalConfig from '../../../global-config.js';

interface IChatRoomRouterProps {

}

interface IChatRoomDispatchProps {
    sendMessage: Function;
}

interface IStoreProps extends IChatRoomDispatchProps {
    socket: ISocketState;
}

// Regular component props
interface IChatRoomProps extends RouteComponentProps<IChatRoomRouterProps>, IStoreProps {
}

interface IChatRoomState {
    inputs: any;
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: IChatRoomState | any) => {
    return {
        socket: state.socket,
    };
};

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        sendMessage: SocketActions.sendMessage,
    }, dispatch);
};

/**
 * ChatRoom
 */
export class ChatRoomComponent extends React.Component<IChatRoomProps, IChatRoomState> {
    private messageInputRef: any;
    // private sessionToken: string;
    private translate: Function;

    constructor(props: IChatRoomProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.messageInputRef = React.createRef();
        // this.sessionToken = '';
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.onInputChange = this.onInputChange.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
        this.shouldDisableInput = this.shouldDisableInput.bind(this);
    }

    componentDidMount() {
        document.title = 'Rili | Chat Room';
        this.messageInputRef.current.inputEl.focus();
        // TODO: RFRONT-15 - Fix this
        setTimeout(() => {
            if (!this.props.socket.user.currentRoom) {
                this.props.history.push('/');
            }
        }, 1000);
    }

    componentDidUpdate(prevProps: IChatRoomProps) {
        const currentRoom = this.props.socket.user.currentRoom;
        const messages = this.props.socket.messages[currentRoom];
        if (messages && messages.length > 3 && messages.length > prevProps.socket.messages[currentRoom].length) {
            window.scrollTo(0, document.body.scrollHeight);
        }
    }

    onInputChange(name: string, value: string) {
        const newInputChanges = {
            [name]: value,
        };
        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges
            }
        });
    }

    onButtonClick(event: any) {
        event.preventDefault();
        switch (event.target.id) {
            case 'enter_message':
            case 'message':
                this.props.sendMessage({
                    roomId: this.props.socket.user.currentRoom,
                    message: this.state.inputs.message,
                    userName: this.props.socket.user.userName,
                });
                return this.onInputChange('message', '');
        }
    }

    shouldDisableInput(buttonName: string) {
        switch (buttonName) {
            case 'sendMessage':
                return !this.state.inputs.message;
        }
    }

    render() {
        const { socket } = this.props;
        const messages = socket.messages[socket.user.currentRoom];

        return (
            <div>
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
                        <ButtonSecondary id="enter_message" text="Send" onClick={this.onButtonClick} disabled={this.shouldDisableInput('sendMessage')} />
                    </div>
                </div>

                <div id="roomTitle">Room Name: {socket.user.currentRoom}</div>
                {
                    socket && socket.rooms &&
                    <span id="rooms_list">
                        {
                            messages && messages.length > 0 ?
                            <span className="message-list">
                                {
                                    messages.map((message: IMessage) =>
                                        <li key={message.key}>({message.time}) {message.text}</li>
                                    )
                                }
                            </span> :
                            <span>Welcome!</span>
                        }
                    </span>
                }
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ChatRoomComponent));