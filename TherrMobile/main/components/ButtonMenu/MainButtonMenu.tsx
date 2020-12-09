import React from 'react';
import { connect } from 'react-redux';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from './index';
import { buttonMenu } from '../../styles/navigation';

class MainButtonMenu extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    navTo = (routeName) => {
        const { location, navigation, updateGpsStatus } = this.props;

        if (routeName === 'Map' && !location.settings.isGpsEnabled) {
            LocationServicesDialogBox.checkLocationServicesIsEnabled({
                message:
                    "<h2 style='color: #0af13e'>Use Location?</h2>This app wants to change your device settings:<br/><br/>" +
                    "Use GPS, Wi-Fi, and cell network for location<br/><br/><a href='https://support.google.com/maps/answer/7326816'>Learn more</a>",
                ok: 'YES',
                cancel: 'NO',
                enableHighAccuracy: true, // true => GPS AND NETWORK PROVIDER, false => GPS OR NETWORK PROVIDER
                showDialog: true, // false => Opens the Location access page directly
                openLocationServices: true, // false => Directly catch method is called if location services are turned off
                preventOutSideTouch: false, // true => To prevent the location services window from closing when it is clicked outside
                preventBackClick: false, // true => To prevent the location services popup from closing when it is clicked back button
                providerListener: false, // true ==> Trigger locationProviderStatusChange listener when the location state changes
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
        const currentScreen = this.getCurrentScreen();

        return (
            <View style={buttonMenu.container}>
                <Button
                    title="Connections"
                    buttonStyle={
                        currentScreen === 'Connections'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Connections'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="users"
                            size={26}
                            style={
                                currentScreen === 'Connections'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('ActiveConnections')}
                />
                <Button
                    title="Moments"
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
                    title="Settings"
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
                    title="Notifications"
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
                            name="bell"
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
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MainButtonMenu);
