/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import { Content } from 'therr-js-utilities/constants';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import getUserContentUri from '../utilities/getUserContentUri';

interface IViewSpaceRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        spaceId: string;
    }
}

interface IViewSpaceDispatchProps {
    login: Function;
    getSpaceDetails: Function;
}

interface IStoreProps extends IViewSpaceDispatchProps {
    content: IContentState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
interface IViewSpaceProps extends IViewSpaceRouterProps, IStoreProps {
}

interface IViewSpaceState {
    spaceId: string;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getSpaceDetails: MapActions.getSpaceDetails,
}, dispatch);

/**
 * ViewSpace
 */
export class ViewSpaceComponent extends React.Component<IViewSpaceProps, IViewSpaceState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: IViewSpaceProps) {
        if (!nextProps.routeParams.spaceId) {
            // TODO: This doesn't seem to work with react-router-dom v6 after a newly created user tries to login
            // Causes a flicker / Need to investigate further
            setTimeout(() => nextProps.navigation.navigate('/'));
            return null;
        }
        return {};
    }

    constructor(props: IViewSpaceProps) {
        super(props);

        this.state = {
            spaceId: props.routeParams.spaceId,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { getSpaceDetails, map } = this.props;
        const { spaceId } = this.state;
        const space = map?.spaces[spaceId];

        if (!space || !space?.message) {
            getSpaceDetails(this.state.spaceId, {
                withMedia: true,
                withUser: true,
            }).then(({ space: fetchedSpace }) => {
                document.title = `${fetchedSpace?.notificationMsg} | Therr App`;
            }).catch((err) => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${space.notificationMsg} | Therr App`;
        }
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        const { content, map } = this.props;
        const { spaceId } = this.state;
        const space = map?.spaces[spaceId];

        const mediaId = (space.media && space.media[0]?.id) || (space.mediaIds?.length && space.mediaIds?.split(',')[0]);
        // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
        const mediaPath = (space.media && space.media[0]?.path);
        const mediaType = (space.media && space.media[0]?.type);
        const spaceMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(space.media[0], 480, 480, true)
            : content?.media[mediaId];

        return (
            <div id="page_view_space" className="flex-box space-evenly center row wrap-reverse">
                <div className="login-container info-container">
                    {
                        space
                            && <div className="flex fill max-wide-40">
                                <h1 className="text-title-medium no-bot-margin fill">
                                    {space?.notificationMsg}
                                </h1>
                                {
                                    space?.addressReadable
                                        && <h2 className="text-title-small no-bot-margin fill">
                                            {space?.addressReadable}
                                        </h2>
                                }
                                {
                                    space?.websiteUrl
                                        && <h3 className="text-title-small no-bot-margin fill">
                                            <a href={space?.websiteUrl} target="_blank">Website</a>
                                        </h3>
                                }
                                {
                                    space?.menuUrl
                                        && <h3 className="text-title-small no-bot-margin fill">
                                            <a href={space?.menuUrl} target="_blank">Menu</a>
                                        </h3>
                                }
                                {
                                    space?.phoneNumber
                                    && <h3 className="text-title-small no-bot-margin fill">
                                        <a href={`tel:${space?.phoneNumber}`} target="_blank">Phone</a>
                                    </h3>
                                }
                                {
                                    space?.orderUrl
                                        && <h3 className="text-title-small no-bot-margin fill">
                                            <a href={space?.orderUrl} target="_blank">Order Delivery</a>
                                        </h3>
                                }
                                {
                                    space?.reservationUrl
                                        && <h3 className="text-title-small no-bot-margin fill">
                                            <a href={space?.reservationUrl} target="_blank">Make Reservations</a>
                                        </h3>
                                }
                                <p className="info-text fill">{space?.message}</p>
                            </div>
                    }
                </div>
                <div className="login-container info-container">
                    {
                        space
                            && <div className="flex fill max-wide-30">
                                <div className="space-image-container">
                                    {spaceMedia
                                    && <img
                                        className="space-image"
                                        src={spaceMedia}
                                        alt={space.notificationMsg}
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ViewSpaceComponent));
