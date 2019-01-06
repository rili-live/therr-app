import * as React from 'react';
import * as io from 'socket.io-client';
import Input from 'rili-public-library/react-components/input'; // tslint:disable-line no-implicit-dependencies
import ButtonSecondary from 'rili-public-library/react-components/button-secondary'; // tslint:disable-line no-implicit-dependencies

interface IAppProps {

}

interface IAppState {
    hasJoinedARoom: boolean;
    inputs: any;
}

/**
 * App
 */
export default class App extends React.Component<IAppProps, IAppState> {
    private sessionToken: string;
    private socket: any;

    constructor(props: IAppProps) {
        super(props);

        this.state = {
            hasJoinedARoom: false,
            inputs: {},
        };

        this.sessionToken = '';
        this.socket = io('http://localhost:7771', {
            transports: ['websocket'],
            upgrade: false
        });

        this.onInputChange = this.onInputChange.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
        this.shouldDisableInput = this.shouldDisableInput.bind(this);
        this.socketEmit = this.socketEmit.bind(this);
    }

    componentDidMount() {
        const addLi = (message: any) => {
            const li = document.createElement('li');
            li.appendChild(document.createTextNode(message));
            document.getElementById('list').appendChild(li);
        };

        const handleSessionUpdate = (message: any) => {
            console.log('SESSION_UPDATE:', message); // tslint:disable-line
        };

        this.socket.on('event', addLi);
        this.socket.on('message', addLi);
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
                return this.socket.emit('event', {
                    roomName: this.state.inputs.roomName,
                    message: this.state.inputs.message,
                    userName: this.state.inputs.userName
                });
            case 'join_room':
                this.setState({
                    hasJoinedARoom: true,
                });

                return this.socket.emit('room.join', {
                    roomName: this.state.inputs.roomName,
                    userName: this.state.inputs.userName
                });
        }
    }

    shouldDisableInput(buttonName: string) {
        switch (buttonName) {
            case 'room':
                return !this.state.inputs.roomName || !this.state.inputs.userName;
            case 'sayHello':
                return !this.state.hasJoinedARoom || !this.state.inputs.userName;
            case 'sendMessage':
                return !this.state.hasJoinedARoom || !this.state.inputs.userName || !this.state.inputs.message;
        }
    }

    socketEmit(eventType: string, data: any) {
        this.socket.emit(eventType, data);
    }

    render() {
        return (
            <div>
                <label htmlFor="user_name">Username:</label>
                <Input type="text" id="user_name" name="userName" onChange={this.onInputChange} />
                <div className="form-field">
                    <ButtonSecondary id="say_hello" text="Say Hello!" onClick={this.onButtonClick} disabled={this.shouldDisableInput('sayHello')} />
                </div>

                <label htmlFor="message">Message:</label>
                <Input type="text" id="message" name="message" onChange={this.onInputChange} />
                <div className="form-field">
                    <ButtonSecondary id="enter_message" text="Enter a message!" onClick={this.onButtonClick} disabled={this.shouldDisableInput('sendMessage')} />
                </div>

                <label htmlFor="room_name">Room:</label>
                <Input type="text" id="room_name" name="roomName" defaultValue="General Chat" onChange={this.onInputChange} />
                <div className="form-field">
                    <ButtonSecondary id="join_room" text="Join Room" onClick={this.onButtonClick} disabled={this.shouldDisableInput('room')} />
                </div>

                <ul id="list"></ul>
            </div>
        );
    }
}