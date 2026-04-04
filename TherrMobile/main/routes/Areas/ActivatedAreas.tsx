import React from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState } from 'therr-react/types';
import BaseStatusBar from '../../components/BaseStatusBar';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import AreaCarousel from './AreaCarousel';
import { navToViewContent, handleAreaReaction } from '../../utilities/postViewHelpers';
import { SheetManager } from 'react-native-actions-sheet';
import { IContentSelectionType } from '../../components/ActionSheet/ContentOptionsSheet';
import getDirections from '../../utilities/getDirections';
import LottieLoader from '../../components/LottieLoader';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';

interface IActivatedAreasDispatchProps {
    searchActiveMomentsByIds: Function;
    searchActiveSpacesByIds: Function;
    createOrUpdateMomentReaction: Function;
    createOrUpdateSpaceReaction: Function;
    createOrUpdateEventReaction: Function;
}

interface IStoreProps extends IActivatedAreasDispatchProps {
    content: IContentState;
    user: IUserState;
}

export interface IActivatedAreasProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IActivatedAreasState {
    isLoading: boolean;
    activatedData: any[];
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchActiveMomentsByIds: ContentActions.searchActiveMomentsByIds,
            searchActiveSpacesByIds: ContentActions.searchActiveSpacesByIds,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
            createOrUpdateEventReaction: ContentActions.createOrUpdateEventReaction,
        },
        dispatch
    );

