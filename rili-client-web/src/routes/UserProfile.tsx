import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary.js';
import Input from 'rili-public-library/react-components/Input.js';
import SelectBox from 'rili-public-library/react-components/SelectBox.js';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
import { IUserState } from 'types/user';
import { IUserConnectionsState } from 'types/userConnections';
import UserConnectionActions from 'actions/UserConnections';
import translator from '../services/translator';
import UserConnectionsService from '../services/UserConnectionsService';

// interface IUserProfileRouterProps {
// }

interface IUserProfileDispatchProps {
    searchUserConnections: Function;
}

interface IStoreProps extends IUserProfileDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IUserProfileProps extends RouteComponentProps<{}>, IStoreProps {
}

interface IUserProfileState {
    inputs: any;
    hasValidationErrors: boolean;
    prevRequestError: string;
    prevRequestSuccess: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    searchUserConnections: UserConnectionActions.search,
}, dispatch);

/**
 * UserProfile
 */
export class UserProfileComponent extends React.Component<IUserProfileProps, IUserProfileState> {
    private translate: Function; // eslint-disable-line react/sort-comp

    constructor(props: IUserProfileProps) {
        super(props);

        this.state = {
            hasValidationErrors: true,
            inputs: {
                connectionIdentifier: '',
                phoneNumber: '',
            },
            prevRequestError: '',
            prevRequestSuccess: '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            user,
        } = this.props;
        document.title = `Rili | ${this.translate('pages.userProfile.pageTitle')} | ${user.details.userName}`;
        // TODO: RSERV-25 - Make this one Db request
        this.props.searchUserConnections({
            filterBy: 'acceptingUserId',
            query: user.details.id,
            itemsPerPage: 20,
            pageNumber: 1,
        });
        this.props.searchUserConnections({
            filterBy: 'requestingUserId',
            query: user.details.id,
            itemsPerPage: 20,
            pageNumber: 1,
        });
    }

    isFormValid() {
        const { hasValidationErrors, inputs } = this.state;
        return !hasValidationErrors
            && ((inputs.connectionIdentifier === 'acceptingUserPhoneNumber' && !!inputs.phoneNumber)
                || (inputs.connectionIdentifier === 'acceptingUserEmail' && !!inputs.email));
    }

    onJoinRoomClick = () => {
        this.props.history.push('/join-room');
    }

