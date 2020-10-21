import React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import ButtonMenu from './index';
import { buttonMenu } from '../../styles/navigation';

class MainButtonMenu extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

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
                        <FontAwesomeIcon name="users" size={26} color="white" />
                    }
                    onPress={() => this.navTo('Connections')}
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
                            color="white"
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
                            color="white"
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
                        <FontAwesomeIcon name="bell" size={26} color="white" />
                    }
                    onPress={() => this.navTo('Notifications')}
                />
            </View>
        );
    }
}

export default MainButtonMenu;
