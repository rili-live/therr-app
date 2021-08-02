import React from 'react';
import { connect } from 'react-redux';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from '.';
import * as therrTheme from '../../styles/themes';
import { buttonMenu } from '../../styles/navigation';
import { buttonMenuHeight, buttonMenuHeightCompact } from '../../styles/navigation/buttonMenu';
import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';

class MainButtonMenuAlt extends ButtonMenu {
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
        const { transparent, onActionButtonPress, isAbsolute, isCompact, translate } = this.props;
        const currentScreen = this.getCurrentScreen();
        const overrideStyles: any = transparent ? { backgroundColor: therrTheme.colorVariations.primaryFade } : { backgroundColor: therrTheme.colors.primary };
        if (!isAbsolute) {
            overrideStyles.position = 'relative';
        }
        const containerHeight = isCompact ? buttonMenuHeightCompact : buttonMenuHeight;

        return (
            <View style={[buttonMenu.container, overrideStyles, { height: containerHeight }]}>
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
                <Button
                    title={!isCompact ? translate('menus.main.buttons.bookmarked') : null}
                    buttonStyle={
                        currentScreen === 'BookMarked'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'BookMarked'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="star"
                            size={26}
                            style={
                                currentScreen === 'BookMarked'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('BookMarked')}
                />
                <Button
                    title={!isCompact ? translate('menus.main.buttons.messages') : null}
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
                    title={!isCompact ? translate('menus.main.buttons.account') : null}
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
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MainButtonMenuAlt);
