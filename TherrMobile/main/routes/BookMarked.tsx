import React from 'react';
import { SafeAreaView, Text } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import MainButtonMenuAlt from '../components/ButtonMenu/MainButtonMenuAlt';
import BaseStatusBar from '../components/BaseStatusBar';
import translator from '../services/translator';
import styles from '../styles';
import momentStyles from '../styles/user-content/moments';
import MomentCarousel from './Moments/MomentCarousel';
import { isMyMoment } from '../utilities/content';

interface IBookMarkedDispatchProps {
    searchBookmarkedMoments: Function;
    createOrUpdateMomentReaction: Function;
}

interface IStoreProps extends IBookMarkedDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IBookMarkedProps extends IStoreProps {
    navigation: any;
}

interface IBookMarkedState {
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
            searchBookmarkedMoments: ContentActions.searchBookmarkedMoments,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
        },
        dispatch
    );

class BookMarked extends React.Component<IBookMarkedProps, IBookMarkedState> {
    private carouselRef;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
            areMomentOptionsVisible: false,
            selectedMoment: {},
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation, searchBookmarkedMoments, user } = this.props;

        navigation.setOptions({
            title: this.translate('pages.bookmarked.headerTitle'),
        });

        this.setState({
            areMomentOptionsVisible: false,
            isLoading: false,
            selectedMoment: {},
        });

        searchBookmarkedMoments({
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        }).finally(() => {
            this.setState({
                isLoading: false,
            });
        });
    }


    handleRefresh = () => {
        const { searchBookmarkedMoments, user } = this.props;

        searchBookmarkedMoments({
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });
    }

    goToMoment = (moment) => {
        const { navigation, user } = this.props;

        // navigation.navigate('Home');
        navigation.navigate('ViewMoment', {
            isMyMoment: isMyMoment(moment, user),
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

    toggleMomentOptions = (moment) => {
        const { areMomentOptionsVisible } = this.state;
        this.setState({
            areMomentOptionsVisible: !areMomentOptionsVisible,
            selectedMoment: areMomentOptionsVisible ? {} : moment,
        });
    }

    tryLoadMore = () => {
        console.log('try load more');
    }

    renderCarousel = (content) => {
        const { isLoading } = this.state;
        const { createOrUpdateMomentReaction } = this.props;

        if (isLoading) {
            return (
                <Text style={momentStyles.noMomentsFoundText}>Loading...</Text>
            );
        }

        return (
            <MomentCarousel
                content={content}
                expandMoment={this.goToMoment}
                translate={this.translate}
                containerRef={(component) => this.carouselRef = component}
                goToViewUser={this.goToViewUser}
                handleRefresh={() => Promise.resolve(this.handleRefresh())}
                toggleMomentOptions={this.toggleMomentOptions}
                isForBookmarks
                onEndReached={this.tryLoadMore}
                updateMomentReaction={createOrUpdateMomentReaction}
                emptyListMessage={this.translate('pages.bookmarked.noBookmarksFound')}
                // viewportHeight={viewportHeight}
                // viewportWidth={viewportWidth}
            />
        );
    }

    render() {
        const { content, navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={styles.safeAreaView}>
                    {
                        this.renderCarousel(content)
                    }
                </SafeAreaView>
                <MainButtonMenuAlt
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(BookMarked);
