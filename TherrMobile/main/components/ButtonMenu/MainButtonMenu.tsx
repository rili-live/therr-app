import React from 'react';
import { ActivityIndicator, Dimensions, View } from 'react-native';
import { connect } from 'react-redux';
import { Button, Image } from 'react-native-elements';
import 'react-native-gesture-handler';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {
    AttachStep,
} from 'react-native-spotlight-tour';
import TherrIcon from '../../components/TherrIcon';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from './';
import { getUserImageUri } from '../../utilities/content';
import { HAPTIC_FEEDBACK_TYPE, PEOPLE_CAROUSEL_TABS } from '../../constants';
import { isUserAuthenticated } from '../../utilities/authUtils';
// import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';

const { width: screenWidth } = Dimensions.get('window');
const buttonWidth = screenWidth / 5;

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

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
        ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);
        const { navigation, user } = this.props;

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

        ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);

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

    onNavPressDynamic = (viewDestinationName: string) => {
        const { onActionButtonPress } = this.props;
        const currentScreen = this.getCurrentScreen();

        if (currentScreen === viewDestinationName && onActionButtonPress)     {
            onActionButtonPress();
        } else {
            this.navTo(viewDestinationName);
        }
    };

    handleNearbyPress = () => {
        const { navigation, onNearbyPress, user } = this.props;

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
        } else if (onNearbyPress) {
            onNearbyPress();
        } else {
            this.onNavPressDynamic('Nearby');
        }
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
                                name="ul-list"
                                size={22}
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
                    title={!isCompact ? translate('menus.main.buttons.nearby') : null}
                    buttonStyle={
                        activeRoute === 'Nearby'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={[
                        ( activeRoute === 'Nearby'
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer),
                        {
                            width: buttonWidth,
                        },
                    ]}
                    titleStyle={
                        activeRoute === 'Nearby'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="nearby"
                            size={24}
                            style={
                                activeRoute === 'Nearby'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.handleNearbyPress()}
                />
                <AttachStep index={6}>
                    <Button
                        title={!isCompact ? translate('menus.main.buttons.map') : null}
                        buttonStyle={
                            activeRoute === 'Map'
                                ? themeMenu.styles.buttonsActive
                                : themeMenu.styles.buttons
                        }
                        containerStyle={[
                            (activeRoute === 'Map'
                                ? themeMenu.styles.buttonContainerActive
                                : themeMenu.styles.buttonContainer),
                            {
                                width: buttonWidth,
                            },
                        ]}
                        titleStyle={
                            activeRoute === 'Map'
                                ? themeMenu.styles.buttonsTitleActive
                                : themeMenu.styles.buttonsTitle
                        }
                        icon={
                            <TherrIcon
                                name="map"
                                size={22}
                                style={
                                    activeRoute === 'Map'
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
