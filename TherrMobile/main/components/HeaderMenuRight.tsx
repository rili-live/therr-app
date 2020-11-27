import React from 'react';
import { View } from 'react-native';
import { Button, Overlay, Text } from 'react-native-elements';
import { CommonActions } from '@react-navigation/native';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { headerMenuModal } from '../styles/modal';
import translator from '../services/translator';

interface IHeaderMenuRightDispatchProps {}

interface IStoreProps extends IHeaderMenuRightDispatchProps {}

// Regular component props
export interface IHeaderMenuRightProps extends IStoreProps {
    logout: Function;
    navigation: any;
    isVisible: boolean;
    isHeaderTransparent: boolean;
    user: any;
}

interface IHeaderMenuRightState {
    isModalVisible: boolean;
}

class HeaderMenuRight extends React.Component<
    IHeaderMenuRightProps,
    IHeaderMenuRightState
> {
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            isModalVisible: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
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
        const { isHeaderTransparent, isVisible, user } = this.props;
        const { isModalVisible } = this.state;
        const currentScreen = this.getCurrentScreen();
        console.log(currentScreen);

        if (isVisible) {
            return (
                <>
                    <Button
                        icon={<Icon name="menu" size={30} style={isHeaderTransparent ? headerMenuModal.toggleIconDark : headerMenuModal.toggleIcon} />}
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
                                <View style={headerMenuModal.headerTitle}>
                                    <FontAwesomeIcon
                                        style={headerMenuModal.headerTitleIcon}
                                        name="user-circle"
                                        size={25}
                                    />
                                    <Text style={headerMenuModal.headerTitleText}>
                                        {user.details?.userName}
                                    </Text>
                                </View>
                                <Button
                                    icon={
                                        <Icon
                                            name="close"
                                            size={30}
                                            color="black"
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
                                    title={this.translate('components.headerMenuRight.menuItems.home')}
                                    icon={
                                        <FontAwesomeIcon
                                            style={
                                                currentScreen === 'Home'
                                                    ? headerMenuModal.iconStyleActive
                                                    : headerMenuModal.iconStyle
                                            }
                                            name="home"
                                            size={22}
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
                                    title={this.translate('components.headerMenuRight.menuItems.map')}
                                    icon={
                                        <FontAwesomeIcon
                                            style={
                                                currentScreen === 'Map'
                                                    ? headerMenuModal.iconStyleActive
                                                    : headerMenuModal.iconStyle
                                            }
                                            name="globe-americas"
                                            size={22}
                                        />
                                    }
                                    onPress={() => this.navTo('Map')}
                                />
                                <Button
                                    buttonStyle={
                                        currentScreen === 'ActiveConnections'
                                            ? headerMenuModal.buttonsActive
                                            : headerMenuModal.buttons
                                    }
                                    titleStyle={
                                        currentScreen === 'ActiveConnections'
                                            ? headerMenuModal.buttonsTitleActive
                                            : headerMenuModal.buttonsTitle
                                    }
                                    title={this.translate('components.headerMenuRight.menuItems.connections')}
                                    icon={
                                        <FontAwesomeIcon
                                            style={
                                                currentScreen === 'ActiveConnections'
                                                    ? headerMenuModal.iconStyleActive
                                                    : headerMenuModal.iconStyle
                                            }
                                            name="users"
                                            size={22}
                                        />
                                    }
                                    onPress={() => this.navTo('ActiveConnections')}
                                />
                            </View>
                            <View style={headerMenuModal.footer}>
                                <Button
                                    titleStyle={headerMenuModal.buttonsTitle}
                                    buttonStyle={headerMenuModal.buttons}
                                    title={this.translate('components.headerMenuRight.menuItems.logout')}
                                    iconRight
                                    icon={
                                        <FontAwesomeIcon
                                            style={headerMenuModal.iconStyle}
                                            name="sign-out-alt"
                                            size={22}
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
