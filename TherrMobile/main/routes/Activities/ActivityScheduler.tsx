import React from 'react';
import { SafeAreaView, View, Text, Pressable, Dimensions } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
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
import translator from '../../services/translator';
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
import { AreaDisplayContent } from '../../components/UserContent/AreaDisplayMedium';
import { getUserContentUri } from '../../utilities/content';
import TherrIcon from '../../components/TherrIcon';
import LoadingPlaceholder from './LoadingPlaceholder';
import InputEventName from '../Events/InputEventName';
import InputGroupName from '../Groups/InputGroupName';
import EventStartEndFormGroup from '../Events/EventStartEndFormGroup';
import { DEFAULT_RADIUS, GROUPS_CAROUSEL_TABS } from '../../constants';
import { SheetManager } from 'react-native-actions-sheet';
import LottieView from 'lottie-react-native';

const { width: screenWidth } = Dimensions.get('window');
const DEFAULT_SPACES_LIST_SIZE = 3;
const matchUpLoader = require('../../assets/match-up.json');

interface IActivitySchedulerDispatchProps {
    createOrUpdateSpaceReaction: Function;
    createUserConnection: Function;
    generateActivity: Function;
    updateUser: Function;
}

interface IStoreProps extends IActivitySchedulerDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IActivitySchedulerProps extends IStoreProps {
    navigation: any;
    route: any;
    forums: IForumsState;
}

interface IActivitySchedulerState {
    categories: any[];
    inputs: any;
    isLoading: boolean;
    isSubmitting: boolean;
    shouldShowMoreSpaces: boolean;
    selectedSpace?: any;
    spaceListSize: number;
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
    updateUser: UsersActions.update,
}, dispatch);

