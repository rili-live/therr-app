import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import * as io from 'socket.io-client';
import Input from 'rili-public-library/react-components/input';
// import SelectBox from 'rili-public-library/react-components/select-box';
import ButtonSecondary from 'rili-public-library/react-components/button-secondary';
import scrollTo from 'rili-public-library/utilities/scroll-to';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config.js';

interface IChatRoomRouterProps {

}

interface IChatRoomProps extends RouteComponentProps<IChatRoomRouterProps> {
// Add your regular properties here
}

interface IChatRoomDispatchProps {
// Add your dispatcher properties here
}

interface IChatRoomState {
    inputs: any;
    selectedRoomKey: string;
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

const addLi = (message: any) => {
    const listEl = document.getElementById('list');
    const li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    listEl.appendChild(li);
    scrollTo(listEl.scrollHeight, 200);
};

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
            inputs: {},
            selectedRoomKey: '',
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
    }

    componentDidMount() {
        document.title = 'Rili | Chat Room';

        this.socket.on('event', addLi);
        this.socket.on('message', addLi);
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
            case 'enter_message':
            case 'message':
                this.socket.emit('event', {
                    roomName: this.state.inputs.roomName,
                    message: this.state.inputs.message,
                    userName: this.state.inputs.userName
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