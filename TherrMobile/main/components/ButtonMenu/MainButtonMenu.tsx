import React from 'react';
import { ActivityIndicator, Dimensions, View } from 'react-native';
import { connect } from 'react-redux';
import { Button, Image } from 'react-native-elements';
import 'react-native-gesture-handler';
// import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {
    AttachStep,
} from 'react-native-spotlight-tour';
import TherrIcon from '../../components/TherrIcon';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from './';
import { getUserImageUri } from '../../utilities/content';
import { GROUPS_CAROUSEL_TABS, PEOPLE_CAROUSEL_TABS } from '../../constants';
import { isUserAuthenticated } from '../../utilities/authUtils';
import Toast from 'react-native-toast-message';
import LottieView from 'lottie-react-native';
// import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';

const { width: screenWidth } = Dimensions.get('window');
const buttonWidth = screenWidth / 5;
const discoverContentLoader = require('../../assets/ftui-discover.json');
const matchUpLoader = require('../../assets/match-up.json');

// const hapticFeedbackOptions = {
//     enableVibrateFallback: false,
//     ignoreAndroidSystemSettings: false,
// };

const ViewProfileButton = ({
    activeRoute,
    goToMyProfile,
    imageStyle,
    themeMenu,
    translate,
    user,
}) => (
    <View style={[
        (activeRoute === 'ViewUser'
            ? themeMenu.styles.buttonContainerActive
            : themeMenu.styles.buttonContainer),
        {
            width: buttonWidth,
        },
    ]}>
        <Button
            buttonStyle={themeMenu.styles.buttons}
            containerStyle={themeMenu.styles.buttonContainerUserProfile}
            titleStyle={themeMenu.styles.buttonsTitle}
            icon={
                isUserAuthenticated(user) ?
                    <Image
                        source={{ uri: getUserImageUri(user, 50) }}
                        style={imageStyle}
                        PlaceholderContent={<ActivityIndicator size="small" color={themeMenu.colors.primary} />}
                    /> :
                    <TherrIcon
                        name="user-star"
                        size={22}
                        style={themeMenu.styles.buttonIcon}
                    />
            }
            onPress={goToMyProfile}
            title={translate('menus.main.buttons.profile')}
            type="clear"
        />
        {/* {
            hasNotifications && <View style={themeMenu.styles.notificationCircle2} />
        } */}
    </View>
);

class MainButtonMenuAlt extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    navTo = (routeName, params = {}) => {
        // ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);
        const { navigation, translate, user } = this.props;

