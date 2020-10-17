import React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { buttonMenu } from '../styles/navigation';

interface IButtonMenuDispatchProps {}

interface IStoreProps extends IButtonMenuDispatchProps {}

// Regular component props
export interface IButtonMenuProps extends IStoreProps {
    navigation: any;
    user: any;
}

interface IButtonMenuState {}

class ButtonMenu extends React.Component<IButtonMenuProps, IButtonMenuState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    navTo = (routeName) => {
        const { navigation } = this.props;

        navigation.navigate(routeName);
    };

    getCurrentScreen = () => {
        const navState = this.props.navigation.dangerouslyGetState();

        return (
            navState.routes[navState.routes.length - 1] &&
            navState.routes[navState.routes.length - 1].name
        );
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
                    icon={<FontAwesomeIcon name="users" size={26} color="white" />}
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
                    icon={<FontAwesomeIcon name="globe-americas" size={26} color="white" />}
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
                    icon={<FontAwesomeIcon name="user-cog" size={26} color="white" />}
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

export default ButtonMenu;