class ActivatedAreas extends React.Component<IActivatedAreasProps, IActivatedAreasState> {
    private carouselRef: any;
    private translate: (key: string, params?: any) => any;
    private theme = buildStyles();
    private themeForms = buildFormStyles();
    private themeMenu = buildMenuStyles();
    private themeLoader = buildLoaderStyles();

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
            activatedData: [],
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.activatedAreas.headerTitle'),
        });

        this.fetchActivatedAreas();
    }

    fetchActivatedAreas = () => {
        const { route, user, searchActiveMomentsByIds, searchActiveSpacesByIds } = this.props;
        const { activatedMomentIds = [], activatedSpaceIds = [] } = route.params || {};

        const searchOptions = {
            withMedia: true,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        };

        const promises: Promise<any>[] = [];

        if (activatedMomentIds.length) {
            promises.push(searchActiveMomentsByIds(searchOptions, activatedMomentIds));
        }
        if (activatedSpaceIds.length) {
            promises.push(searchActiveSpacesByIds(searchOptions, activatedSpaceIds));
        }

        return Promise.all(promises)
            .then(() => {
                this.updateActivatedData();
            })
            .catch((err) => {
                console.log('Error fetching activated areas:', err);
            })
            .finally(() => {
                this.setState({ isLoading: false });
            });
    };

    updateActivatedData = () => {
        const { content, route } = this.props;
        const { activatedMomentIds = [], activatedSpaceIds = [] } = route.params || {};

        const momentIdSet = new Set(activatedMomentIds);
        const spaceIdSet = new Set(activatedSpaceIds);

        const matchingMoments = (content.activeMoments || []).filter(
            (m) => momentIdSet.has(m.id)
        );
        const matchingSpaces = (content.activeSpaces || []).filter(
            (s) => spaceIdSet.has(s.id)
        );

        const activatedData = [...matchingMoments, ...matchingSpaces].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        this.setState({ activatedData });
    };

    goToArea = (area) => {
        const { navigation, user } = this.props;
        navToViewContent(area, user, navigation.navigate, 'ActivatedAreas');
    };

    goToViewMap = (lat, long) => {
        const { navigation } = this.props;
        navigation.navigate('Map', {
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

    goToNotifications = () => {
        const { navigation } = this.props;
        navigation.navigate('Notifications');
    };

    goToNearby = () => {
        const { navigation } = this.props;
        navigation.navigate('Nearby');
    };

    onAreaOptionSelect = (type: IContentSelectionType, area: any) => {
        const { createOrUpdateEventReaction, createOrUpdateSpaceReaction, createOrUpdateMomentReaction, user } = this.props;

        if (type === 'getDirections') {
            getDirections({
                latitude: area.latitude,
                longitude: area.longitude,
                title: area.notificationMsg,
            });
        } else {
            handleAreaReaction(area, type, {
                user,
                createOrUpdateEventReaction,
                createOrUpdateMomentReaction,
                createOrUpdateSpaceReaction,
                toggleAreaOptions: this.toggleAreaOptions,
                translate: this.translate,
            });
        }
    };

    toggleAreaOptions = (displayArea) => {
        const area = displayArea || {};
        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'area',
                translate: this.translate,
                themeForms: this.themeForms,
                onSelect: (type: IContentSelectionType) => this.onAreaOptionSelect(type, area),
            },
        });
    };

    scrollTop = () => {
        this.carouselRef?.scrollToOffset({ animated: true, offset: 0 });
    };

    getMapRegion = () => {
        const { activatedData } = this.state;
        const validAreas = activatedData.filter((a) => a.latitude && a.longitude);

        if (validAreas.length === 0) {
            return null;
        }

        const lats = validAreas.map((a) => a.latitude);
        const lngs = validAreas.map((a) => a.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
        const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: latDelta,
            longitudeDelta: lngDelta,
        };
    };

    renderHeader = () => {
        const { activatedData } = this.state;
        const region = this.getMapRegion();

        return (
            <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
                {region && (
                    <View style={{
                        height: 180,
                        borderRadius: 12,
                        overflow: 'hidden',
                        marginBottom: 10,
                    }}>
                        <MapView
                            provider={PROVIDER_GOOGLE}
                            style={{ flex: 1 }}
                            region={region}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                            toolbarEnabled={false}
                            liteMode={true}
                        >
                            {activatedData
                                .filter((a) => a.latitude && a.longitude)
                                .map((area) => (
                                    <Marker
                                        key={area.id}
                                        coordinate={{
                                            latitude: area.latitude,
                                            longitude: area.longitude,
                                        }}
                                        title={area.notificationMsg}
                                    />
                                ))}
                        </MapView>
                    </View>
                )}
                <Text style={{
                    fontSize: 16,
                    color: this.theme.colors.textWhite,
                    fontWeight: '500',
                }}>
                    {this.translate('pages.activatedAreas.description')}
                </Text>
            </View>
        );
    };

    renderFooter = () => {
        return (
            <View style={{ paddingHorizontal: 14, paddingTop: 20, paddingBottom: 40 }}>
                <Pressable onPress={this.goToNotifications}>
                    <Text style={[this.themeForms.styles.buttonLink, { fontSize: 16, paddingBottom: 14, textDecorationLine: 'underline' }]}>
                        {this.translate('pages.activatedAreas.backToNotifications')}
                    </Text>
                </Pressable>
                <Pressable onPress={this.goToNearby}>
                    <Text style={[this.themeForms.styles.buttonLink, { fontSize: 16, textDecorationLine: 'underline' }]}>
                        {this.translate('pages.activatedAreas.discoverMore')}
                    </Text>
                </Pressable>
            </View>
        );
    };

    render() {
        const { navigation, content, user } = this.props;
        const { isLoading, activatedData } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <AreaCarousel
                        activeData={activatedData}
                        content={content}
                        displaySize="large"
                        inspectContent={this.goToArea}
                        goToViewMap={this.goToViewMap}
                        goToViewUser={this.goToViewUser}
                        toggleAreaOptions={this.toggleAreaOptions}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselRef = component; }}
                        handleRefresh={this.fetchActivatedAreas}
                        isLoading={isLoading}
                        updateEventReaction={this.props.createOrUpdateEventReaction}
                        updateMomentReaction={this.props.createOrUpdateMomentReaction}
                        updateSpaceReaction={this.props.createOrUpdateSpaceReaction}
                        emptyListMessage={this.translate('pages.activatedAreas.noAreasFound')}
                        renderHeader={this.renderHeader}
                        renderFooter={this.renderFooter}
                        renderLoader={() => <LottieLoader id="earth" theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                    />
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.scrollTop}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ActivatedAreas);
