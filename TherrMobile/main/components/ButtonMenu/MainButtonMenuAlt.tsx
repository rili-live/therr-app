import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from './';
import { buttonMenu } from '../../styles/navigation';
// import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';

class MainButtonMenuAlt extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    navTo = (routeName) => {
        // const { location, navigation, translate, updateGpsStatus } = this.props;
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

        if (currentScreen === 'Areas' || currentScreen === 'Notifications') {
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

        if (currentScreen === 'Areas' || currentScreen === 'Notifications') {
            return translate('menus.main.buttons.goToTop');
        }

        return translate('menus.main.buttons.refresh');
    }

    render() {
        const { onActionButtonPress, isCompact, translate } = this.props;
        const currentScreen = this.getCurrentScreen();
        const isMessageViewActive = currentScreen === 'Contacts' || currentScreen === 'ActiveConnections' || currentScreen === 'CreateConnection';

        return (
            <ButtonMenu {...this.props}>
                <Button
                    title={!isCompact ? translate('menus.main.buttons.list') : null}
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
                        <FontAwesomeIcon
                            name="list"
                            size={20}
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
                            size={20}
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
                            name="bookmark"
                            size={20}
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
                        isMessageViewActive
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        isMessageViewActive
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="comment"
                            size={20}
                            style={
                                isMessageViewActive
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('ActiveConnections')}
                />
                {/* <Button
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
                            size={20}
                            style={
                                currentScreen === 'Settings'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Settings')}
                /> */}
                {
                    onActionButtonPress &&
                    <Button
                        buttonStyle={buttonMenu.buttons}
                        containerStyle={buttonMenu.buttonContainer}
                        titleStyle={buttonMenu.buttonsTitle}
                        title={this.getActionButtonTitle({ currentScreen, isCompact, translate })}
                        icon={
                            <FontAwesomeIcon
                                name={this.getActionButtonIcon(currentScreen)}
                                size={20}
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

export default connect(mapStateToProps, mapDispatchToProps)(MainButtonMenuAlt);
