import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import LottieView from 'lottie-react-native';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
// import * as therrTheme from '../styles/themes';
import styles from '../../styles';
import * as therrTheme from '../../styles/themes';
import momentStyles from '../../styles/user-content/moments';
// import { buttonMenuHeightCompact } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MomentCarousel from './MomentCarousel';
import MainButtonMenuAlt from '../../components/ButtonMenu/MainButtonMenuAlt';
import BaseStatusBar from '../../components/BaseStatusBar';
import carLoader from '../../assets/sports-car.json';

// const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

interface IMomentsDispatchProps {
    searchActiveMoments: Function;
    updateActiveMoments: Function;
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
    isLoading: boolean;
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
        },
        dispatch
    );

class Moments extends React.Component<IMomentsProps, IMomentsState> {
    private carouselRef;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { content, navigation, updateActiveMoments } = this.props;

        navigation.setOptions({
            title: this.translate('pages.moments.headerTitle'),
        });

        if (!content?.activeMoments?.length || content.activeMoments.length < 21) {
            updateActiveMoments({
                withMedia: true,
                withUser: true,
                offset: 0,
            }).finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
        } else {
            this.setState({
                isLoading: false,
            });
        }
    }

    goToMap = () => {
        const { navigation } = this.props;
        navigation.navigate('Map');
    }

    goToMoment = (moment) => {
        const { navigation, user } = this.props;

        // navigation.navigate('Home');
        navigation.navigate('ViewMoment', {
            isMyMoment: moment.fromUserId === user.details.id,
            previousView: 'Moments',
            moment,
            momentDetails: {},
        });
    };

    handleRefresh = () => {
        const { updateActiveMoments } = this.props;
        this.setState({ isLoading: true });

        return updateActiveMoments({
            withMedia: true,
            withUser: true,
            offset: 0,
        }).finally(() => {
            this.setState({ isLoading: false });
        });
    }

    scrollTop = () => {
        this.carouselRef?.scrollToOffset({ animated: true, offset: 0 });
    }

    tryLoadMore = () => {
        const { content, searchActiveMoments } = this.props;
        console.log('ZACK');

        if (!content.activeMomentsPagination.isLastPage) {
            return searchActiveMoments({
                withMedia: true,
                withUser: true,
                offset: content.activeMomentsPagination.offset + content.activeMomentsPagination.itemsPerPage,
            });
        }
    }

    renderCarousel = (content) => {
        const { isLoading } = this.state;

        if (isLoading) {
            return (
                <View style={momentStyles.loadingGraphic}>
                    <LottieView
                        source={carLoader}
                        // resizeMode="cover"
                        speed={1}
                        autoPlay
                        loop
                    />
                    <Text style={momentStyles.noMomentsFoundText}>Loading...</Text>
                </View>
            );
        }

        if (content.activeMoments?.length) {
            return (
                <MomentCarousel
                    content={content}
                    expandMoment={this.goToMoment}
                    translate={this.translate}
                    containerRef={(component) => this.carouselRef = component}
                    handleRefresh={this.handleRefresh}
                    onEndReached={this.tryLoadMore}
                    // viewportHeight={viewportHeight}
                    // viewportWidth={viewportWidth}
                />
            );
        }

        return (
            <Text style={momentStyles.noMomentsFoundText}>{this.translate('pages.moments.noMomentsFound')}</Text>
        );
    }

    render() {
        const { content, navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={[styles.safeAreaView, { backgroundColor: therrTheme.colorVariations.backgroundNeutral }]}>
                    {
                        this.renderCarousel(content)
                    }
                </SafeAreaView>
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
