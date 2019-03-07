import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import SocketActions from 'actions/socket';
import Input from 'rili-public-library/react-components/input';
import ButtonSecondary from 'rili-public-library/react-components/button-secondary';
import scrollTo from 'rili-public-library/utilities/scroll-to';
import { ISocketState } from '../redux/reducers/socket';
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
                    roomId: this.props.socket.currentRoom,
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

                <div id="roomTitle">Room Name: {this.props.socket.currentRoom}</div>
                <ul id="list"></ul>
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ChatRoomComponent));