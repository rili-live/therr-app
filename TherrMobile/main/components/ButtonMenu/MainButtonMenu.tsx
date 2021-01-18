import React from 'react';
import { connect } from 'react-redux';
import { Platform, View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from '../ButtonMenu';
import { buttonMenu } from '../../styles/navigation';

class MainButtonMenu extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    navTo = (routeName) => {
        const { location, navigation, translate, updateGpsStatus } = this.props;

        if (Platform.OS !== 'ios' && routeName === 'Map' && !location.settings.isGpsEnabled) {
            const permissionHeader = translate('permissions.locationGps.header');
            const permissionDescription1 = translate('permissions.locationGps.description1');
            const permissionDescription2 = translate('permissions.locationGps.description2');
            const permissionLink = translate('permissions.locationGps.link');
            const permissionYes = translate('permissions.locationGps.yes');
            const permissionNo = translate('permissions.locationGps.no');
            LocationServicesDialogBox.checkLocationServicesIsEnabled({
                message:
                    `<h2 style='color: #0af13e'>${permissionHeader}</h2>${permissionDescription1}<br/><br/>` +
                    `${permissionDescription2}<br/><br/><a href='https://support.google.com/maps/answer/7326816'>${permissionLink}</a>`,
                ok: permissionYes,
                cancel: permissionNo,
                enableHighAccuracy: true, // true => GPS AND NETWORK PROVIDER, false => GPS OR NETWORK PROVIDER
                showDialog: true, // false => Opens the Location access page directly
                openLocationServices: true, // false => Directly catch method is called if location services are turned off
                preventOutSideTouch: false, // true => To prevent the location services window from closing when it is clicked outside
                preventBackClick: false, // true => To prevent the location services popup from closing when it is clicked back button
                providerListener: true, // true ==> Trigger locationProviderStatusChange listener when the location state changes
            })
                .then((success) => {
                    updateGpsStatus(success.status);
                    navigation.navigate(routeName);
                })
                .catch((error) => {
                    console.log(error);
                });
        } else {
            navigation.navigate(routeName);
        }
    };

    render() {
        const { notifications, translate } = this.props;
        const currentScreen = this.getCurrentScreen();
        const hasNotifications = notifications.messages && notifications.messages.some(m => m.isUnread);

        return (
            <View style={buttonMenu.container}>
                <Button
                    title={translate('menus.main.buttons.connections')}
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
                    title={translate('menus.main.buttons.moments')}
                    buttonStyle={
                        currentScreen === 'Moments'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Moments'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="globe-americas"
                            size={26}
                            style={
                                currentScreen === 'Moments'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Map')}
                />
                <Button
                    title={translate('menus.main.buttons.settings')}
                    buttonStyle={
                        currentScreen === 'Settings'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Settings'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="user-cog"
                            size={26}
                            style={
                                currentScreen === 'Settings'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Settings')}
                />
                <Button
                    title={translate('menus.main.buttons.notifications')}
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
                    hasNotifications && <View style={buttonMenu.notificationCircle} />
                }
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MainButtonMenu);
