import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import translator from '../../services/translator';
import Tile from './Tile';
import withNavigation from '../../wrappers/withNavigation';

interface IDiscoveredRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IDiscoveredDispatchProps {
  searchActiveMoments: Function;
  updateActiveMomentsStream: Function;
  createOrUpdateMomentReaction: Function;

  searchActiveSpaces: Function;
  updateActiveSpacesStream: Function;
  createOrUpdateSpaceReaction: Function;

  logout: Function;
}

interface IStoreProps extends IDiscoveredDispatchProps {
  content: IContentState;
  user: IUserState;
  userConnections: IUserConnectionsState;
}

// Regular component props
interface IDiscoveredProps extends IDiscoveredRouterProps, IStoreProps {
}

interface IDiscoveredState {
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators(
    {
        searchActiveMoments: ContentActions.searchActiveMoments,
        updateActiveMomentsStream: ContentActions.updateActiveMomentsStream,
        createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,

        searchActiveSpaces: ContentActions.searchActiveSpaces,
        updateActiveSpacesStream: ContentActions.updateActiveSpacesStream,
        createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
    },
    dispatch,
);

/**
 * Discovered
 */
export class DiscoveredComponent extends React.Component<IDiscoveredProps, IDiscoveredState> {
    private translate: Function;

    constructor(props: IDiscoveredProps) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `Therr | ${this.translate('pages.discovered.pageTitle')}`;

        this.handleRefresh();
    }

    handleRefresh = () => {
        const {
            content,
            updateActiveMomentsStream,
            updateActiveSpacesStream,
            user,
        } = this.props;
        this.setState({ isLoading: true });

        const activeMomentsPromise = updateActiveMomentsStream({
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        const activeSpacesPromise = updateActiveSpacesStream({
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        return Promise.all([activeMomentsPromise, activeSpacesPromise])
            .catch((err) => {
                console.log(err);
            })
            .finally(() => {
                // this.loadTimeoutId = setTimeout(() => {
                //     this.setState({ isLoading: false });
                // }, 400);
            });
    }

    public render(): JSX.Element | null {
        // render is a function
        const {
            content,
            user,
            createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction,
        } = this.props;

        return (
            <div id="page_discovered">
                <div id="page_discovered_content">
                    {content.activeMoments.map((area) => (
                        <Tile
                            key={area.id}
                            area={area}
                            updateAreaReaction={area.areaType === 'spaces' ? createOrUpdateSpaceReaction : createOrUpdateMomentReaction}
                            userDetails={user.details}
                        />
                    ))}
                </div>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(DiscoveredComponent));
