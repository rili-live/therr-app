import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from '.';
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

    navTo = (routeName) => {
        // const { location, navigation, translate, updateGpsStatus } = this.props;
        ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);
        const { navigation } = this.props;

        // if (routeName === 'Map') {
        //     requestLocationServiceActivation({
        //         isGpsEnabled: location.settings.isGpsEnabled,
        //         translate,
        //         shouldIgnoreRequirement: true,
        //     }).then((response: any) => {
        //         if (response?.status) {
        //             return updateGpsStatus(response.status); // wait for redux state to update
        //         }

        //         return Promise.resolve();
        //     }).then(() => {
        //         navigation.navigate(routeName);
        //     }).catch((error) => {
        //         // TODO: Allow viewing map when gps is disable
        //         // but disallow GPS required actions like viewing/deleting moments
        //         console.log(error);
        //     });
        // } else {
        //     navigation.navigate(routeName);
        // }

        navigation.navigate(routeName);
    };

    getActionButtonIcon = (currentScreen) => {
        if (currentScreen === 'Map') {
            return 'ellipsis-h';
        }

        if (currentScreen === 'Areas' || currentScreen === 'Nearby' || currentScreen === 'Notifications') {
            return 'arrow-up';
        }

        return 'sync';
    }

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
    }

    render() {
        const { onActionButtonPress, isCompact, translate, themeMenu } = this.props;
        const currentScreen = this.getCurrentScreen();
        // const isMessageViewActive = currentScreen === 'Contacts' || currentScreen === 'ActiveConnections' || currentScreen === 'CreateConnection';

        return (
            <ButtonMenu {...this.props}>
                <Button
                    title={!isCompact ? translate('menus.main.buttons.list') : null}
                    buttonStyle={
                        currentScreen === 'Areas'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={
                        currentScreen === 'Areas'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="list"
                            size={20}
                            style={
                                currentScreen === 'Areas'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Areas')}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.map') : null}
                    buttonStyle={
                        currentScreen === 'Map'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={
                        currentScreen === 'Map'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="globe-americas"
                            size={20}
                            style={
                                currentScreen === 'Map'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Map')}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.connect') : null}
                    buttonStyle={
                        currentScreen === 'Contacts'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={
                        currentScreen === 'Contacts'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="user-friends"
                            size={20}
                            style={
                                currentScreen === 'Contacts'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Contacts')}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.nearby') : null}
                    buttonStyle={
                        currentScreen === 'Nearby'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={
                        currentScreen === 'Nearby'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <MaterialIcon
                            name="radar"
                            size={24}
                            style={
                                currentScreen === 'Nearby'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Nearby')}
                />
                {/* <Button
                    title={!isCompact ? translate('menus.main.buttons.account') : null}
                    buttonStyle={
                        currentScreen === 'Settings'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={
                        currentScreen === 'Settings'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="user-cog"
                            size={20}
                            style={
                                currentScreen === 'Settings'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Settings')}
                /> */}
                {
                    onActionButtonPress &&
                    <Button
                        buttonStyle={themeMenu.styles.buttons}
                        containerStyle={themeMenu.styles.buttonContainer}
                        titleStyle={themeMenu.styles.buttonsTitle}
                        title={this.getActionButtonTitle({ currentScreen, isCompact, translate })}
                        icon={
                            <FontAwesomeIcon
                                name={this.getActionButtonIcon(currentScreen)}
                                size={20}
                                style={themeMenu.styles.buttonIcon}
                            />
                        }
                        onPress={onActionButtonPress as any}
                    />
                }
            </ButtonMenu>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MainButtonMenuAlt);
