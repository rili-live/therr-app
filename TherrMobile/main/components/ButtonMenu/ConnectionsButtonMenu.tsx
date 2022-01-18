import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from '../ButtonMenu';

class ConnectionsButtonMenu extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    handleButtonPress = (name: string) => {
        const { onButtonPress } = this.props;

        onButtonPress && onButtonPress(name);
    };

    render() {
        const { translate, themeMenu } = this.props;
        const currentScreen = this.getCurrentScreen();

        return (
            <ButtonMenu {...this.props}>
                <Button
                    title={translate('menus.connections.buttons.activeConnections')}
                    buttonStyle={
                        currentScreen === 'ActiveConnections'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={
                        currentScreen === 'ActiveConnections'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="users"
                            size={26}
                            style={
                                currentScreen === 'ActiveConnections'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('ActiveConnections')}
                />
                <Button
                    title={translate('menus.connections.buttons.searchContacts')}
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
                            name="search"
                            size={26}
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
                    title={translate('menus.connections.buttons.createConnection')}
                    buttonStyle={
                        currentScreen === 'CreateConnection'
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={
                        currentScreen === 'CreateConnection'
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="plus"
                            size={26}
                            style={
                                currentScreen === 'CreateConnection'
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('CreateConnection')}
                />
            </ButtonMenu>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ConnectionsButtonMenu);
