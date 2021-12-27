import React from 'react';
import { connect } from 'react-redux';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
// import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
// import therrIconConfig from '../../assets/therr-font-config.json';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from './';
import { buttonMenu } from '../../styles/navigation';
import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';

// const TherrIcon = createIconSetFromIcoMoon(
//     therrIconConfig,
//     'TherrFont',
//     'TherrFont.ttf'
// );

class MainButtonMenu extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    navTo = (routeName) => {
        const { location, navigation, translate, updateGpsStatus } = this.props;

        if (routeName === 'Map') {
            requestLocationServiceActivation({
                isGpsEnabled: location.settings.isGpsEnabled,
                translate,
                shouldIgnoreRequirement: true,
            }).then((response: any) => {
                if (response?.status) {
                    return updateGpsStatus(response.status); // wait for redux state to update
                }

                return Promise.resolve();
            }).then(() => {
                navigation.navigate(routeName);
            }).catch((error) => {
                // TODO: Allow viewing map when gps is disable
                // but disallow GPS required actions like viewing/deleting moments
                console.log(error);
            });
        } else {
            navigation.navigate(routeName);
        }
    };

    render() {
        const { onActionButtonPress, isCompact, notifications, translate } = this.props;
        const currentScreen = this.getCurrentScreen();
        const hasNotifications = notifications?.messages.some(m => m.isUnread);


        return (
            <ButtonMenu {...this.props}>
                <Button
                    title={!isCompact ? translate('menus.main.buttons.connections') : null}
                    buttonStyle={
                        currentScreen === 'Contacts' || currentScreen === 'ActiveConnections'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Contacts' || currentScreen === 'ActiveConnections'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="users"
                            size={26}
                            style={
                                currentScreen === 'Contacts' || currentScreen === 'ActiveConnections'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('ActiveConnections')}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.moments') : null}
                    buttonStyle={
                        currentScreen === 'Areas'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Areas'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <MaterialIcon
                            name="watch"
                            size={26}
                            style={
                                currentScreen === 'Areas'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Areas')}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.map') : null}
                    buttonStyle={
                        currentScreen === 'Map'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Map'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="globe-americas"
                            size={26}
                            style={
                                currentScreen === 'Map'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Map')}
                />
                <View style={buttonMenu.notificationContainer}>
                    <Button
                        title={!isCompact ? translate('menus.main.buttons.notifications') : null}
                        buttonStyle={
                            currentScreen === 'Notifications'
                                ? buttonMenu.buttonsActive
                                : buttonMenu.buttons
                        }
                        containerStyle={buttonMenu.buttonContainer}
                        titleStyle={
                            currentScreen === 'Notifications'
                                ? buttonMenu.buttonsTitleActive
                                : buttonMenu.buttonsTitle
                        }
                        icon={
                            <FontAwesomeIcon
                                name={hasNotifications ? 'bell' : 'bell-slash'}
                                size={26}
                                style={
                                    currentScreen === 'Notifications'
                                        ? buttonMenu.buttonIconActive
                                        : buttonMenu.buttonIcon
                                }
                            />
                        }
                        onPress={() => this.navTo('Notifications')}
                    />
                    {
                        hasNotifications && <View style={onActionButtonPress ? buttonMenu.notificationCircleAlt : buttonMenu.notificationCircle} />
                    }
                </View>
                {
                    onActionButtonPress &&
                    <Button
                        buttonStyle={buttonMenu.buttons}
                        containerStyle={buttonMenu.buttonContainer}
                        titleStyle={buttonMenu.buttonsTitle}
                        icon={
                            <FontAwesomeIcon
                                name={currentScreen === 'Map' ? 'ellipsis-h' : 'arrow-up'}
                                size={26}
                                style={buttonMenu.buttonIcon}
                            />
                        }
                        onPress={onActionButtonPress as any}
                    />
                }
            </ButtonMenu>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MainButtonMenu);
