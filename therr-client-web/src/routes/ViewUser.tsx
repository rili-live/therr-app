/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import translator from '../services/translator';
import LoginForm from '../components/forms/LoginForm';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import getUserImageUri from '../utilities/getUserImageUri';

interface IViewUserRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        userId: string;
    }
}

interface IViewUserDispatchProps {
    login: Function;
    getUser: Function;
}

interface IStoreProps extends IViewUserDispatchProps {
    content: IContentState;
    user: IUserState;
}

// Regular component props
interface IViewUserProps extends IViewUserRouterProps, IStoreProps {
}

interface IViewUserState {
    userId: string;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUser: UsersActions.get,
}, dispatch);

/**
 * ViewUser
 */
export class ViewUserComponent extends React.Component<IViewUserProps, IViewUserState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: IViewUserProps) {
        if (!nextProps.routeParams.userId) {
            // TODO: This doesn't seem to work with react-router-dom v6 after a newly created user tries to login
            // Causes a flicker / Need to investigate further
            setTimeout(() => nextProps.navigation.navigate('/'));
            return null;
        }
        return {};
    }

    constructor(props: IViewUserProps) {
        super(props);

        this.state = {
            userId: props.routeParams.userId,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { getUser, user } = this.props;
        const { userId } = this.state;
        const userInView = user.userInView;

        if (!userInView) {
            getUser(this.state.userId).then((fetchedUser) => {
                document.title = `${fetchedUser?.settingsBio} | Therr App`;
            }).catch((err) => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${userInView.settingsBio} | Therr App`;
        }
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        const { user } = this.props;
        const { userId } = this.state;
        const userInView = user.userInView;
        const userImageUri = getUserImageUri(user);

        return (
            <div id="page_view_moment" className="flex-box space-evenly center row wrap-reverse">
                <div className="login-container info-container">
                    {
                        userInView
                            && <div className="flex fill max-wide-40">
                                <h1 className="text-title-medium no-bot-margin fill">
                                    {`${userInView.firstName} ${userInView.lastName}`}
                                </h1>
                                <p className="info-text fill">{userInView?.settingsBio}</p>
                            </div>
                    }
                </div>
                <div className="login-container info-container">
                    {
                        userInView
                            && <div className="flex fill max-wide-30">
                                <div className="moment-image-container">
                                    {userImageUri
                                    && <img
                                        className="moment-image"
                                        src={userImageUri}
                                        alt={`${userInView.firstName} ${userInView.lastName}`}
                                    />}
                                </div>
                            </div>
                    }
                </div>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ViewUserComponent));
