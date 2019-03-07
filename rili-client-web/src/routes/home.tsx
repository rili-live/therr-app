import SocketActions from 'actions/socket';
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import Input from 'rili-public-library/react-components/input';
import ButtonSecondary from 'rili-public-library/react-components/button-secondary';
import { ISocketState } from '../redux/reducers/socket';
import translator from '../services/translator';
// import * as globalConfig from '../../../global-config.js';

interface IHomeRouterProps {
}

interface IHomeDispatchProps {
    joinRoom: Function;
}

interface IStoreProps extends IHomeDispatchProps {
    socket: ISocketState;
}

// Regular component props
interface IHomeProps extends RouteComponentProps<IHomeRouterProps>, IStoreProps {
}

interface IHomeState {
    hasJoinedARoom: boolean;
    inputs: any;
    roomsList: any;
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: IHomeState | any) => {
    return {
        socketEvent: state.socketEvent,
    };
};

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        joinRoom: SocketActions.joinRoom,
    }, dispatch);
};

// const handleSessionUpdate = (message: any) => {
//     console.log('SESSION_UPDATE:', message); // tslint:disable-line no-console
// };

/**
 * Home
 */
export class HomeComponent extends React.Component<IHomeProps, IHomeState> {
    // private sessionToken: string;
    private translate: Function;

    constructor(props: IHomeProps) {
        super(props);

        this.state = {
            hasJoinedARoom: false,
            inputs: {
                roomId: 'general-chat'
            },
            roomsList: [],
        };

        // this.sessionToken = '';
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.onInputChange = this.onInputChange.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
        this.shouldDisableInput = this.shouldDisableInput.bind(this);
    }

    componentDidMount() {
        document.title = 'Rili | Home';
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
            case 'join_room':
            case 'room_name':
            case 'user_name':
            if (!this.shouldDisableInput('room')) {
                this.props.joinRoom({
                    roomId: this.state.inputs.roomId,
                    userName: this.state.inputs.userName
                });
                this.props.history.push('/chat-room');
            }
        }
    }

    shouldDisableInput(buttonName: string) {
        switch (buttonName) {
            case 'room':
                return !this.state.inputs.roomId || !this.state.inputs.userName;
        }
    }

    public render(): JSX.Element | null {
        const { socket } = this.props;

        return (
            <div>
                <hr />

                <label htmlFor="user_name">Username:</label>
                <Input type="text" id="user_name" name="userName" onChange={this.onInputChange} onEnter={this.onButtonClick} translate={this.translate} />

                <label htmlFor="room_name">Room:</label>
                <Input type="text" id="room_name" name="roomId" value={this.state.inputs.roomId} onChange={this.onInputChange} onEnter={this.onButtonClick} translate={this.translate} />
                {
                    socket && socket.rooms &&
                    <span id="rooms_list">
                        {
                            socket.rooms.length < 1
                                ? <i>No rooms are currently active. Click 'Join Room' to start a new one.</i>
                                : <span>Active Rooms: <i>{socket.rooms.toString()}</i></span>
                        }
                    </span>
                }
                <br />

                <div className="form-field">
                    <ButtonSecondary id="join_room" text="Join Room" onClick={this.onButtonClick} disabled={this.shouldDisableInput('room')} />
                </div>
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(HomeComponent));