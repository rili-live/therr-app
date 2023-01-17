import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { connect } from 'react-redux';
import { Button, Image } from 'react-native-elements';
import 'react-native-gesture-handler';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import TherrIcon from '../../components/TherrIcon';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from './';
import { getUserImageUri } from '../../utilities/content';
// import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

class MainButtonMenuAlt extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    navTo = (routeName, params = {}) => {
        ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);
        const { navigation } = this.props;

        navigation.navigate(routeName, params);
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

        ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);

        if (currentScreen === 'ViewUser') {
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
        const { onNearbyPress } = this.props;

        if (onNearbyPress) {
            onNearbyPress();
        } else {
            this.onNavPressDynamic('Nearby');
        }
    };

    render() {
        const { isCompact, translate, themeMenu, user } = this.props;
        const currentScreen = this.getCurrentScreen();
        // const hasNotifications = notifications.messages && notifications.messages.some(m => m.isUnread);
        const isConnectViewActive = currentScreen === 'Contacts';
        let imageStyle = {
            height: 26,
            width: 26,
            borderRadius: 15,
        };

        return (
            <ButtonMenu {...this.props}>
                <Button
                    title={!isCompact ? translate('menus.main.buttons.list') : null}
                    buttonStyle={
                        currentScreen === 'Areas'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={
                        currentScreen === 'Areas'
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer
                    }
                    titleStyle={
                        currentScreen === 'Areas'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="ul-list"
                            size={22}
                            style={
                                currentScreen === 'Areas'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.onNavPressDynamic('Areas')}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.map') : null}
                    buttonStyle={
                        currentScreen === 'Map'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={
                        currentScreen === 'Map'
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer
                    }
                    titleStyle={
                        currentScreen === 'Map'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="map"
                            size={22}
                            style={
                                currentScreen === 'Map'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.onNavPressDynamic('Map')}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.nearby') : null}
                    buttonStyle={
                        currentScreen === 'Nearby'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={
                        currentScreen === 'Nearby'
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer
                    }
                    titleStyle={
                        currentScreen === 'Nearby'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="nearby"
                            size={24}
                            style={
                                currentScreen === 'Nearby'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.handleNearbyPress()}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.connect') : null}
                    buttonStyle={
                        isConnectViewActive
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={
                        isConnectViewActive
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer
                    }
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
                    onPress={() => this.navTo('Contacts', {
                        activeTab: 'connections',
                    })}
                />
                <View style={
                    currentScreen === 'ViewUser'
                        ? themeMenu.styles.buttonContainerActive
                        : themeMenu.styles.buttonContainer
                }>
                    <Button
                        buttonStyle={themeMenu.styles.buttons}
                        containerStyle={themeMenu.styles.buttonContainerUserProfile}
                        titleStyle={themeMenu.styles.buttonsTitle}
                        icon={
                            <Image
                                source={{ uri: getUserImageUri(user, 50) }}
                                style={imageStyle}
                                PlaceholderContent={<ActivityIndicator size="small" color={themeMenu.colors.primary} />}
                            />}
                        onPress={() => this.goToMyProfile()}
                        title={translate('menus.main.buttons.profile')}
                        type="clear"
                    />
                    {/* {
                        hasNotifications && <View style={themeMenu.styles.notificationCircle2} />
                    } */}
                </View>
            </ButtonMenu>
        );
    }
}

export default (connect(mapStateToProps, mapDispatchToProps)(React.memo(MainButtonMenuAlt)));
