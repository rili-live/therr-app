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

interface IViewMomentRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        momentId: string;
    }
}

interface IViewMomentDispatchProps {
    login: Function;
    getMomentDetails: Function;
}

interface IStoreProps extends IViewMomentDispatchProps {
    content: IContentState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
interface IViewMomentProps extends IViewMomentRouterProps, IStoreProps {
}

interface IViewMomentState {
    momentId: string;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getMomentDetails: MapActions.getMomentDetails,
}, dispatch);

/**
 * ViewMoment
 */
export class ViewMomentComponent extends React.Component<IViewMomentProps, IViewMomentState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: IViewMomentProps) {
        if (!nextProps.routeParams.momentId) {
            // TODO: This doesn't seem to work with react-router-dom v6 after a newly created user tries to login
            // Causes a flicker / Need to investigate further
            setTimeout(() => nextProps.navigation.navigate('/'));
            return null;
        }
        return {};
    }

    constructor(props: IViewMomentProps) {
        super(props);

        this.state = {
            momentId: props.routeParams.momentId,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { getMomentDetails, map } = this.props;
        const { momentId } = this.state;
        const moment = map?.moments[momentId];

        if (!moment) {
            getMomentDetails(this.state.momentId, {
                withMedia: true,
                withUser: true,
            }).then(({ moment: fetchedMoment }) => {
                document.title = `${fetchedMoment?.notificationMsg} | Therr App`;
            }).catch((err) => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${moment.notificationMsg} | Therr App`;
        }
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        const { content, map } = this.props;
        const { momentId } = this.state;
        const moment = map?.moments[momentId];

        return (
            <div id="page_view_moment" className="flex-box space-evenly center row wrap-reverse">
                <div className="login-container info-container">
                    {
                        moment
                            && <div className="flex fill max-wide-40">
                                <h1 className="text-title-medium no-bot-margin fill">
                                    {moment?.notificationMsg}
                                </h1>
                                <p className="info-text fill">{moment?.message}</p>
                                <p className="info-text fill">{`${moment?.hashTags?.length ? '#' : ''}${moment?.hashTags?.split(',').join(', #')}`}</p>
                            </div>
                    }
                </div>
                <div className="login-container info-container">
                    {
                        moment
                            && <div className="flex fill max-wide-30">
                                <div className="moment-image-container">
                                    {moment?.media?.length > 0 && content?.media[moment.media[0].id]
                                    && <img
                                        className="moment-image"
                                        src={content.media[moment.media[0].id]}
                                        alt={moment.notificationMsg}
                                    />}
                                </div>
                            </div>
                    }
                </div>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ViewMomentComponent));