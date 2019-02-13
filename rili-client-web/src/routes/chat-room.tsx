import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import * as io from 'socket.io-client';
import Input from 'rili-public-library/react-components/input';
// import SelectBox from 'rili-public-library/react-components/select-box';
import ButtonSecondary from 'rili-public-library/react-components/button-secondary';
import scrollTo from 'rili-public-library/utilities/scroll-to';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config.js';

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

enum ViewEnum {
    HOME = 'home',
    IN_ROOM = 'inRoom'
}

interface IChatRoomRouterProps {

}

interface IChatRoomProps extends RouteComponentProps<IChatRoomRouterProps> {
// Add your regular properties here
}

interface IChatRoomDispatchProps {
// Add your dispatcher properties here
}

interface IChatRoomState {
    hasJoinedARoom: boolean;
    inputs: any;
    roomsList: any;
    selectedRoomKey: string;
    view: ViewEnum;
}

/**
 * ChatRoom
 */
export class ChatRoomComponent extends React.Component<IChatRoomProps & IChatRoomDispatchProps, IChatRoomState> {
    private messageInputRef: any;
    // private sessionToken: string;
    private socket: any;

    private translate: Function;

    constructor(props: IChatRoomProps & IChatRoomDispatchProps) {
        super(props);

        this.state = {
            hasJoinedARoom: false,
            inputs: {
                roomName: 'general-chat'
            },
            roomsList: [],
            selectedRoomKey: '',
            view: ViewEnum.HOME,
        };

        this.messageInputRef = React.createRef();
        // this.sessionToken = '';
        this.socket = io(`${envVars.baseSocketUrl}`, {
            secure: true,
            transports: ['websocket'],
            upgrade: false
        });
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.onInputChange = this.onInputChange.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
        this.shouldDisableInput = this.shouldDisableInput.bind(this);
        this.socketEmit = this.socketEmit.bind(this);
    }

    componentDidMount() {
        document.title = 'Rili | ChatRoom';

        const addLi = (message: any) => {
            const listEl = document.getElementById('list');
            const li = document.createElement('li');
            li.appendChild(document.createTextNode(message));
            listEl.appendChild(li);
            scrollTo(listEl.scrollHeight, 200);
        };

        const updateRoomsList = (message: any) => {
            const roomsList = JSON.parse(message).map((room: any) => (room.roomKey));
            if (roomsList.length > 0) {
                document.getElementById('rooms_list').innerHTML = `Active Rooms: <i>${roomsList}</i>`;
            } else {
                document.getElementById('rooms_list').innerHTML = `<i>No rooms are currently active. Click 'Join Room' to start a new one.</i>`;
            }
        };

        const handleSessionUpdate = (message: any) => {
            console.log('SESSION_UPDATE:', message); // tslint:disable-line no-console
        };

        this.socket.on('event', addLi);
        this.socket.on('message', addLi);
        this.socket.on('rooms:list', updateRoomsList);
        this.socket.on('session:message', handleSessionUpdate);
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
        switch (event.target.id) {
            case 'say_hello':
                return this.socket.emit('event', {
                    roomName: this.state.inputs.roomName,
                    userName: this.state.inputs.userName
                });
            case 'enter_message':
            case 'message':
                this.socket.emit('event', {
                    roomName: this.state.inputs.roomName,
                    message: this.state.inputs.message,
                    userName: this.state.inputs.userName
                });
                return this.onInputChange('message', '');
            case 'join_room':
            case 'room_name':
            case 'user_name':
            if (!this.shouldDisableInput('room')) {
                return this.setState({
                    hasJoinedARoom: true,
                    view: ViewEnum.IN_ROOM
                }, () => {
                    if (this.messageInputRef.current && this.messageInputRef.current.inputEl) {
                        this.messageInputRef.current.inputEl.focus();
                    }
                    this.socket.emit('room.join', {
                        roomName: this.state.inputs.roomName,
                        userName: this.state.inputs.userName
                    });
                });
            }
        }
    }

    shouldDisableInput(buttonName: string) {
        switch (buttonName) {
            case 'room':
                return !this.state.inputs.roomName || !this.state.inputs.userName;
            case 'sayHello':
                return !this.state.hasJoinedARoom || !this.state.inputs.userName;
            case 'sendMessage':
                return !this.state.hasJoinedARoom || !this.state.inputs.message;
        }
    }

    socketEmit(eventType: string, data: any) {
        this.socket.emit(eventType, data);
    }

    render() {
        return (
            <div>
                <hr />

                <div className="form-field-wrapper inline">
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

                <div id="roomTitle">Room Name: {this.state.inputs.roomName}</div>
                <ul id="list"></ul>
            </div>
        );
    }
}

export default withRouter(ChatRoomComponent);