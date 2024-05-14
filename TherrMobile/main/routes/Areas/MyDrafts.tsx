import React from 'react';
import { SafeAreaView } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildMomentStyles } from '../../styles/user-content/areas';
import { buildStyles as buildReactionsModalStyles } from '../../styles/modal/areaReactionsModal';
import AreaCarousel from './AreaCarousel';
import getActiveCarouselData from '../../utilities/getActiveCarouselData';
import { isMyContent as checkIsMyMoment } from '../../utilities/content';
import { CAROUSEL_TABS } from '../../constants';
import AreaOptionsModal, { ISelectionType, ModalButton } from '../../components/Modals/AreaOptionsModal';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import getDirections from '../../utilities/getDirections';

function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'earth', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
    const selected = Math.floor(Math.random() * options.length);
    return options[selected] as ILottieId;
}

interface IMyDraftsDispatchProps {
    deleteDraft: Function;
    searchMyDrafts: Function;
    createOrUpdateEventReaction: Function;
    createOrUpdateMomentReaction: Function;
    createOrUpdateSpaceReaction: Function;
}

interface IStoreProps extends IMyDraftsDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IMyDraftsProps extends IStoreProps {
    navigation: any;
}

interface IMyDraftsState {
    activeTab: string;
    isLoading: boolean;
    areAreaOptionsVisible: boolean;
    selectedArea: any;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            deleteDraft: ContentActions.deleteDraft,
            searchMyDrafts: ContentActions.searchMyDrafts,
            createOrUpdateEventReaction: ContentActions.createOrUpdateEventReaction,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
        },
        dispatch
    );

class MyDrafts extends React.Component<IMyDraftsProps, IMyDraftsState> {
    private carouselRef;
    private loaderId: ILottieId;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeLoader = buildLoaderStyles();
    private themeMenu = buildMenuStyles();
    private themeMoments = buildMomentStyles();
    private themeReactionsModal = buildReactionsModalStyles();
    private unsubscribeFocusListener;

    constructor(props) {
        super(props);

        this.state = {
            activeTab: CAROUSEL_TABS.DISCOVERIES,
            isLoading: true,
            areAreaOptionsVisible: false,
            selectedArea: {},
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeMoments = buildMomentStyles(props.user.settings?.mobileThemeName);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
        this.loaderId = getRandomLoaderId();
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.myDrafts.headerTitle'),
        });

        const draftMomentsPromise = this.handleRefresh();

        Promise.all([draftMomentsPromise]).finally(() => {
            this.setState({
                isLoading: false,
            });
        });

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            const draftMomentsPromise = this.handleRefresh();

            Promise.all([draftMomentsPromise]).finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
        });
    }

    componentWillUnmount(): void {
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
    }


    handleRefresh = (withMedia = true) => {
        const { searchMyDrafts } = this.props;

        searchMyDrafts({
            withMedia,
            pageNumber: 1,
            itemsPerPage: 50,
            query: 'drafts-only',
        });
    };

    onTabSelect = (tabName: string) => {
        this.setState({
            activeTab: tabName,
        });
    };

    getEmptyListMessage = () => {
        return this.translate('pages.myDrafts.noDraftsFound');
    };

    goToArea = (area) => {
        const { navigation } = this.props;

        navigation.navigate('EditMoment', {
            area,
            imageDetails: {},
            nearbySpaces: area.nearbySpacesSnapshot,
        });
    };

    goToViewMap = (lat, long) => {
        const { navigation } = this.props;

        navigation.replace('Map', {
            latitude: lat,
            longitude: long,
        });
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    toggleAreaOptions = (area) => {
        const { areAreaOptionsVisible } = this.state;
        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedArea: areAreaOptionsVisible ? {} : area,
        });
    };

    tryLoadMore = () => {
        // const { content, searchMyDrafts } = this.props;

        // TODO: Add support for pagination with redux
        // searchMyDrafts({
        //     query: 'drafts-only',
        //     itemsPerPage: 20,
        //     pageNumber: content.myDraftsPagination.pageNumber + 1,
        // });
    };

    onAreaOptionSelect = (type: ISelectionType) => {
        const { selectedArea } = this.state;
        const { deleteDraft, user } = this.props;

        if (type === 'delete') {
            // TODO: Remove from redux
            if (checkIsMyMoment(selectedArea, user)) {
                deleteDraft(selectedArea.id)
                    .then(() => {
                        console.log('Moment deleted');
                    })
                    .catch((err) => {
                        console.log('Error deleting moment', err);
                    })
                    .finally(() => {
                        this.toggleAreaOptions(selectedArea);
                    });
            }
        } else if (type === 'getDirections') {
            getDirections({
                latitude: selectedArea.latitude,
                longitude: selectedArea.longitude,
                title: selectedArea.notificationMsg,
            });
        }
    };

    render() {
        const { activeTab, areAreaOptionsVisible, isLoading, selectedArea } = this.state;
        const {
            createOrUpdateEventReaction,
            createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction,
            content,
            navigation,
            user,
        } = this.props;

        // TODO: Fetch missing media
        const fetchMedia = () => {};

        const activeData = isLoading ? [] : getActiveCarouselData({
            activeTab,
            content,
            isForDrafts: true,
            shouldIncludeMoments: true,
            shouldIncludeSpaces: true,
            // shouldIncludeThoughts: true,
        }, 'updatedAt');

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <AreaCarousel
                        activeData={activeData}
                        content={content}
                        inspectContent={this.goToArea}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselRef = component; }}
                        fetchMedia={fetchMedia}
                        goToViewMap={this.goToViewMap}
                        goToViewUser={this.goToViewUser}
                        handleRefresh={() => Promise.resolve(this.handleRefresh())}
                        toggleAreaOptions={this.toggleAreaOptions}
                        isLoading={isLoading}
                        onEndReached={this.tryLoadMore}
                        updateEventReaction={createOrUpdateEventReaction}
                        updateMomentReaction={createOrUpdateMomentReaction}
                        updateSpaceReaction={createOrUpdateSpaceReaction}
                        emptyListMessage={this.getEmptyListMessage()}
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />
                </SafeAreaView>
                <AreaOptionsModal
                    isVisible={areAreaOptionsVisible}
                    onRequestClose={() => this.toggleAreaOptions(selectedArea)}
                    translate={this.translate}
                    onSelect={this.onAreaOptionSelect}
                    themeButtons={this.themeButtons}
                    themeReactionsModal={this.themeReactionsModal}
                >
                    <ModalButton
                        iconName="directions"
                        title={this.translate('modals.contentOptions.buttons.getDirections')}
                        onPress={() => this.onAreaOptionSelect('getDirections')}
                        themeButtons={this.themeButtons}
                    />
                    <ModalButton
                        iconName="delete"
                        title={this.translate('modals.contentOptions.buttons.delete')}
                        onPress={() => this.onAreaOptionSelect('delete')}
                        themeButtons={this.themeButtons}
                    />
                </AreaOptionsModal>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MyDrafts);
