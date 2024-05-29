import React from 'react';
import { SafeAreaView, View, Text, Pressable, Dimensions } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import { ContentActions, MapActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState, IUserConnectionsState } from 'therr-react/types';
import {
    Content,
} from 'therr-js-utilities/constants';
// import Toast from 'react-native-toast-message';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
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
import { RefreshControl } from 'react-native-gesture-handler';
import LoadingPlaceholder from './LoadingPlaceholder';
import LoadingPlaceholderInterests from './LoadingPlaceholderInterests';

const { width: screenWidth } = Dimensions.get('window');

interface IActivityGeneratorDispatchProps {
    createOrUpdateSpaceReaction: Function;
    createUserConnection: Function;
    generateActivity: Function;
    updateUser: Function;
}

interface IStoreProps extends IActivityGeneratorDispatchProps {
    content: IContentState;
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
}

const mapStateToProps = (state) => ({
    content: state.content,
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

export class ActivityGenerator extends React.Component<IActivityGeneratorProps, IActivityGeneratorState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeViewArea = buildAreaStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();
    private themeForms = buildFormStyles();
    private themeSettingsForm = buildSettingsFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            isLoading: false,
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
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

    goToSpaceDetails = (space: any) => {
        const { navigation, user } = this.props;
        navigation.navigate('ViewSpace', {
            isMyContent:space?.fromUserId === user.details.id,
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
        const { isLoading } = this.state;
        return isLoading;
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

    handleRefresh = () => {
        const { location, generateActivity } = this.props;

        this.setState({
            isLoading: true,
        });

        generateActivity({
            latitude: location?.user?.latitude,
            longitude: location?.user?.longitude,
        }).then(() => {
            console.log('success');
        }).catch((err)=> {
            console.log(err);
        }).finally(() => {
            this.setState({
                isLoading: false,
            });
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

    onSubmit = () => {
        console.log('submit');
    };

    render() {
        const { content, map, navigation, user, userConnections } = this.props;
        const { isLoading } = this.state;
        const pageHeaderUser = this.translate('pages.activityGenerator.headers.socialRecommendations');
        // const currentUserImageUri = getUserImageUri(user, 200);
        const topConnections = map?.activityGeneration?.topConnections?.map((connection) => ({
            ...connection,
            isActive: userConnections?.activeConnections?.find((activeC) => activeC.id === connection.user.id),
        }));

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        // style={this.theme.styles.scrollViewFull}
                        style={this.theme.styles.scrollView}
                        refreshControl={<RefreshControl
                            refreshing={isLoading}
                            onRefresh={this.handleRefresh}
                        />}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {pageHeaderUser}
                                </Text>
                            </View>
                            <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {this.translate('pages.activityGenerator.headers.topConnections')}
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
                                                        key={connection.id}
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
                                                    {this.translate('pages.activityGenerator.messages.noNearbyConnections')}
                                                </Text>
                                            }
                                        </View>
                                }
                            </View>
                            <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {this.translate('pages.activityGenerator.headers.topSharedInterests')}
                                </Text>
                                { isLoading
                                    ? <View style={spacingStyles.flex}>
                                        <LoadingPlaceholderInterests />
                                    </View>
                                    : <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
                                        {
                                            Object.keys(map?.activityGeneration?.topSharedInterests || {})?.map((id) => {
                                                const interest = map?.activityGeneration?.topSharedInterests[id];
                                                return (
                                                    <Pressable
                                                        key={id}
                                                        style={[{ padding: 2, paddingHorizontal: 6, margin: 4 }]}
                                                    >
                                                        <Text>
                                                            {interest.emoji} {this.translate(interest.displayNameKey)} {interest.ranking}
                                                        </Text>
                                                    </Pressable>
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
                            <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {this.translate('pages.activityGenerator.headers.topSpaces')}
                                </Text>
                                {
                                    isLoading
                                        ? <View style={spacingStyles.flex}>
                                            <LoadingPlaceholder />
                                        </View>
                                        : <View style={[{ display: 'flex' }, spacingStyles.padHorizSm]}>
                                            {
                                                map?.activityGeneration?.topSpaces?.map((space) => {
                                                    const mediaPath = space.medias?.[0]?.path;
                                                    const mediaType = space.medias?.[0]?.type;

                                                    // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
                                                    let postMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
                                                        ? getUserContentUri((space.medias?.[0]), screenWidth, screenWidth)
                                                        : content?.media?.[mediaPath];

                                                    return (
                                                        <Pressable
                                                            key={space?.id}
                                                            style={this.theme.styles.areaContainer}
                                                            onPress={() => this.goToSpaceDetails(space)}
                                                        >
                                                            <AreaDisplayContent
                                                                key={space?.id}
                                                                hashtags={space.hashTags ? space.hashTags.split(',') : []}
                                                                isDarkMode={false}
                                                                area={space}
                                                                areaMedia={postMedia}
                                                                inspectContent={() => this.goToSpaceDetails(space)}
                                                                // onBookmarkPress={() => this.onBookmarkPress(space)}
                                                                theme={this.theme}
                                                                themeForms={this.themeForms}
                                                                themeViewArea={this.themeViewArea}
                                                                translate={this.translate}
                                                            />
                                                        </Pressable>
                                                    );
                                                })
                                            }
                                            {
                                                !map?.activityGeneration?.topSpaces?.length &&
                                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                                    {this.translate('pages.activityGenerator.messages.noRecommendedSpaces')}
                                                </Text>
                                            }
                                        </View>
                                }
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeMenu.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        title={this.translate(
                            'pages.activityGenerator.buttons.scheduleAndInvite'
                        )}
                        icon={
                            <TherrIcon
                                name="calendar"
                                size={24}
                                style={this.themeForms.styles.buttonIconDisabled}
                                // style={this.isFormDisabled()
                                //     ? this.themeForms.styles.buttonIconDisabled
                                //     : this.themeForms.styles.buttonIcon}
                            />
                        }
                        onPress={this.onSubmit}
                        disabled={true}
                        // disabled={this.isFormDisabled()}
                        raised={true}
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
