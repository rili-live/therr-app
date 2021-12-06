import React from 'react';
import { SafeAreaView } from 'react-native';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
// import * as therrTheme from '../styles/themes';
import styles from '../../styles';
import * as therrTheme from '../../styles/themes';
// import { buttonMenuHeightCompact } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MomentCarousel from './MomentCarousel';
import MainButtonMenuAlt from '../../components/ButtonMenu/MainButtonMenuAlt';
import BaseStatusBar from '../../components/BaseStatusBar';
import { isMyArea } from '../../utilities/content';
import AreaOptionsModal, { ISelectionType } from '../../components/Modals/AreaOptionsModal';
import { getReactionUpdateArgs } from '../../utilities/reactions';
import LottieLoader from '../../components/LottieLoader';
import getActiveCarouselData from '../../utilities/getActiveCarouselData';
import { CAROUSEL_TABS } from '../../constants';

// const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

interface IMomentsDispatchProps {
    searchActiveMoments: Function;
    updateActiveMoments: Function;
    createOrUpdateMomentReaction: Function;
    logout: Function;
}

interface IStoreProps extends IMomentsDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IMomentsProps extends IStoreProps {
    navigation: any;
}

interface IMomentsState {
    activeTab: string;
    isLoading: boolean;
    areMomentOptionsVisible: boolean;
    selectedMoment: any;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchActiveMoments: ContentActions.searchActiveMoments,
            updateActiveMoments: ContentActions.updateActiveMoments,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
        },
        dispatch
    );

class Moments extends React.Component<IMomentsProps, IMomentsState> {
    private carouselRef;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            activeTab: CAROUSEL_TABS.SOCIAL,
            isLoading: true,
            areMomentOptionsVisible: false,
            selectedMoment: {},
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { content, navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.moments.headerTitle'),
        });

        if (!content?.activeMoments?.length || content.activeMoments.length < 21) {
            this.handleRefresh();
        } else {
            this.setState({
                isLoading: false,
            });
        }
    }

    getEmptyListMessage = (activeTab) => {
        if (activeTab === CAROUSEL_TABS.SOCIAL) {
            return this.translate('pages.moments.noSocialMomentsFound');
        }

        if (activeTab === CAROUSEL_TABS.HIRE) {
            return this.translate('pages.moments.noHireMomentsFound');
        }

        // CAROUSEL_TABS.EVENTS
        return this.translate('pages.moments.noEventsMomentsFound');
    }

    goToMap = () => {
        const { navigation } = this.props;
        navigation.navigate('Map');
    }

    goToMoment = (moment) => {
        const { navigation, user } = this.props;

        // navigation.navigate('Home');
        navigation.navigate('ViewMoment', {
            isMyArea: isMyArea(moment, user),
            previousView: 'Moments',
            moment,
            momentDetails: {},
        });
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    }

    handleRefresh = () => {
        const { content, updateActiveMoments, user } = this.props;
        this.setState({ isLoading: true });

        return updateActiveMoments({
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeMomentsFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        }).finally(() => {
            this.setState({ isLoading: false });
        });
    }

    onMomentOptionSelect = (type: ISelectionType) => {
        const { selectedMoment } = this.state;
        const { createOrUpdateMomentReaction } = this.props;
        const requestArgs: any = getReactionUpdateArgs(type);

        createOrUpdateMomentReaction(selectedMoment.id, requestArgs).finally(() => {
            this.toggleMomentOptions(selectedMoment);
        });
    }

    onTabSelect = (tabName: string) => {
        this.setState({
            activeTab: tabName,
        });
    }

    scrollTop = () => {
        this.carouselRef?.scrollToOffset({ animated: true, offset: 0 });
    }

    tryLoadMore = () => {
        const { content, searchActiveMoments, user } = this.props;

        if (!content.activeMomentsPagination.isLastPage) {
            return searchActiveMoments({
                withMedia: true,
                withUser: true,
                offset: content.activeMomentsPagination.offset + content.activeMomentsPagination.itemsPerPage,
                ...content.activeMomentsFilters,
                blockedUsers: user.details.blockedUsers,
                shouldHideMatureContent: user.details.shouldHideMatureContent,
            });
        }
    }

    toggleMomentOptions = (moment) => {
        const { areMomentOptionsVisible } = this.state;
        this.setState({
            areMomentOptionsVisible: !areMomentOptionsVisible,
            selectedMoment: areMomentOptionsVisible ? {} : moment,
        });
    }

    renderCarousel = (content) => {
        const { createOrUpdateMomentReaction, user } = this.props;
        const { activeTab, isLoading } = this.state;

        if (isLoading) {
            return <LottieLoader id="yellow-car" />;
        }

        const activeData = getActiveCarouselData({
            activeTab,
            content,
            isForBookmarks: false,
        });

        return (
            <MomentCarousel
                activeData={activeData}
                activeTab={activeTab}
                content={content}
                expandMoment={this.goToMoment}
                goToViewUser={this.goToViewUser}
                toggleMomentOptions={this.toggleMomentOptions}
                translate={this.translate}
                containerRef={(component) => this.carouselRef = component}
                handleRefresh={this.handleRefresh}
                onEndReached={this.tryLoadMore}
                onTabSelect={this.onTabSelect}
                updateMomentReaction={createOrUpdateMomentReaction}
                emptyListMessage={this.getEmptyListMessage(activeTab)}
                user={user}
                // viewportHeight={viewportHeight}
                // viewportWidth={viewportWidth}
            />
        );
    }

    render() {
        const { areMomentOptionsVisible, selectedMoment } = this.state;
        const { content, navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={[styles.safeAreaView, { backgroundColor: therrTheme.colorVariations.backgroundNeutral }]}>
                    {
                        this.renderCarousel(content)
                    }
                </SafeAreaView>
                <AreaOptionsModal
                    isVisible={areMomentOptionsVisible}
                    onRequestClose={() => this.toggleMomentOptions(selectedMoment)}
                    translate={this.translate}
                    onSelect={this.onMomentOptionSelect}
                />
                {/* <MainButtonMenu navigation={navigation} onActionButtonPress={this.scrollTop} translate={this.translate} user={user} /> */}
                <MainButtonMenuAlt
                    navigation={navigation}
                    onActionButtonPress={this.scrollTop}
                    translate={this.translate}
                    user={user}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Moments);
