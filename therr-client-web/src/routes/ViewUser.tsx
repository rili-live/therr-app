/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import translator from '../services/translator';
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
                document.title = `${fetchedUser?.firstName} ${fetchedUser?.lastName} | Therr App`;
            }).catch((err) => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${userInView.firstName} ${userInView?.lastName} | Therr App`;
        }
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        const { user } = this.props;
        const { userId } = this.state;
        const userInView = user.userInView;
        const userImageUri = getUserImageUri({
            details: userInView,
        }, 480);

        return (
            <div id="page_view_moment" className="flex-box space-evenly center row wrap-reverse">
                <div className="login-container info-container">
                    {
                        userInView
                            && <div className="flex fill max-wide-40">
                                <h1 className="text-title-medium no-bot-margin fill">
                                    {`${userInView.firstName} ${userInView.lastName}`}
                                </h1>
                                <h2>
                                    Username: {userInView.userName}
                                </h2>
                                <p className="info-text fill">{userInView?.settingsBio}</p>
                                <div className="flex-box row">
                                    {
                                        userInView?.socialSyncs?.tiktok?.link
                                        && <h3 className="text-title-small no-bot-margin fill">
                                            <a href={userInView?.socialSyncs?.tiktok?.link} target="_blank">TikTok</a>
                                        </h3>
                                    }
                                    {
                                        userInView?.socialSyncs?.twitter?.link
                                            && <h3 className="text-title-small no-bot-margin fill">
                                                <a href={userInView?.socialSyncs?.twitter?.link} target="_blank">Twitter</a>
                                            </h3>
                                    }
                                    {
                                        userInView?.socialSyncs?.youtube?.link
                                            && <h3 className="text-title-small no-bot-margin fill">
                                                <a href={userInView?.socialSyncs?.youtube?.link} target="_blank">YouTube</a>
                                            </h3>
                                    }
                                </div>
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
                                        height={480}
                                        width={480}
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
