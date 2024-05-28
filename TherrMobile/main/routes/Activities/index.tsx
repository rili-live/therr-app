import React from 'react';
import { SafeAreaView, View, Text, Pressable } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { IMapState, IUserState, IUserConnectionsState } from 'therr-react/types';
// import Toast from 'react-native-toast-message';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/settingsForm';
import BaseStatusBar from '../../components/BaseStatusBar';
import spacingStyles from '../../styles/layouts/spacing';
import { ILocationState } from '../../types/redux/location';
import ConnectionItem from '../Connect/components/ConnectionItem';


interface IActivityGeneratorDispatchProps {
    createUserConnection: Function;
    generateActivity: Function;
    updateUser: Function;
}

interface IStoreProps extends IActivityGeneratorDispatchProps {
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
    isSubmitting: boolean;
}

const mapStateToProps = (state) => ({
    location: state.location,
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUserConnection: UserConnectionsActions.create,
    generateActivity: MapActions.generateActivity,
    updateUser: UsersActions.update,
}, dispatch);

export class ActivityGenerator extends React.Component<IActivityGeneratorProps, IActivityGeneratorState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();
    private themeForms = buildFormStyles();
    private themeSettingsForm = buildSettingsFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            isSubmitting: false,
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        const { location, navigation, generateActivity } = this.props;

        navigation.setOptions({
            title: this.translate('pages.activityGenerator.headerTitle'),
        });

        this.setState({
            isSubmitting: true,
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
                isSubmitting: false,
            });
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
        const { isSubmitting } = this.state;
        return isSubmitting;
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeButtons = buildButtonStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSettingsForm = buildSettingsFormStyles(themeName);
    };

    handleRefresh = () => {
        console.log('refresh');
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
        const { map, navigation, user, userConnections } = this.props;
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
                        style={this.theme.styles.scrollViewFull}
                        // style={this.theme.styles.scrollView}
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
                                <View style={[{ display: 'flex' }]}>
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
                            </View>
                            <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {this.translate('pages.activityGenerator.headers.topSharedInterests')}
                                </Text>
                                <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
                                    {
                                        Object.keys(map?.activityGeneration?.topSharedInterests || {})?.map((id) => {
                                            const interest = map?.activityGeneration?.topSharedInterests[id];
                                            return (
                                                <Pressable
                                                    key={id}
                                                    style={[{ padding: 2, paddingHorizontal: 6, margin: 4 }]}
                                                >
                                                    <Text>
                                                        {interest.emoji} {this.translate(interest.displayNameKey)}
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
                            </View>
                            <View style={[this.themeSettingsForm.styles.settingsContainer, spacingStyles.padBotLg]}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {this.translate('pages.activityGenerator.headers.topSpaces')}
                                </Text>
                                <View style={[{ display: 'flex' }, spacingStyles.padHorizSm]}>
                                    {
                                        map?.activityGeneration?.topSpaces?.map((space) => (
                                            <View key={space?.id} style={spacingStyles.flexOne}>
                                                <Pressable onPress={() => this.goToSpaceDetails(space)}>
                                                    <Text style={spacingStyles.marginBotMd}>
                                                        {this.getSpaceHeading(space)}
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        ))
                                    }
                                    {
                                        !map?.activityGeneration?.topSpaces?.length &&
                                        <Text style={this.theme.styles.sectionDescriptionCentered}>
                                            {this.translate('pages.activityGenerator.messages.noRecommendedSpaces')}
                                        </Text>
                                    }
                                </View>
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                {/* <View style={this.themeMenu.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        title={this.translate(
                            'pages.activityGenerator.buttons.generate'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isFormDisabled()}
                        raised={true}
                    />
                </View> */}
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
