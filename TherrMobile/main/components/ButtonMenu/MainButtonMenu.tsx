import React from 'react';
import { connect } from 'react-redux';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from '../ButtonMenu';
import { buttonMenu } from '../../styles/navigation';
import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';

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