    onSubmit = (event: any) => {
        if (this.isFormValid()) {
            const { inputs } = this.state;
            const { user } = this.props;
            const reqBody: any = {
                requestingUserId: user.details.id,
                requestingUserFirstName: user.details.firstName,
                requestingUserLastName: user.details.lastName,
            };
            if (this.state.inputs.connectionIdentifier === 'acceptingUserEmail') {
                reqBody.acceptingUserEmail = inputs.email;
            }
            if (this.state.inputs.connectionIdentifier === 'acceptingUserPhoneNumber') {
                reqBody.acceptingUserPhoneNumber = inputs.phoneNumber;
            }

            UserConnectionsService.create(reqBody)
                .then((response) => {
                    this.setState({
                        inputs: {
                            connectionIdentifier: '',
                            phoneNumber: '',
                        },
                        prevRequestSuccess: this.translate('pages.userProfile.connectionSent'),
                    });
                })
                .catch((error) => {
                    if (error.statusCode === 400 || error.statusCode === 404) {
                        this.setState({
                            prevRequestError: error.message,
                        });
                    }
                });
        }
    };

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };
        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            prevRequestError: '',
            prevRequestSuccess: '',
        });
    }

    onValidateInput = (validations: any) => {
        const hasValidationErrors = !!Object.keys(validations).filter((key) => validations[key].length).length;
        this.setState({
            hasValidationErrors,
        });
    }

    public render(): JSX.Element | null {
        const { user, userConnections } = this.props;
        const { inputs, prevRequestError, prevRequestSuccess } = this.state;

        if (!user.details) {
            return null;
        }

        return (
            <div id="page_user_profile" className="flex-box column">
                <div className="header-profile-picture">
                    <h1 className="fill text-left">{user.details.userName}</h1>
                    <div className="user-profile-icon">
                        <img
                            src={`https://robohash.org/${user.details.id}?size=100x100`}
                            alt="Profile Picture"
                        />
                    </div>
                </div>
                <div className="flex-box account-sections">
                    <div id="account_details" className="account-section">
                        <h2 className="underline desktop-only block">{this.translate('pages.userProfile.h2.accountDetails')}</h2>
                        <div className="account-section-content">
                            <h4><b>{this.translate('pages.userProfile.labels.firstName')}:</b> {user.details.firstName}</h4>
                            <h4><b>{this.translate('pages.userProfile.labels.lastName')}:</b> {user.details.lastName}</h4>
                            <h4><b>{this.translate('pages.userProfile.labels.userName')}:</b> {user.details.userName}</h4>
                            <h4><b>{this.translate('pages.userProfile.labels.email')}:</b> {user.details.email}</h4>
                            <h4><b>{this.translate('pages.userProfile.labels.phone')}:</b> {user.details.phoneNumber}</h4>
                        </div>
                    </div>
                    <div id="your_connections" className="account-section">
                        <h2 className="underline">{this.translate('pages.userProfile.h2.connections')}</h2>
                        <div className="user-connections-container account-section-content">
                            {
                                userConnections.connections.length
                                    ? userConnections.connections.slice(0, 10).map((connection: any) => (
                                        <div className="user-connection-icon" key={connection.id}>
                                            {/* <span className="name-tag">{connection.firstName}</span> */}
                                            <img
                                                src={`https://robohash.org/${connection.acceptingUserId === user.details.id
                                                    ? connection.requestingUserId
                                                    : connection.acceptingUserId}?size=100x100`}
                                                alt="User Connection"
                                            />
                                        </div>
                                    ))
                                    : <span><i>{this.translate('pages.userProfile.requestRecommendation')}</i></span>
                            }
                        </div>
                    </div>
                    <div id="add_connections" className="account-section">
                        <h2 className="underline">{this.translate('pages.userProfile.h2.addConnection')}</h2>
                        <div className="account-section-content">
                            <SelectBox
                                type="text"
                                id="connection_identifier"
                                name="connectionIdentifier"
                                value={this.state.inputs.connectionIdentifier}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translate={this.translate}
                                options={[
                                    {
                                        text: this.translate('pages.userProfile.labels.phoneNumber'),
                                        value: 'acceptingUserPhoneNumber',
                                    },
                                    {
                                        text: this.translate('pages.userProfile.labels.email'),
                                        value: 'acceptingUserEmail',
                                    },
                                ]}
                                placeHolderText="Choose an identifier..."
                                validations={['isRequired']}
                            />
                            {
                                inputs.connectionIdentifier === 'acceptingUserPhoneNumber'
                                && <>
                                    <label className="required" htmlFor="phone_number">{this.translate('pages.userProfile.labels.phoneNumber')}:</label>
                                    <Input
                                        type="text"
                                        id="phone_number"
                                        name="phoneNumber"
                                        value={this.state.inputs.phoneNumber}
                                        onChange={this.onInputChange}
                                        onEnter={this.onSubmit}
                                        translate={this.translate}
                                        validations={['isRequired', 'mobilePhoneNumber']}
                                        onValidate={this.onValidateInput}
                                    />
                                </>
                            }
                            {
                                inputs.connectionIdentifier === 'acceptingUserEmail'
                                && <>
                                    <label className="required" htmlFor="email">{this.translate('pages.userProfile.labels.email')}:</label>
                                    <Input
                                        type="text"
                                        id="email"
                                        name="email"
                                        value={this.state.inputs.email}
                                        onChange={this.onInputChange}
                                        onEnter={this.onSubmit}
                                        translate={this.translate}
                                        validations={['isRequired', 'email']}
                                        onValidate={this.onValidateInput}
                                    />
                                </>
                            }
                            {
                                prevRequestSuccess
                                && <div className="text-center alert-success">{prevRequestSuccess}</div>
                            }
                            {
                                prevRequestError
                                && <div className="text-center alert-error backed padding-sm margin-bot-sm">{prevRequestError}</div>
                            }
                            <div className="form-field text-right">
                                <SvgButton
                                    id="send_request"
                                    name="send"
                                    onClick={this.onSubmit} disabled={!this.isFormValid()} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="fill text-right padding-sm">
                    <button type="button" className="primary text-white" onClick={this.onJoinRoomClick}>
                        {this.translate('pages.userProfile.buttons.joinARoom')}
                    </button>
                </div>
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(UserProfileComponent));
