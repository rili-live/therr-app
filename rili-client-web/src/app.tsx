import * as React from 'react';
import * as io from 'socket.io-client';
import Input from 'rili-public-library/react-components/input'; // tslint:disable-line no-implicit-dependencies

interface IAppProps {

}

interface IAppState {

}

/**
 * App
 */
export default class App extends React.Component<IAppProps, IAppState> {
    private sessionToken: string;
    private socket: any;

    constructor(props: IAppProps) {
        super(props);

        this.sessionToken = '';
        this.socket = io('http://localhost:7771', {
            transports: ['websocket'],
            upgrade: false
        });
    }

    componentDidMount() {
        const roomInputEl = document.getElementById('room') as HTMLInputElement;
        const userNameInputEl = document.getElementById('user_name') as HTMLInputElement;
        const messageInputEl = document.getElementById('message') as HTMLInputElement;
        const joinRoomBtnEl = document.getElementById('join_room') as HTMLInputElement;
        const sayHelloBtnEl = document.getElementById('say_hello') as HTMLInputElement;
        const enterMessageBtnEl = document.getElementById('enter_message');

        if (joinRoomBtnEl) {
            joinRoomBtnEl.addEventListener('click', (e) => {
                this.socket.emit('room.join', {
                    roomName: roomInputEl.value,
                    userName: userNameInputEl.value
                });
            });
        }

        if (sayHelloBtnEl) {
            sayHelloBtnEl.addEventListener('click', (e) => {
                this.socket.emit('event', {
                    userName: userNameInputEl.value,
                    roomName: roomInputEl.value
                });
            });
        }

        if (enterMessageBtnEl) {
            enterMessageBtnEl.addEventListener('click', (e) => {
                this.socket.emit('event', {
                    userName: userNameInputEl.value,
                    message: messageInputEl.value,
                    roomName: roomInputEl.value
                });
            });
        }

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
    render() {
        return (
            <div>
                <label htmlFor="name">Username:</label>
                <input type="text" id="user_name" />
                <button id="say_hello">Say Hello!</button>
                <br />

                <label htmlFor="name">Message:</label>
                <input type="text" id="message" />
                <button id="enter_message">Enter a message!</button>
                <br />

                <label htmlFor="room">Room:</label>
                <input type="text" id="room" defaultValue="General Chat" />
                <button id="join_room">Join Room</button>
                <br />

                <ul id="list"></ul>
            </div>
        );
    }
}