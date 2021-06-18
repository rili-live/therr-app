import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Image, Text } from 'react-native-elements';
import Overlay from 'react-native-modal-overlay';
import { CommonActions, StackActions } from '@react-navigation/native';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
// import therrIconConfig from '../assets/therr-font-config.json';
// import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import { INotificationsState } from 'therr-react/types';
import styles from '../styles';
import { headerMenuModal } from '../styles/modal';
import * as therrTheme from '../styles/themes';
import translator from '../services/translator';
import { ILocationState } from '../types/redux/location';
import requestLocationServiceActivation from '../utilities/requestLocationServiceActivation';

const ANIMATION_DURATION = 200;

// const TherrIcon = createIconSetFromIcoMoon(
//     therrIconConfig,
//     'TherrFont',
//     'TherrFont.ttf'
// );

interface IHeaderMenuRightDispatchProps {}

interface IStoreProps extends IHeaderMenuRightDispatchProps {
}

// Regular component props
export interface IHeaderMenuRightProps extends IStoreProps {
    isVisible: boolean;
    isEmailVerifed: boolean;
    location: ILocationState;
    logout: Function;
    navigation: any;
    notifications: INotificationsState;
    styleName: 'light' | 'dark' | 'beemo';
    updateGpsStatus: Function;
    user: any;
}

interface IHeaderMenuRightState {
    isModalVisible: boolean;
}

class HeaderMenuRight extends React.Component<
    IHeaderMenuRightProps,
    IHeaderMenuRightState
