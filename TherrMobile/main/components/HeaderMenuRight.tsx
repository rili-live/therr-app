import React from 'react';
import { View } from 'react-native';
import { Button, Overlay, Text } from 'react-native-elements';
import { CommonActions } from '@react-navigation/native';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { headerMenuModal } from '../styles/modal';

interface IHeaderMenuRightDispatchProps {}

interface IStoreProps extends IHeaderMenuRightDispatchProps {}

// Regular component props
export interface IHeaderMenuRightProps extends IStoreProps {
    logout: Function;
    navigation: any;
    isVisible: boolean;
    user: any;
}

interface IHeaderMenuRightState {
    isModalVisible: boolean;
}

class HeaderMenuRight extends React.Component<
    IHeaderMenuRightProps,
    IHeaderMenuRightState
> {
    constructor(props) {
        super(props);

        this.state = {
            isModalVisible: false,
        };
    }

    toggleOverlay = () => {
        const { isModalVisible } = this.state;

        this.setState({
            isModalVisible: !isModalVisible,
        });
    };

    navTo = (routeName) => {
        const { navigation } = this.props;

        this.toggleOverlay();
        navigation.navigate(routeName);
    };

    handleLogout = () => {
        const { user, logout, navigation } = this.props;

        logout(user.details)
            .then(() => {
                navigation.dispatch(
                    CommonActions.reset({
                        index: 1,
                        routes: [
                            {
                                name: 'Login',
                            },
                        ],
                    })
                );
            })
            .catch((e) => {
                console.log(e);
            });
    };

    getCurrentScreen = () => {
        const navState = this.props.navigation.dangerouslyGetState();

        return (
            navState.routes[navState.routes.length - 1] &&
            navState.routes[navState.routes.length - 1].name
        );
    };

    render() {
        const { isVisible } = this.props;
        const { isModalVisible } = this.state;
        const currentScreen = this.getCurrentScreen();

        if (isVisible) {
            return (
                <>
                    <Button
                        icon={<Icon name="menu" size={30} color="white" />}
                        onPress={this.toggleOverlay}
                        type="clear"
                    />
                    <Overlay
                        isVisible={isModalVisible}
                        onBackdropPress={this.toggleOverlay}
                        overlayStyle={headerMenuModal.container}
                    >
                        <>
                            <View style={headerMenuModal.header}>
                                <Text style={headerMenuModal.headerTitle} />
                                <Button
                                    icon={
                                        <Icon
                                            name="close"
                                            size={30}
                                            color="#388254"
                                        />
                                    }
                                    onPress={this.toggleOverlay}
                                    type="clear"
                                />
                            </View>
                            <View style={headerMenuModal.body}>
                                <Button
                                    buttonStyle={
                                        currentScreen === 'Home'
                                            ? headerMenuModal.buttonsActive
                                            : headerMenuModal.buttons
                                    }
                                    titleStyle={
                                        currentScreen === 'Home'
                                            ? headerMenuModal.buttonsTitleActive
                                            : headerMenuModal.buttonsTitle
                                    }
                                    title="HOME"
                                    icon={
                                        <FontAwesomeIcon
                                            style={headerMenuModal.iconStyle}
                                            name="home"
                                            size={22}
                                            color="#388254"
                                        />
                                    }
                                    onPress={() => this.navTo('Home')}
                                />
                                <Button
                                    buttonStyle={
                                        currentScreen === 'Map'
                                            ? headerMenuModal.buttonsActive
                                            : headerMenuModal.buttons
                                    }
                                    titleStyle={
                                        currentScreen === 'Map'
                                            ? headerMenuModal.buttonsTitleActive
                                            : headerMenuModal.buttonsTitle
                                    }
                                    title="MAP"
                                    icon={
                                        <FontAwesomeIcon
                                            style={headerMenuModal.iconStyle}
                                            name="globe-americas"
                                            size={22}
                                            color="#388254"
                                        />
                                    }
                                    onPress={() => this.navTo('Map')}
                                />
                                <Button
                                    buttonStyle={
                                        currentScreen === 'Connections'
                                            ? headerMenuModal.buttonsActive
                                            : headerMenuModal.buttons
                                    }
                                    titleStyle={
                                        currentScreen === 'Connections'
                                            ? headerMenuModal.buttonsTitleActive
                                            : headerMenuModal.buttonsTitle
                                    }
                                    title="CONNECTIONS"
                                    icon={
                                        <FontAwesomeIcon
                                            style={headerMenuModal.iconStyle}
                                            name="users"
                                            size={22}
                                            color="#388254"
                                        />
                                    }
                                    onPress={() => this.navTo('Connections')}
                                />
                            </View>
                            <View style={headerMenuModal.footer}>
                                <Button
                                    titleStyle={headerMenuModal.buttonsTitle}
                                    buttonStyle={headerMenuModal.buttons}
                                    title="LOGOUT"
                                    iconRight
                                    icon={
                                        <FontAwesomeIcon
                                            name="sign-out-alt"
                                            size={22}
                                            color="#388254"
                                        />
                                    }
                                    onPress={this.handleLogout}
                                />
                            </View>
                        </>
                    </Overlay>
                </>
            );
        }

        return null;
    }
}

export default HeaderMenuRight;