export class ActivityScheduler extends React.Component<IActivitySchedulerProps, IActivitySchedulerState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeViewArea = buildAreaStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();
    private themeForms = buildFormStyles();
    private themeSettingsForm = buildSettingsFormStyles();

    static getDerivedStateFromProps(nextProps: IActivitySchedulerProps, nextState: IActivitySchedulerState) {
        if (!nextState.categories || !nextState.categories.length) {
            return {
                categories: nextProps.forums.forumCategories,
            };
        }

        return null;
    }

    constructor(props) {
        super(props);

        const { route } = props;
        const { categories } = route.params || {};

        this.state = {
            categories: (categories || []).map(c => ({ ...c, isActive: false })),
            inputs: {
                isDraft: false,
                isPublic: false,
                radius: DEFAULT_RADIUS,
                category: '',
                message: '',
                notificationMsg: '',
                hashTags: '',
                scheduleStartAt: new Date(),
                scheduleStopAt: new Date(),
            },
            isLoading: false,
            isSubmitting: false,
            shouldShowMoreSpaces: false,
            spaceListSize: DEFAULT_SPACES_LIST_SIZE,
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.activityScheduler.headerTitle'),
        });
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
            isMyContent:space?.fromUserId === user.details.id,
            previousView: 'ActivityScheduler',
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
        const { inputs, isLoading, isSubmitting, selectedSpace } = this.state;
        return (
            !inputs.title ||
            // !inputs.description ||
            !inputs.notificationMsg ||
            !selectedSpace?.id ||
            isLoading ||
            isSubmitting
        );
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeViewArea = buildAreaStyles();
        this.themeButtons = buildButtonStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSettingsForm = buildSettingsFormStyles(themeName);
    };

    onConfirmDatePicker = (variation: 'start' | 'end', date) => {
        const pickerStateKey = variation === 'start'
            ? 'scheduleStartAt'
            : 'scheduleStopAt';
        const newInputChanges = {
            [pickerStateKey]: date,
        };

        if (this.scrollViewRef) {
            // EEEWWWWW...but how else??
            setTimeout(() => {
                this.scrollViewRef.scrollToEnd();
            }, 100);
        }

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            isSubmitting: false,
        });
    };

    onInputChange = (name: string, value: string | undefined) => {
        let modifiedValue = value;
        const newInputChanges = {
            [name]: modifiedValue,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            isSubmitting: false,
        });
    };

    onSendConnectRequest = (acceptingUser: any) => {
        const { createUserConnection, user } = this.props;
        // TODO: Send connection request
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

    onSetVisibility = (isPublic: boolean) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                isPublic,
            },
        });
    };

    onToggleShowMore = () => {
        this.setState({
            shouldShowMoreSpaces: !this.state.shouldShowMoreSpaces,
        });
    };

    onSubmit = () => {
        const { map, user } = this.props;
        const {
            isPublic,
            // message,
            notificationMsg,
            radius,
            scheduleStartAt,
            scheduleStopAt,
            title,

            administratorIds,
            subtitle,
            categories,
            hashtags,
            integrationIds,
            invitees,
            iconGroup,
            iconId,
            iconColor,
            maxCommentsPerMin,
            doesExpire,
        } = this.state.inputs;

        if (scheduleStopAt - scheduleStartAt <= 0) {
            showToast.error({
                text1: this.translate('alertTitles.startDateAfterEndDate'),
                text2: this.translate('alertMessages.startDateAfterEndDate'),
            });

            return;
        }

        const requestBody = {
            group: {
                administratorIds: [user.details.id, ...(administratorIds || [])].join(','),
                title,
                subtitle: subtitle || title,
                description: 'Hangout w/ local friends',
                categoryTags: categories?.filter(c => c.isActive).map(c => c.tag) || ['general'],
                hashTags: hashtags?.join(','),
                integrationIds: integrationIds ? integrationIds.join(',') : '',
                invitees: invitees ? invitees.join('') : '',
                iconGroup: iconGroup || 'font-awesome-5',
                iconId: iconId || 'star',
                iconColor: iconColor || 'black',
                maxCommentsPerMin,
                memberIds: map?.activityGeneration?.topConnections?.map((connection) => connection?.user?.id),
                doesExpire,
                isPublic,
            },
            event: {
                isPublic,
                notificationMsg, // Name
                message: `Hangout @ ${this.state.selectedSpace?.notificationMsg}`,
                radius,
                spaceId: this.state.selectedSpace?.id,
                scheduleStartAt,
                scheduleStopAt,
                latitude: this.state.selectedSpace?.latitude,
                longitude:  this.state.selectedSpace?.longitude,
                userLatitude: this.state.selectedSpace?.latitude,
                userLongitude:  this.state.selectedSpace?.longitude,
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

    render() {
        const { content, map, navigation, user, userConnections } = this.props;
        const { inputs, isLoading, shouldShowMoreSpaces, spaceListSize, selectedSpace } = this.state;
        // const currentUserImageUri = getUserImageUri(user, 200);
        const topConnections = [...map?.activityGeneration?.topConnections]?.map((connection) => ({
            ...connection,
            isActive: userConnections?.activeConnections?.find((activeC) => activeC.id === connection.user.id),
        }));
        topConnections.unshift({
            user: {
                ...user.details,
            },
            isActive: true,
        });
        const topSpacesSorted = [...map?.activityGeneration?.topSpaces].sort((a, b) => {
            if (a.id === selectedSpace?.id) {
                return -1;
            } else if (b.id === selectedSpace?.id) {
                return 1;
            }

            return 0;
        });
        const topSpacesInView = shouldShowMoreSpaces
            ? topSpacesSorted
            : topSpacesSorted?.slice(0, spaceListSize);

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        // style={this.theme.styles.scrollViewFull}
                        style={this.theme.styles.scrollView}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                    {this.translate('pages.activityScheduler.headers.schedulerExplained')}
                                </Text>
                            </View>
                            <View style={[this.themeSettingsForm.styles.settingsContainer]}>
                                <InputGroupName
                                    autoFocus
                                    onChangeText={(text) =>
                                        this.onInputChange('title', text)
                                    }
                                    placeholder={this.translate('pages.activityScheduler.placeholders.groupName')}
                                    themeForms={this.themeForms}
                                    translate={this.translate}
                                    value={inputs.title}
                                />
                                <Button
                                    containerStyle={spacingStyles.marginBotMd}
                                    buttonStyle={this.themeForms.styles.buttonRoundAlt}
                                    // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
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
                            </View>
                            <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {this.translate('pages.activityScheduler.headers.groupMembers')}
                                </Text>
                                {
                                    isLoading
                                        ? <View style={spacingStyles.flex}>
                                            <LoadingPlaceholder />
                                        </View>
                                        : <View style={spacingStyles.flex}>
                                            {
                                                topConnections?.map((connection) => (
                                                    <ConnectionItem
                                                        key={connection?.user?.id}
                                                        connectionDetails={connection?.user}
                                                        getConnectionSubtitle={this.getConnectionSubtitle}
                                                        goToViewUser={this.goToUserDetails}
                                                        isActive={connection.isActive}
                                                        onConnectionPress={this.onConnectionPress}
                                                        theme={this.theme}
                                                        translate={this.translate}
                                                    />
                                                ))
                                            }
                                            {
                                                !topConnections?.length &&
                                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                                    {this.translate('pages.activityScheduler.messages.noNearbyConnections')}
                                                </Text>
                                            }
                                        </View>
                                }
                            </View>
                            <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {this.translate('pages.activityScheduler.headers.chooseALocation')}
                                </Text>
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

                                                    // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
                                                    let postMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
                                                        ? getUserContentUri((space.medias?.[0]), screenWidth, screenWidth)
                                                        : content?.media?.[mediaPath];

                                                    return (
                                                        <Pressable
                                                            key={space?.id}
                                                            style={[
                                                                (space?.id === selectedSpace?.id)
                                                                    ? this.theme.styles.areaContainerButtonSelected
                                                                    : this.theme.styles.areaContainerButton,
                                                            ]}
                                                            onPress={() => this.onSelectSpace(space)}
                                                        >
                                                            <AreaDisplayContent
                                                                key={space?.id}
                                                                hashtags={space.hashTags ? space.hashTags.split(',') : []}
                                                                isDarkMode={false}
                                                                area={space}
                                                                areaMedia={postMedia}
                                                                inspectContent={() => this.onSelectSpace(space)}
                                                                // onBookmarkPress={() => this.onBookmarkPress(space)}
                                                                theme={this.theme}
                                                                themeForms={this.themeForms}
                                                                themeViewArea={this.themeViewArea}
                                                                translate={this.translate}
                                                            />
                                                            <View style={{
                                                                width: 30,
                                                            }}>
                                                                <OctIcon
                                                                    name={(space?.id === selectedSpace?.id) ?
                                                                        'check' :
                                                                        'circle'
                                                                    }
                                                                    size={18}
                                                                    color={(space?.id === selectedSpace?.id) ?
                                                                        this.theme.colors.primary3 :
                                                                        this.theme.colors.accentDivider
                                                                    }
                                                                />
                                                                {/* {
                                                                    (space?.id === selectedSpace?.id) ?
                                                                        <Badge
                                                                            badgeStyle={{ backgroundColor: this.theme.colors.primary3 }}
                                                                        /> :
                                                                        <Badge
                                                                            badgeStyle={{ backgroundColor: this.theme.colors.accentDivider }}
                                                                        />
                                                                } */}
                                                            </View>
                                                        </Pressable>
                                                    );
                                                })
                                            }
                                            {
                                                !topSpacesInView?.length &&
                                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                                    {this.translate('pages.activityScheduler.messages.noRecommendedSpaces')}
                                                </Text>
                                            }
                                            {
                                                topSpacesInView?.length > 0 && topSpacesSorted?.length > spaceListSize &&
                                                <View style={this.theme.styles.sectionDescriptionCentered}>
                                                    <Button
                                                        type="clear"
                                                        titleStyle={this.themeForms.styles.buttonLink}
                                                        title={this.translate(
                                                            !shouldShowMoreSpaces ?
                                                                'pages.activityScheduler.buttons.showMore' :
                                                                'pages.activityScheduler.buttons.showLess'
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
                            <View style={[this.themeSettingsForm.styles.settingsContainer]}>
                                <InputEventName
                                    translate={this.translate}
                                    onChangeText={(text) =>
                                        this.onInputChange('notificationMsg', text)
                                    }
                                    themeForms={this.themeForms}
                                    value={inputs.notificationMsg}
                                />
                                <EventStartEndFormGroup
                                    themeForms={this.themeForms}
                                    isNightMode={isDarkTheme(user.settings?.mobileThemeName)}
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
                            'pages.activityScheduler.buttons.createAndSend'
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

export default connect(mapStateToProps, mapDispatchToProps)(ActivityScheduler);
