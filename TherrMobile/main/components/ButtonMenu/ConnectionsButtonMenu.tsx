import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from '../ButtonMenu';
import { buttonMenu } from '../../styles/navigation';

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
        const { translate } = this.props;
        const currentScreen = this.getCurrentScreen();

        return (
            <ButtonMenu {...this.props}>
                <Button
                    title={translate('menus.connections.buttons.activeConnections')}
                    buttonStyle={
                        currentScreen === 'ActiveConnections'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'ActiveConnections'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="users"
                            size={26}
                            style={
                                currentScreen === 'ActiveConnections'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('ActiveConnections')}
                />
                <Button
                    title={translate('menus.connections.buttons.searchContacts')}
                    buttonStyle={
                        currentScreen === 'Contacts'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Contacts'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="search"
                            size={26}
                            style={
                                currentScreen === 'Contacts'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.navTo('Contacts')}
                />
                <Button
                    title={translate('menus.connections.buttons.createConnection')}
                    buttonStyle={
                        currentScreen === 'CreateConnection'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'CreateConnection'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="plus"
                            size={26}
                            style={
                                currentScreen === 'CreateConnection'
                                    ? buttonMenu.buttonIconActive
                                    : buttonMenu.buttonIcon
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
