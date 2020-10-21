import React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import ButtonMenu from './index';
import { buttonMenu } from '../../styles/navigation';

class ConnectionsButtonMenu extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    handleButtonPress = (name: string) => {
        console.log(name);
    };

    render() {
        const currentScreen = this.getCurrentScreen();

        return (
            <View style={buttonMenu.container}>
                <Button
                    title="Active"
                    buttonStyle={
                        currentScreen === 'Active'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Active'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon name="users" size={26} color="white" />
                    }
                    onPress={() => this.handleButtonPress('Active')}
                />
                <Button
                    title="Search"
                    buttonStyle={
                        currentScreen === 'Search'
                            ? buttonMenu.buttonsActive
                            : buttonMenu.buttons
                    }
                    containerStyle={buttonMenu.buttonContainer}
                    titleStyle={
                        currentScreen === 'Search'
                            ? buttonMenu.buttonsTitleActive
                            : buttonMenu.buttonsTitle
                    }
                    icon={
                        <FontAwesomeIcon
                            name="search"
                            size={26}
                            color="white"
                        />
                    }
                    onPress={() => this.handleButtonPress('Search')}
                />
            </View>
        );
    }
}

export default ConnectionsButtonMenu;