        if (!isUserAuthenticated(user)) {
            if (routeName === 'Areas') {
                this.showPublicUserToast({
                    lottieLoader: discoverContentLoader,
                    title: translate('alertTitles.loginRequired'),
                    message: translate('alertMessages.discoverRequiresLogin'),
                });
            } else if (routeName === 'Connect') {
                this.showPublicUserToast({
                    lottieLoader: matchUpLoader,
                    title: translate('alertTitles.loginRequired'),
                    message: translate('alertMessages.matchupRequiresLogin'),
                });
            } else {
                navigation.reset({
                    index: 1,
                    routes: [
                        {
                            name: 'Map',
                        },
                        {
                            name: 'Register',
                        },
                    ],
                });
            }
        } else {
            navigation.navigate(routeName, params);
        }
    };

    getActionButtonIcon = (currentScreen) => {
        if (currentScreen === 'Map') {
            return 'ellipsis-h';
        }

        if (currentScreen === 'Areas' || currentScreen === 'Nearby' || currentScreen === 'Notifications') {
            return 'arrow-up';
        }

        return 'sync';
    };

    getActionButtonTitle = ({
        isCompact,
        currentScreen,
        translate,
    }) => {
        if (isCompact) {
            return '';
        }

        if (currentScreen === 'Map') {
            return translate('menus.main.buttons.toggle');
        }

        if (currentScreen === 'Areas' || currentScreen === 'Notifications' || currentScreen === 'Nearby') {
            return translate('menus.main.buttons.goToTop');
        }

        return translate('menus.main.buttons.refresh');
    };

    goToMyProfile = () => {
        const { navigation, user } = this.props;
        const currentScreen = this.getCurrentScreen();

        // ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);

        if (!isUserAuthenticated(user)) {
            navigation.reset({
                index: 1,
                routes: [
                    {
                        name: 'Map',
                    },
                    {
                        name: 'Login',
                    },
                ],
            });
        } else if (currentScreen === 'ViewUser') {
            navigation.setParams({
                userInView: {
                    id: user.details.id,
                },
            });
        } else {
            navigation.navigate('ViewUser', {
                userInView: {
                    id: user.details.id,
                },
            });
        }
    };

    onNavPressDynamic = (viewDestinationName: string, viewDestinationParams = {}) => {
        const { onActionButtonPress } = this.props;
        const currentScreen = this.getCurrentScreen();

        if (currentScreen === viewDestinationName && onActionButtonPress)     {
            onActionButtonPress();
        } else {
            this.navTo(viewDestinationName, viewDestinationParams);
        }
    };

    handleGroupsPress = () => {
        const { translate, user } = this.props;

        if (!isUserAuthenticated(user)) {
            this.showPublicUserToast({
                lottieLoader: matchUpLoader,
                title: translate('alertTitles.loginRequired'),
                message: translate('alertMessages.groupsRequireLogin'),
            });
        } else {
            this.onNavPressDynamic('Groups', {
                activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
            });
        }
    };

    showPublicUserToast = ({
        lottieLoader,
        message,
        title,
    }) => {
        const { navigation } = this.props;

        Toast.show({
            type: 'notifyPublic',
            text1: title,
            text2: message,
            visibilityTime: 4000,
            onPress: () => {
                Toast.hide();
                navigation.reset({
                    index: 1,
                    routes: [
                        {
                            name: 'Map',
                        },
                        {
                            name: 'Login',
                        },
                    ],
                });
            },
            position: 'bottom',
            props: {
                extraStyle: { minHeight: 90, marginBottom: 10 },
                renderTrailingIcon: () => (
                    <LottieView
                        source={lottieLoader}
                        resizeMode="contain"
                        speed={0.5}
                        autoPlay
                        loop
                        style={{ width: 75, height: '100%', marginRight: 10 }}
                    />
                ),
            },
        });
    };

    render() {
        const { isCompact, translate, themeMenu, user } = this.props;
        const activeRoute = this.getActiveRoute();
        // const hasNotifications = notifications.messages && notifications.messages.some(m => m.isUnread);
        const isConnectViewActive = activeRoute === 'Connect';
        let imageStyle = {
            height: 26,
            width: 26,
            borderRadius: 15,
        };

        return (
            <ButtonMenu {...this.props}>
                <AttachStep index={2}>
                    <Button
                        title={!isCompact ? translate('menus.main.buttons.list') : null}
                        buttonStyle={
                            activeRoute === 'Areas'
                                ? themeMenu.styles.buttonsActive
                                : themeMenu.styles.buttons
                        }
                        containerStyle={[
                            (activeRoute === 'Areas'
                                ? themeMenu.styles.buttonContainerActive
                                : themeMenu.styles.buttonContainer),
                            {
                                width: buttonWidth,
                            },
                        ]}
                        titleStyle={
                            activeRoute === 'Areas'
                                ? themeMenu.styles.buttonsTitleActive
                                : themeMenu.styles.buttonsTitle
                        }
                        icon={
                            <TherrIcon
                                name="nearby"
                                size={24}
                                style={
                                    activeRoute === 'Areas'
                                        ? themeMenu.styles.buttonIconActive
                                        : themeMenu.styles.buttonIcon
                                }
                            />
                        }
                        onPress={() => this.onNavPressDynamic('Areas')}
                    />
                </AttachStep>
                <Button
                    title={!isCompact ? translate('menus.main.buttons.groups') : null}
                    buttonStyle={
                        ['Groups', 'ActivityScheduler'].includes(activeRoute)
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={[
                        ( ['Groups', 'ActivityScheduler'].includes(activeRoute)
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer),
                        {
                            width: buttonWidth,
                        },
                    ]}
                    titleStyle={
                        ['Groups', 'ActivityScheduler'].includes(activeRoute)
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="group"
                            size={24}
                            style={
                                ['Groups', 'ActivityScheduler'].includes(activeRoute)
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.handleGroupsPress()}
                />
                <AttachStep index={6}>
                    <Button
                        title={!isCompact ? translate('menus.main.buttons.map') : null}
                        buttonStyle={
                            ['Map', 'ActivityGenerator'].includes(activeRoute)
                                ? themeMenu.styles.buttonsActive
                                : themeMenu.styles.buttons
                        }
                        containerStyle={[
                            (['Map', 'ActivityGenerator'].includes(activeRoute)
                                ? themeMenu.styles.buttonContainerActive
                                : themeMenu.styles.buttonContainer),
                            {
                                width: buttonWidth,
                            },
                        ]}
                        titleStyle={
                            ['Map', 'ActivityGenerator'].includes(activeRoute)
                                ? themeMenu.styles.buttonsTitleActive
                                : themeMenu.styles.buttonsTitle
                        }
                        icon={
                            <TherrIcon
                                name="map"
                                size={22}
                                style={
                                    ['Map', 'ActivityGenerator'].includes(activeRoute)
                                        ? themeMenu.styles.buttonIconActive
                                        : themeMenu.styles.buttonIcon
                                }
                            />
                        }
                        onPress={() => this.onNavPressDynamic('Map')}
                    />
                </AttachStep>
                <AttachStep index={5}>
                    <Button
                        title={!isCompact ? translate('menus.main.buttons.connect') : null}
                        buttonStyle={
                            isConnectViewActive
                                ? themeMenu.styles.buttonsActive
                                : themeMenu.styles.buttons
                        }
                        containerStyle={[
                            (isConnectViewActive
                                ? themeMenu.styles.buttonContainerActive
                                : themeMenu.styles.buttonContainer),
                            {
                                width: buttonWidth,
                            },
                        ]}
                        titleStyle={
                            isConnectViewActive
                                ? themeMenu.styles.buttonsTitleActive
                                : themeMenu.styles.buttonsTitle
                        }
                        icon={
                            <TherrIcon
                                name="key-user"
                                size={22}
                                style={
                                    isConnectViewActive
                                        ? themeMenu.styles.buttonIconActive
                                        : themeMenu.styles.buttonIcon
                                }
                            />
                        }
                        onPress={() => {
                            this.navTo('Connect', {
                                activeTab: PEOPLE_CAROUSEL_TABS.PEOPLE,
                            });
                            this.onNavPressDynamic('Connect');
                        }}
                    />
                </AttachStep>
                {/* {
                    isUserAuthenticated(user) ?
                        <ViewProfileButton
                            activeRoute={activeRoute}
                            goToMyProfile={this.goToMyProfile}
                            imageStyle={imageStyle}
                            themeMenu={themeMenu}
                            translate={translate}
                            user={user}
                        /> :
                        <AttachStep index={4}>
                            <ViewProfileButton
                                activeRoute={activeRoute}
                                goToMyProfile={this.goToMyProfile}
                                imageStyle={imageStyle}
                                themeMenu={themeMenu}
                                translate={translate}
                                user={user}
                            />
                        </AttachStep>
                } */}
                <ViewProfileButton
                    activeRoute={activeRoute}
                    goToMyProfile={this.goToMyProfile}
                    imageStyle={imageStyle}
                    themeMenu={themeMenu}
                    translate={translate}
                    user={user}
                />
            </ButtonMenu>
        );
    }
}

export default (connect(mapStateToProps, mapDispatchToProps)(React.memo(MainButtonMenuAlt)));
