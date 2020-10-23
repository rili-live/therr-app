import React from 'react';
import { View } from 'react-native';
import 'react-native-gesture-handler';
import { buttonMenu } from '../../styles/navigation';

interface IButtonMenuDispatchProps {}

interface IStoreProps extends IButtonMenuDispatchProps {}

// Regular component props
export interface IButtonMenuProps extends IStoreProps {
    navigation: any;
    onButtonPress?: Function;
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
        return <View style={buttonMenu.container}>{this.props.children}</View>;
    }
}

export default ButtonMenu;
