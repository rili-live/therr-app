import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import {
    Input,
    ButtonPrimary,
} from 'rili-react/components';
import { ISocketState } from 'rili-react/types';
import translator from '../services/translator';
// import * as globalConfig from '../../../global-config';

interface ICreateForumRouterProps {
}

interface ICreateForumDispatchProps {
    joinForum: Function;
}

interface IStoreProps extends ICreateForumDispatchProps {
    socket: ISocketState;
}

// Regular component props
interface ICreateForumProps extends RouteComponentProps<ICreateForumRouterProps>, IStoreProps {
}

interface ICreateForumState {
    hasJoinedAForum: boolean;
    inputs: any;
    forumsList: any;
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: any) => ({
    socket: state.socket,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
}, dispatch);

// const handleSessionUpdate = (message: any) => {
//     console.log('SESSION_UPDATE:', message); // eslint-disable-line no-console
// };

/**
 * CreateForum
 */
export class CreateForumComponent extends React.Component<ICreateForumProps, ICreateForumState> {
    // private sessionToken: string;

    constructor(props: ICreateForumProps) {
        super(props);

        this.state = {
            hasJoinedAForum: false,
            inputs: {
                roomId: 'general-chat',
            },
            forumsList: [],
        };

        // this.sessionToken = '';
        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.createForum.pageTitle')}`;
    }

    private translate: Function;

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value.toLowerCase(),
        };
        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    }

    onButtonClick = (event: any) => {
        switch (event.target.id) {
            case 'join_forum':
            case 'forum_name':
            case 'user_name':
                if (!this.shouldDisableInput('forum')) {
                    this.props.history.push(`/forums/${this.state.inputs.roomId}`);
                }
                break;
            default:
        }
    }

    shouldDisableInput = (buttonName: string) => {
        switch (buttonName) {
            case 'forum':
                return !this.state.inputs.roomId;
            default:
                return false;
        }
    }

    public render(): JSX.Element | null {
        const { socket } = this.props;
        const activeForums = socket && socket.forums.length > 0 && socket.forums.map((forum: any) => forum.roomKey).toString();

        return (
            <div id="page_join_forum">
                <h1>{this.translate('pages.createForum.pageTitle')}</h1>
                <label htmlFor="forum_name">{this.translate('pages.createForum.labels.forum')}:</label>
                <Input
                    type="text"
                    id="forum_name"
                    name="roomId"
                    value={this.state.inputs.roomId}
                    onChange={this.onInputChange}
                    onEnter={this.onButtonClick}
                    translate={this.translate}
                />
                {
                    socket && socket.forums
                    && <span className="forums-list">
                        {
                            socket.forums.length < 1
                                ? <i>{this.translate('pages.createForum.noForumsMessage')}</i>
                                : <span>{this.translate('pages.createForum.labels.activeForums')}: <i>{activeForums}</i></span>
                        }
                    </span>
                }

                <div className="form-field text-right">
                    <ButtonPrimary
                        id="join_forum"
                        text="Join Forum"
                        onClick={this.onButtonClick}
                        disabled={this.shouldDisableInput('forum')}
                    />
                </div>
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CreateForumComponent));
