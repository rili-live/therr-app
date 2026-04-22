import React from 'react';
import { PermissionsAndroid, Platform, View, Text, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Geolocation from 'react-native-geolocation-service';
import { Button } from '../../components/BaseButton';
import { showToast } from '../../utilities/toasts';
import { ContentActions, MapActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { ForumsService } from 'therr-react/services';
import { IContentState, IForumsState, IMapState, IUserState, IUserConnectionsState } from 'therr-react/types';
import {
    Content,
} from 'therr-js-utilities/constants';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import OctIcon from 'react-native-vector-icons/Octicons';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import LocationActions from '../../redux/actions/LocationActions';
import translator from '../../utilities/translator';
import { isDarkTheme } from '../../styles/themes';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildAreaStyles } from '../../styles/user-content/areas/viewing';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/settingsForm';
import BaseStatusBar from '../../components/BaseStatusBar';
import spacingStyles from '../../styles/layouts/spacing';
import { ILocationState } from '../../types/redux/location';
import ConnectionItem from '../Connect/components/ConnectionItem';
import { getUserContentUri } from '../../utilities/content';
import TherrIcon from '../../components/TherrIcon';
import { RefreshControl } from 'react-native-gesture-handler';
import LoadingPlaceholder from './LoadingPlaceholder';
import LoadingPlaceholderInterests from './LoadingPlaceholderInterests';
import StepSectionHeader from './StepSectionHeader';
import InterestChip from './InterestChip';
import CompactSpaceCard from './CompactSpaceCard';
import InputEventName from '../Events/InputEventName';
import InputGroupName from '../Groups/InputGroupName';
import EventStartEndFormGroup from '../Events/EventStartEndFormGroup';
import { DEFAULT_RADIUS, GROUPS_CAROUSEL_TABS } from '../../constants';
import { SheetManager } from 'react-native-actions-sheet';
import LottieView from 'lottie-react-native';
import { Text as PaperText, Button as PaperButton } from 'react-native-paper';
import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';
import { checkAndroidPermission, isLocationPermissionGranted, requestOSMapPermissions } from '../../utilities/requestOSPermissions';

const { width: screenWidth } = Dimensions.get('window');
const DEFAULT_SPACES_LIST_SIZE = 3;
const matchUpLoader = require('../../assets/match-up.json');

interface IActivityGeneratorDispatchProps {
    createOrUpdateSpaceReaction: Function;
    createUserConnection: Function;
    generateActivity: Function;
    updateGpsStatus: Function;
    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;
    updateUser: Function;
}

interface IStoreProps extends IActivityGeneratorDispatchProps {
    content: IContentState;
    forums: IForumsState;
    location: ILocationState;
    map: IMapState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IActivityGeneratorProps extends IStoreProps {
    navigation: any;
}

interface IActivityGeneratorState {
    isLoading: boolean;
    isSubmitting: boolean;
    shouldShowMoreSpaces: boolean;
    selectedSpace?: any;
    selectedConnectionIds: Set<string>;
    spaceListSize: number;
    collapsedSections: { connections: boolean; interests: boolean };
    inputs: {
        isDraft: boolean;
        isPublic: boolean;
        radius: number;
        title: string;
        notificationMsg: string;
        scheduleStartAt: Date;
        scheduleStopAt: Date;
    };
    categories: any[];
}

const mapStateToProps = (state) => ({
    content: state.content,
    forums: state.forums,
    location: state.location,
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUserConnection: UserConnectionsActions.create,
    createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
    generateActivity: MapActions.generateActivity,
    updateGpsStatus: LocationActions.updateGpsStatus,
    updateLocationDisclosure: LocationActions.updateLocationDisclosure,
    updateLocationPermissions: LocationActions.updateLocationPermissions,
    updateUser: UsersActions.update,
}, dispatch);

export class ActivityGenerator extends React.Component<IActivityGeneratorProps, IActivityGeneratorState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeViewArea = buildAreaStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();
    private themeForms = buildFormStyles();
    private themeSettingsForm = buildSettingsFormStyles();

    static getDerivedStateFromProps(nextProps: IActivityGeneratorProps, nextState: IActivityGeneratorState) {
        if (!nextState.categories || !nextState.categories.length) {
            return {
                categories: nextProps.forums.forumCategories,
            };
        }

        return null;
    }

    constructor(props) {
        super(props);

        this.state = {
            isLoading: false,
            isSubmitting: false,
            shouldShowMoreSpaces: false,
            selectedConnectionIds: new Set<string>(),
            spaceListSize: DEFAULT_SPACES_LIST_SIZE,
            collapsedSections: { connections: false, interests: false },
            inputs: {
                isDraft: false,
                isPublic: false,
                radius: DEFAULT_RADIUS,
                title: '',
                notificationMsg: '',
                scheduleStartAt: new Date(),
                scheduleStopAt: new Date(),
            },
            categories: [],
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.activityGenerator.headerTitle'),
        });

        this.handleRefresh();
    };

    getConnectionSubtitle = (connectionDetails) => {
        if (!connectionDetails?.firstName && !connectionDetails?.lastName) {
            return this.translate('pages.userProfile.anonymous');
        }
        return `${connectionDetails.firstName || ''} ${
            connectionDetails.lastName || ''
        }`;
    };

    onBookmarkPress = (area) => {
        const { createOrUpdateSpaceReaction, user } = this.props;

        createOrUpdateSpaceReaction(area.id, {
            userBookmarkCategory: area.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        }, area.fromUserId, user?.details?.userName);
    };

    onConnectionPress = (userDetails: any) => this.goToUserDetails(userDetails.id);

    goToUserDetails = (userId: string) => {
        const { navigation } = this.props;
        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    onToggleConnection = (userId: string) => {
        this.setState((prevState) => {
            const updated = new Set(prevState.selectedConnectionIds);
            if (updated.has(userId)) {
                updated.delete(userId);
            } else {
                updated.add(userId);
            }
            return { selectedConnectionIds: updated };
        });
    };

    onSelectSpace = (space: any) => {
        this.setState({
            selectedSpace: space,
            spaceListSize: 1,
            shouldShowMoreSpaces: false,
        });
    };

    goToSpaceDetails = (space: any) => {
        const { navigation, user } = this.props;
        navigation.navigate('ViewSpace', {
            isMyContent: space?.fromUserId === user.details.id,
            previousView: 'ActivityGenerator',
            space: {
                id: space.id,
            },
            spaceDetails: space,
        });
    };

    getSpaceHeading = (space: any) => {
        if (!space?.addressReadable) {
            return `${space?.notificationMsg}`;
        }

        return `${space?.notificationMsg} - ${space?.addressReadable}`;
    };

    isFormDisabled() {
        const { isLoading, isSubmitting } = this.state;
        return isLoading || isSubmitting;
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeViewArea = buildAreaStyles(themeName, themeName !== 'light');
        this.themeButtons = buildButtonStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSettingsForm = buildSettingsFormStyles(themeName);
    };

    handleRefresh = () => {
        const { location, generateActivity } = this.props;

        this.setState({
            isLoading: true,
            shouldShowMoreSpaces: false,
        });

        generateActivity({
            latitude: location?.user?.latitude,
            longitude: location?.user?.longitude,
        }).then(() => {
            // Auto-select all returned connections
            const connections = this.props.map?.activityGeneration?.topConnections || [];
            this.setState({
                selectedConnectionIds: new Set(connections.map((c) => c.user?.id).filter(Boolean)),
            });
        }).catch((err)=> {
            console.log(err);
        }).finally(() => {
            this.setState({
                isLoading: false,
            });
        });
    };

    handleEnableLocationPress = () => {
        const {
            location,
            updateGpsStatus,
            updateLocationDisclosure,
            updateLocationPermissions,
        } = this.props;

        return requestLocationServiceActivation({
            isGpsEnabled: location?.settings?.isGpsEnabled,
            translate: this.translate,
            shouldIgnoreRequirement: false,
        }).then((response: any) => {
            if (response?.status || Platform.OS === 'ios') {
                updateLocationDisclosure(true);
                updateGpsStatus(response?.status || 'enabled');
                return false;
            }
            return Promise.resolve(false);
        }).then((shouldAbort: boolean) => {
            if (shouldAbort) {
                return;
            }

            return requestOSMapPermissions(updateLocationPermissions).then((permissions) => {
                return new Promise<void>((resolve, reject) => {
                    let extraPromise = Promise.resolve(false);
                    if (Platform.OS === 'android' && permissions[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !== 'granted') {
                        extraPromise = checkAndroidPermission(
                            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                            updateLocationPermissions
                        );
                    }

                    return extraPromise.then((isCoarseLocationGranted) => {
                        const perms = {
                            ...permissions,
                            [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: isCoarseLocationGranted ? 'granted' : 'denied',
                        };
                        if (isLocationPermissionGranted(perms)) {
                            Geolocation.getCurrentPosition(
                                () => {
                                    // Location obtained, refresh to load data
                                    this.handleRefresh();
                                },
                                (error) => {
                                    console.log('Position error', error);
                                },
                                { enableHighAccuracy: true },
                            );
                            return resolve();
                        } else {
                            console.log('Location permission denied');
                            return reject('permissionDenied');
                        }
                    });
                });
            }).catch((error) => {
                console.log('requestOSPermissionsError', error);
            });
        }).catch((error) => {
            console.log('gps activation error', error);
        });
    };

    onSendConnectRequest = (acceptingUser: any) => {
        const { createUserConnection, user } = this.props;
        createUserConnection({
            requestingUserId: user.details.id,
            requestingUserFirstName: user.details.firstName,
            requestingUserLastName: user.details.lastName,
            requestingUserEmail: user.details.email,
            acceptingUserId: acceptingUser?.id,
            acceptingUserPhoneNumber: acceptingUser?.phoneNumber,
            acceptingUserEmail: acceptingUser?.email,
        }, {
            userName: user?.details?.userName,
        });
    };

    onToggleShowMore = () => {
        this.setState({
            shouldShowMoreSpaces: !this.state.shouldShowMoreSpaces,
        });
    };

    onToggleSection = (section: 'connections' | 'interests') => {
        this.setState({
            collapsedSections: {
                ...this.state.collapsedSections,
                [section]: !this.state.collapsedSections[section],
            },
        });
    };

    onInputChange = (name: string, value: string | undefined) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: value,
            },
            isSubmitting: false,
        });
    };

    onConfirmDatePicker = (variation: 'start' | 'end', date) => {
        const pickerStateKey = variation === 'start'
            ? 'scheduleStartAt'
            : 'scheduleStopAt';

        if (this.scrollViewRef) {
            setTimeout(() => {
                this.scrollViewRef.scrollToEnd();
            }, 100);
        }

        this.setState({
            inputs: {
                ...this.state.inputs,
                [pickerStateKey]: date,
            },
            isSubmitting: false,
        });
    };

    onSetVisibility = (isPublic: boolean) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                isPublic,
            },
        });
    };

    onSubmit = () => {
        const { user } = this.props;
        const {
            isPublic,
            notificationMsg,
            radius,
            scheduleStartAt,
            scheduleStopAt,
            title,
        } = this.state.inputs;

        if (this.state.selectedConnectionIds.size === 0) {
            showToast.error({
                text1: this.translate('pages.activityGenerator.validation.noConnections'),
                text2: this.translate('pages.activityGenerator.validation.noConnectionsDetail'),
            });
            return;
        }

        if (!this.state.selectedSpace?.id) {
            showToast.error({
                text1: this.translate('pages.activityGenerator.validation.noSpace'),
                text2: this.translate('pages.activityGenerator.validation.noSpaceDetail'),
            });
            return;
        }

        if (!title) {
            showToast.error({
                text1: this.translate('pages.activityGenerator.validation.noGroupName'),
                text2: this.translate('pages.activityGenerator.validation.noGroupNameDetail'),
            });
            return;
        }

        if (!notificationMsg) {
            showToast.error({
                text1: this.translate('pages.activityGenerator.validation.noEventName'),
                text2: this.translate('pages.activityGenerator.validation.noEventNameDetail'),
            });
            return;
        }

        if (scheduleStopAt.getTime() - scheduleStartAt.getTime() <= 0) {
            showToast.error({
                text1: this.translate('alertTitles.startDateAfterEndDate'),
                text2: this.translate('alertMessages.startDateAfterEndDate'),
            });
            return;
        }

        const requestBody = {
            group: {
                administratorIds: user.details.id,
                title,
                subtitle: title,
                description: 'Hangout w/ local friends',
                categoryTags: this.state.categories?.filter(c => c.isActive).map(c => c.tag) || ['general'],
                integrationIds: '',
                invitees: '',
                iconGroup: 'font-awesome-5',
                iconId: 'star',
                iconColor: 'black',
                memberIds: Array.from(this.state.selectedConnectionIds),
                isPublic,
            },
            event: {
                isPublic,
                notificationMsg,
                message: `Hangout @ ${this.state.selectedSpace?.notificationMsg}`,
                radius,
                spaceId: this.state.selectedSpace?.id,
                scheduleStartAt,
                scheduleStopAt,
                latitude: this.state.selectedSpace?.latitude,
                longitude: this.state.selectedSpace?.longitude,
                userLatitude: this.state.selectedSpace?.latitude,
                userLongitude: this.state.selectedSpace?.longitude,
            },
        };

        this.setState({
            isSubmitting: true,
        });

        ForumsService.createActivity(requestBody)
            .then((response) => {
                showToast.success({
                    text1: this.translate('alertTitles.activityCreated'),
                    text2: this.translate('alertMessages.activityCreated'),
                    onHide: () => {
                        this.setState({
                            isSubmitting: false,
                        });
                        if (response.data?.group?.id) {
                            this.props.navigation.navigate('ViewGroup', {
                                id: response.data?.group?.id,
                                title: response.data?.group?.title,
                                subtitle: response.data?.group?.subtitle,
                                description: response.data?.group?.description,
                                isNewlyCreated: true,
                            });
                        } else {
                            this.props.navigation.navigate('Groups', {
                                activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                            });
                        }
                    },
                    props: {
                        extraStyle: { minHeight: 90, marginBottom: 10 },
                        renderTrailingIcon: () => (
                            <LottieView
                                source={matchUpLoader}
                                resizeMode="contain"
                                speed={0.5}
                                autoPlay
                                loop
                                style={{ width: 75, height: '100%', marginRight: 10 }}
                            />
                        ),
                    },
                });
            })
            .catch(() => {
                this.setState({
                    isSubmitting: false,
                });
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('alertMessages.backendErrorMessage'),
                });
            });
    };

    hasUserLocation = () => {
        const { location } = this.props;
        return !!(location?.user?.latitude && location?.user?.longitude);
    };

    render() {
        const { content, map, navigation, user, userConnections } = this.props;
        const { collapsedSections, inputs, isLoading, shouldShowMoreSpaces, spaceListSize, selectedSpace } = this.state;
        const themeName = user.settings?.mobileThemeName;
        const hasLocation = this.hasUserLocation();
        const topConnections = (map?.activityGeneration?.topConnections || []).map((connection: any) => ({
            ...connection,
            isActive: userConnections?.activeConnections?.find((activeC) => activeC.id === connection.user.id),
        }));
        const topSpaces: any[] = map?.activityGeneration?.topSpaces || [];
        const topSpacesSorted = [...topSpaces].sort((a, b) => {
            if (a.id === selectedSpace?.id) {
                return -1;
            } else if (b.id === selectedSpace?.id) {
                return 1;
            }
            return 0;
        });
        const topSpacesInView = shouldShowMoreSpaces
            ? topSpacesSorted
            : topSpacesSorted.slice(0, spaceListSize);

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={this.theme.styles.scrollView}
                        refreshControl={<RefreshControl
                            refreshing={isLoading}
                            onRefresh={this.handleRefresh}
                        />}
                    >
                        <View style={this.theme.styles.body}>
                            {!hasLocation && !isLoading && (
                                <View style={[this.theme.styles.sectionContainer, { alignItems: 'center', paddingVertical: 24 }]}>
                                    <LottieView
                                        source={require('../../assets/earth-loader.json')}
                                        resizeMode="contain"
                                        speed={1}
                                        autoPlay
                                        loop
                                        style={{ width: 100, height: 100, marginBottom: 16 }}
                                    />
                                    <PaperText variant="headlineSmall" style={this.theme.styles.sectionTitleCenter}>
                                        {this.translate('pages.activityGenerator.locationPrompt.title')}
                                    </PaperText>
                                    <PaperText variant="bodyMedium" style={[this.theme.styles.sectionDescriptionCentered, { marginBottom: 16 }]}>
                                        {this.translate('pages.activityGenerator.locationPrompt.description')}
                                    </PaperText>
                                    <PaperButton
                                        mode="contained"
                                        onPress={this.handleEnableLocationPress}
                                        icon="crosshairs-gps"
                                        buttonColor={this.theme.colors.brandingBlueGreen}
                                        textColor={this.theme.colors.brandingWhite}
                                    >
                                        {this.translate('forms.nearbyForm.buttons.enableLocation')}
                                    </PaperButton>
                                </View>
                            )}
                            {/* Step 1: People Nearby */}
                            <StepSectionHeader
                                stepNumber={1}
                                title={this.translate('pages.activityGenerator.headers.topConnections')}
                                isActive={this.state.selectedConnectionIds.size > 0}
                                isCollapsible
                                isCollapsed={collapsedSections.connections}
                                onToggleCollapse={() => this.onToggleSection('connections')}
                                theme={this.theme}
                            />
                            {!collapsedSections.connections && (
                                <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                    {
                                        isLoading
                                            ? <View style={spacingStyles.flex}>
                                                <LoadingPlaceholder />
                                            </View>
                                            : <View style={spacingStyles.flex}>
                                                {
                                                    topConnections?.map((connection) => {
                                                        const userId = connection?.user?.id;
                                                        const isSelected = this.state.selectedConnectionIds.has(userId);
                                                        return (
                                                            <Pressable
                                                                key={userId}
                                                                style={[spacingStyles.flexRow, spacingStyles.alignCenter]}
                                                                onPress={() => this.onToggleConnection(userId)}
                                                            >
                                                                <View style={spacingStyles.flexOne}>
                                                                    <ConnectionItem
                                                                        connectionDetails={connection?.user}
                                                                        getConnectionSubtitle={this.getConnectionSubtitle}
                                                                        goToViewUser={this.goToUserDetails}
                                                                        isActive={connection.isActive}
                                                                        onConnectionPress={this.onConnectionPress}
                                                                        theme={this.theme}
                                                                        translate={this.translate}
                                                                    />
                                                                </View>
                                                                <View style={{ width: 30, alignItems: 'center' }}>
                                                                    <OctIcon
                                                                        name={isSelected ? 'check' : 'circle'}
                                                                        size={18}
                                                                        color={isSelected
                                                                            ? this.theme.colors.primary3
                                                                            : this.theme.colors.accentDivider}
                                                                    />
                                                                </View>
                                                            </Pressable>
                                                        );
                                                    })
                                                }
                                                {
                                                    !topConnections?.length &&
                                                    <Text style={this.theme.styles.sectionDescriptionCentered}>
                                                        {this.translate('pages.activityGenerator.messages.noNearbyConnections')}
                                                    </Text>
                                                }
                                            </View>
                                    }
                                </View>
                            )}

                            {/* Step 2: Shared Interests */}
                            <StepSectionHeader
                                stepNumber={2}
                                title={
                                    !topConnections?.length
                                        ? this.translate('pages.activityGenerator.headers.yourTopInterests')
                                        : this.translate('pages.activityGenerator.headers.topSharedInterests')
                                }
                                isActive={!collapsedSections.interests}
                                isCollapsible
                                isCollapsed={collapsedSections.interests}
                                onToggleCollapse={() => this.onToggleSection('interests')}
                                theme={this.theme}
                            />
                            {!collapsedSections.interests && (
                                <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                    {isLoading
                                        ? <View style={spacingStyles.flex}>
                                            <LoadingPlaceholderInterests />
                                        </View>
                                        : <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
                                            {
                                                Object.keys(map?.activityGeneration?.topSharedInterests || {})?.map((id) => {
                                                    const interest = map?.activityGeneration?.topSharedInterests[id];
                                                    return (
                                                        <InterestChip
                                                            key={id}
                                                            emoji={interest.emoji}
                                                            label={this.translate(interest.displayNameKey)}
                                                            ranking={interest.ranking}
                                                            theme={this.theme}
                                                            themeForms={this.themeForms}
                                                        />
                                                    );
                                                })
                                            }
                                            {
                                                !Object.keys(map?.activityGeneration?.topSharedInterests || {})?.length &&
                                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                                    {this.translate('pages.activityGenerator.messages.noSharedInterests')}
                                                </Text>
                                            }
                                        </View>
                                    }
                                </View>
                            )}

                            {/* Step 3: Pick a Spot */}
                            <StepSectionHeader
                                stepNumber={3}
                                title={this.translate('pages.activityGenerator.headers.topSpaces')}
                                isActive={!!selectedSpace}
                                theme={this.theme}
                            />
                            <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                {
                                    isLoading
                                        ? <View style={spacingStyles.flex}>
                                            <LoadingPlaceholder />
                                        </View>
                                        : <View style={[{ display: 'flex' }, spacingStyles.padHorizSm]}>
                                            {
                                                topSpacesInView?.map((space) => {
                                                    const mediaPath = space.medias?.[0]?.path;
                                                    const mediaType = space.medias?.[0]?.type;

                                                    let postMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
                                                        ? getUserContentUri((space.medias?.[0]), screenWidth, screenWidth)
                                                        : content?.media?.[mediaPath];

                                                    return (
                                                        <CompactSpaceCard
                                                            key={space?.id}
                                                            space={space}
                                                            areaMedia={postMedia}
                                                            isSelected={space?.id === selectedSpace?.id}
                                                            onSelect={this.onSelectSpace}
                                                            onInspect={this.goToSpaceDetails}
                                                            isDarkMode={isDarkTheme(themeName)}
                                                            theme={this.theme}
                                                            themeForms={this.themeForms}
                                                            themeViewArea={this.themeViewArea}
                                                            translate={this.translate}
                                                        />
                                                    );
                                                })
                                            }
                                            {
                                                !topSpacesInView?.length &&
                                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                                    {this.translate('pages.activityGenerator.messages.noRecommendedSpaces')}
                                                </Text>
                                            }
                                            {
                                                topSpacesInView?.length > 0 && topSpacesSorted?.length > spaceListSize &&
                                                <View style={this.theme.styles.sectionDescriptionCentered}>
                                                    <Button
                                                        type="clear"
                                                        titleStyle={this.themeForms.styles.buttonLink}
                                                        title={this.translate(
                                                            !shouldShowMoreSpaces
                                                                ? 'pages.activityGenerator.buttons.showMore'
                                                                : 'pages.activityGenerator.buttons.showLess'
                                                        )}
                                                        onPress={this.onToggleShowMore}
                                                        icon={
                                                            <FontAwesome5Icon
                                                                name={!shouldShowMoreSpaces ?
                                                                    'chevron-down' :
                                                                    'chevron-up'
                                                                }
                                                                size={14}
                                                                style={this.themeForms.styles.buttonIconAlt}
                                                            />
                                                        }
                                                        iconRight
                                                    />
                                                </View>
                                            }
                                        </View>
                                }
                            </View>

                            {/* Step 4: Schedule Details */}
                            <StepSectionHeader
                                stepNumber={4}
                                title={this.translate('pages.activityGenerator.headers.scheduleDetails')}
                                isActive={!!inputs.title && !!inputs.notificationMsg}
                                theme={this.theme}
                            />
                            <View style={[this.themeSettingsForm.styles.settingsContainer]}>
                                <InputGroupName
                                    autoFocus={false}
                                    onChangeText={(text) =>
                                        this.onInputChange('title', text)
                                    }
                                    placeholder={this.translate('pages.activityGenerator.placeholders.groupName')}
                                    themeForms={this.themeForms}
                                    translate={this.translate}
                                    value={inputs.title}
                                />
                                <Button
                                    containerStyle={[spacingStyles.marginTopMd, spacingStyles.marginBotMd]}
                                    buttonStyle={this.themeForms.styles.buttonRoundAlt}
                                    disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                                    disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                    titleStyle={this.themeForms.styles.buttonTitleAlt}
                                    title={inputs.isPublic
                                        ? this.translate('forms.editEvent.buttons.visibilityPublic')
                                        : this.translate('forms.editEvent.buttons.visibilityPrivate')}
                                    type="outline"
                                    onPress={() => SheetManager.show('visibility-picker-sheet', {
                                        payload: {
                                            publicText: this.translate('forms.editEvent.buttons.visibilityPublic'),
                                            privateText: this.translate('forms.editEvent.buttons.visibilityPrivate'),
                                            themeForms: this.themeForms,
                                            onSelect: (isPublic) => this.onSetVisibility(isPublic),
                                        },
                                    })}
                                    raised={false}
                                    icon={
                                        <OctIcon
                                            name={inputs.isPublic ? 'globe' : 'people'}
                                            size={22}
                                            style={this.themeForms.styles.buttonIconAlt}
                                        />
                                    }
                                />
                                <View style={spacingStyles.marginBotMd}>
                                    <InputEventName
                                        translate={this.translate}
                                        onChangeText={(text) =>
                                            this.onInputChange('notificationMsg', text)
                                        }
                                        themeForms={this.themeForms}
                                        value={inputs.notificationMsg}
                                    />
                                </View>
                                <EventStartEndFormGroup
                                    themeForms={this.themeForms}
                                    isNightMode={isDarkTheme(themeName)}
                                    onConfirm={this.onConfirmDatePicker}
                                    translate={this.translate}
                                    startsAtValue={inputs.scheduleStartAt}
                                    stopsAtValue={inputs.scheduleStopAt}
                                />
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeMenu.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.buttonPrimary}
                        disabledStyle={this.themeForms.styles.buttonDisabled}
                        titleStyle={this.themeForms.styles.buttonTitle}
                        disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        title={this.translate(
                            'pages.activityGenerator.buttons.scheduleAndInvite'
                        )}
                        icon={
                            <TherrIcon
                                name="calendar"
                                size={24}
                                style={this.isFormDisabled()
                                    ? this.themeForms.styles.buttonIconDisabled
                                    : this.themeForms.styles.buttonIcon}
                            />
                        }
                        onPress={this.onSubmit}
                        disabled={this.isFormDisabled()}
                    />
                </View>
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

export default connect(mapStateToProps, mapDispatchToProps)(ActivityGenerator);