> {
    private timeoutId: any;

    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            isModalVisible: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentWillUnmount = () => {
        clearTimeout(this.timeoutId);
    }

    toggleOverlay = (shouldClose?: boolean) => {
        const { isModalVisible } = this.state;

        return new Promise((resolve) => {
            this.setState({
                isModalVisible: shouldClose ? false : !isModalVisible,
            }, () => {
                resolve(null);
            });
        });
    };

    navTo = (routeName) => {
        const { location, navigation, updateGpsStatus } = this.props;
        const currentScreen = this.getCurrentScreen();

        if (routeName === 'Map') {
            requestLocationServiceActivation({
                isGpsEnabled: location.settings.isGpsEnabled,
                translate: this.translate,
            }).then((response: any) => {
                if (response?.status) {
                    return updateGpsStatus(response.status); // wait for redux state to update
                }
                return Promise.resolve();
            }).then(() => {
                return this.toggleOverlay();
            }).then(() => {
                navigation.navigate(routeName);
            }).catch((error) => {
                // TODO: Allow viewing map when gps is disable
                // but disallow GPS required actions like viewing/deleting moments
                console.log(error);
                return this.toggleOverlay();
            });
        } else {
            this.toggleOverlay();

            if (currentScreen === 'Map') {
                navigation.dispatch(
                    StackActions.replace(routeName, {})
                );
                navigation.dispatch(
                    CommonActions.reset({
                        index: 1,
                        routes: [
                            { name: 'Home' },
                            { name: routeName },
                        ],
                    })
                );
                this.toggleOverlay();
                return;
            }

            navigation.navigate(routeName);
        }
    };

    handleLogout = (hideModal?: Function) => {
        const { user, logout, navigation } = this.props;

        if (hideModal) {
            hideModal();
        }

        this.timeoutId = setTimeout(() => { // Wait for overlay animation
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
        const { isVisible, isEmailVerifed, notifications, styleName, user } = this.props;
        const { isModalVisible } = this.state;
        const currentScreen = this.getCurrentScreen();
        const hasNotifications = notifications.messages && notifications.messages.some(m => m.isUnread);
        let imageStyle = headerMenuModal.toggleIcon;

        if (styleName === 'light') {
            imageStyle = headerMenuModal.toggleIcon;
        }
        if (styleName === 'dark') {
            imageStyle = headerMenuModal.toggleIconDark;
        }
        if (styleName === 'beemo') {
            imageStyle = headerMenuModal.toggleIconDark;
        }

        if (isVisible) {
            return (
                <>
                    {
                        isEmailVerifed ?
                            <Button
                                icon={
                                    <Image
                                        source={{ uri: `https://robohash.org/${user.details?.id}?size=50x50` }}
                                        style={imageStyle}
                                        PlaceholderContent={<ActivityIndicator size="small" color={therrTheme.colors.primary} />}
                                    />}
                                onPress={() => this.toggleOverlay()}
                                type="clear"
                                containerStyle={{
                                    height: 40,
                                    margin: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                }}
                            /> :
                            <Button
                                icon={
                                    <FontAwesomeIcon
                                        style={headerMenuModal.logoutIcon}
                                        name="sign-out-alt"
                                        size={22}
                                    />
                                }
                                onPress={() => this.handleLogout()}
                                type="clear"
                                containerStyle={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}
                            />
                    }
                    <Overlay
                        animationType="slideInRight"
                        animationDuration={ANIMATION_DURATION}
                        easing="ease-in-out-sine"
                        visible={isModalVisible}
                        onClose={() => this.toggleOverlay(true)}
                        closeOnTouchOutside
                        containerStyle={styles.overlay}
                        childrenWrapperStyle={headerMenuModal.overlayContainer}
                    >
                        {
                            (hideModal) => (
                                <>
                                    <View style={headerMenuModal.header}>
                                        <View style={headerMenuModal.headerTitle}>
                                            <Image
                                                source={{ uri: `https://robohash.org/${user.details?.id}?size=50x50` }}
                                                style={headerMenuModal.headerTitleIcon}
                                                transition={false}
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
                                                    color={therrTheme.colors.primary3}
                                                />
                                            }
                                            onPress={hideModal}
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
                                        <View style={{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            {
                                                hasNotifications && <View style={headerMenuModal.notificationCircle} />
                                            }
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'Notifications'
                                                        ? headerMenuModal.buttonsActive
                                                        : headerMenuModal.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'Notifications'
                                                        ? headerMenuModal.buttonsTitleActive
                                                        : headerMenuModal.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.notifications')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'Notifications'
                                                                ? headerMenuModal.iconStyleActive
                                                                : headerMenuModal.iconStyle
                                                        }
                                                        name={hasNotifications ? 'bell' : 'bell-slash'}
                                                        size={22}
                                                    />
                                                }
                                                onPress={() => this.navTo('Notifications')}
                                            />
                                        </View>
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
                                                currentScreen === 'Moments'
                                                    ? headerMenuModal.buttonsActive
                                                    : headerMenuModal.buttons
                                            }
                                            titleStyle={
                                                currentScreen === 'Moments'
                                                    ? headerMenuModal.buttonsTitleActive
                                                    : headerMenuModal.buttonsTitle
                                            }
                                            title={this.translate('components.headerMenuRight.menuItems.moments')}
                                            icon={
                                                <MaterialIcon
                                                    style={
                                                        currentScreen === 'Moments'
                                                            ? headerMenuModal.iconStyleActive
                                                            : headerMenuModal.iconStyle
                                                    }
                                                    name="watch"
                                                    size={22}
                                                />
                                            }
                                            onPress={() => this.navTo('Moments')}
                                        />
                                        {/* <Button
                                            buttonStyle={
                                                currentScreen === 'HostedChat'
                                                    ? headerMenuModal.buttonsActive
                                                    : headerMenuModal.buttons
                                            }
                                            titleStyle={
                                                currentScreen === 'HostedChat'
                                                    ? headerMenuModal.buttonsTitleActive
                                                    : headerMenuModal.buttonsTitle
                                            }
                                            title={this.translate('components.headerMenuRight.menuItems.hostedChat')}
                                            icon={
                                                <Icon
                                                    style={
                                                        currentScreen === 'HostedChat'
                                                            ? headerMenuModal.iconStyleActive
                                                            : headerMenuModal.iconStyle
                                                    }
                                                    name="chat"
                                                    size={22}
                                                />
                                            }
                                            onPress={() => this.navTo('HostedChat')}
                                        /> */}
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
                                        <Button
                                            buttonStyle={
                                                currentScreen === 'Settings'
                                                    ? headerMenuModal.buttonsActive
                                                    : headerMenuModal.buttons
                                            }
                                            titleStyle={
                                                currentScreen === 'Settings'
                                                    ? headerMenuModal.buttonsTitleActive
                                                    : headerMenuModal.buttonsTitle
                                            }
                                            title={this.translate('components.headerMenuRight.menuItems.account')}
                                            icon={
                                                <FontAwesomeIcon
                                                    style={
                                                        currentScreen === 'Settings'
                                                            ? headerMenuModal.iconStyleActive
                                                            : headerMenuModal.iconStyle
                                                    }
                                                    name="user-cog"
                                                    size={22}
                                                />
                                            }
                                            onPress={() => this.navTo('Settings')}
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
                                            onPress={() => this.handleLogout(hideModal)}
                                        />
                                    </View>
                                </>
                            )
                        }
                    </Overlay>
                </>
            );
        }

        return null;
    }
}

export default HeaderMenuRight;
