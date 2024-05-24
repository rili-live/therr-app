import React from 'react';
import { SafeAreaView, View, Text, Pressable } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapActions } from 'therr-react/redux/actions';
import { IMapState, IUserState } from 'therr-react/types';
// import Toast from 'react-native-toast-message';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/settingsForm';
import BaseStatusBar from '../../components/BaseStatusBar';
import spacingStyles from '../../styles/layouts/spacing';
import { ILocationState } from '../../types/redux/location';


interface IActivityGeneratorDispatchProps {
    generateActivity: Function;
    updateUser: Function;
}

interface IStoreProps extends IActivityGeneratorDispatchProps {
    location: ILocationState;
    map: IMapState;
    user: IUserState;
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
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    generateActivity: MapActions.generateActivity,
    updateUser: UsersActions.update,
}, dispatch);

export class ActivityGenerator extends React.Component<IActivityGeneratorProps, IActivityGeneratorState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
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
        this.themeMenu = buildMenuStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSettingsForm = buildSettingsFormStyles(themeName);
    };

    handleRefresh = () => {
        console.log('refresh');
    };

    onSubmit = () => {
        console.log('submit');
    };

    render() {
        const { navigation, user, map } = this.props;
        const pageHeaderUser = this.translate('pages.activityGenerator.headers.socialRecommendations');
        // const currentUserImageUri = getUserImageUri(user, 200);

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
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {this.translate('pages.activityGenerator.headers.topConnections')}
                                </Text>
                                <View style={[{ display: 'flex' }, spacingStyles.padHorizSm]}>
                                    {
                                        map?.activityGeneration?.topConnections?.map((connection) => (
                                            <View key={connection?.user?.id} style={spacingStyles.fullWidth}>
                                                <Pressable onPress={() => this.goToUserDetails(connection.user.id)}>
                                                    <Text style={spacingStyles.marginBotMd}>
                                                        {`${connection?.user?.firstName} ${connection?.user?.lastName} - ${connection?.user?.userName}`}
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        ))
                                    }
                                    {
                                        !map?.activityGeneration?.topConnections?.length &&
                                        <Text style={this.theme.styles.sectionDescriptionCentered}>
                                            {this.translate('pages.activityGenerator.messages.noNearbyConnections')}
                                        </Text>
                                    }
                                </View>
                            </View>
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
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
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
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
