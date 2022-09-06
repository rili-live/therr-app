import React from 'react';
import { Pressable, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Image, Text } from 'react-native-elements';
import Overlay from 'react-native-modal-overlay';
import { CommonActions, StackActions } from '@react-navigation/native';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
// import therrIconConfig from '../assets/therr-font-config.json';
// import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import { INotificationsState } from 'therr-react/types';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import translator from '../services/translator';
import { ILocationState } from '../types/redux/location';
import requestLocationServiceActivation from '../utilities/requestLocationServiceActivation';
import { ITherrThemeColors } from '../styles/themes';
import { getUserImageUri } from '../utilities/content';
import UsersActions from '../redux/actions/UsersActions';
import InfoModal from './Modals/InfoModal';
import therrIconConfig from '../assets/therr-font-config.json';

const LogoIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

const ANIMATION_DURATION = 180;

// const TherrIcon = createIconSetFromIcoMoon(
//     therrIconConfig,
//     'TherrFont',
//     'TherrFont.ttf'
// );

interface IHeaderMenuRightDispatchProps {
    updateTour: Function;
}

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
    styleName: 'light' | 'dark' | 'accent';
    updateGpsStatus: Function;
    user: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        styles: any;
    };
    themeModal: {
        styles: any;
    };
    themeMenu: {
        styles: any;
    };
}

interface IHeaderMenuRightState {
    isModalVisible: boolean;
    isPointsInfoModalVisible: boolean;
}

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            updateTour: UsersActions.updateTour,
        },
        dispatch
    );

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
            isPointsInfoModalVisible: false,
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
                shouldIgnoreRequirement: true,
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

    startTour = () => {
        const { navigation, user, updateTour } = this.props;
        this.toggleOverlay();

        updateTour(user.details.id, {
            isTouring: true,
        });

        if (this.getCurrentScreen() !== 'Map') {
            navigation.navigate('Map');
        }
    }

    getCurrentScreen = () => {
        const navState = this.props.navigation.getState();

        return (
            navState.routes[navState.routes.length - 1] &&
            navState.routes[navState.routes.length - 1].name
        );
    };

    togglePointsInfoModal = () => {
        const { isPointsInfoModalVisible } = this.state;

        this.setState({
            isPointsInfoModalVisible: !isPointsInfoModalVisible,
        });
    }

    viewUser = () => {
        const { navigation, user } = this.props;

        this.toggleOverlay();
        navigation.navigate('ViewUser', {
            userInView: {
                id: user.details.id,
            },
        });
    }

    render() {
        const {
            isVisible,
            isEmailVerifed,
            notifications,
            // styleName,
            theme,
            themeButtons,
            themeModal,
            themeMenu,
            user,
        } = this.props;

        const { isModalVisible, isPointsInfoModalVisible } = this.state;
        const currentScreen = this.getCurrentScreen();
        const hasNotifications = notifications.messages && notifications.messages.some(m => m.isUnread);
        // let imageStyle = themeMenu.styles.toggleIcon;

        // if (styleName === 'light') {
        //     imageStyle = themeMenu.styles.toggleIcon;
        // }
        // if (styleName === 'dark') {
        //     imageStyle = themeMenu.styles.toggleIconDark;
        // }
        // if (styleName === 'accent') {
        //     imageStyle = themeMenu.styles.toggleIconDark;
        // }
        if (isVisible) {
            return (
                <>
                    {
                        isEmailVerifed ?
                            <View>
                                {/* <Button
                                    icon={
                                        <Image
                                            source={{ uri: getUserImageUri(user, 50) }}
                                            style={imageStyle}
                                            PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.primary} />}
                                        />}
                                    onPress={() => this.toggleOverlay()}
                                    type="clear"
                                    containerStyle={themeMenu.styles.userProfileButtonContainerVerified}
                                /> */}
                                <Button
                                    icon={
                                        <Icon
                                            name="menu"
                                            size={30}
                                            color={theme.colors.primary3}
                                        />}
                                    onPress={() => this.toggleOverlay()}
                                    type="clear"
                                    containerStyle={themeMenu.styles.userProfileButtonContainerVerified}
                                />
                                {
                                    hasNotifications && <View style={themeMenu.styles.notificationCircle2} />
                                }
                            </View>
                            :
                            <Button
                                icon={
                                    <FontAwesomeIcon
                                        style={themeMenu.styles.logoutIcon}
                                        name="sign-out-alt"
                                        size={18}
                                    />
                                }
                                onPress={() => this.handleLogout()}
                                type="clear"
                                containerStyle={themeMenu.styles.userProfileButtonContainer}
                            />
                    }
                    <Overlay
                        animationType="slideInRight"
                        animationDuration={ANIMATION_DURATION}
                        easing="ease-in-out-sine"
                        visible={isModalVisible}
                        onClose={() => this.toggleOverlay(true)}
                        closeOnTouchOutside
                        containerStyle={theme.styles.overlay}
                        childrenWrapperStyle={themeMenu.styles.overlayContainer}
                    >
                        {
                            (hideModal) => (
                                <>
                                    <View style={themeMenu.styles.container}>
                                        <View style={themeMenu.styles.header}>
                                            <View style={themeMenu.styles.headerTitle}>
                                                <Pressable
                                                    onPress={this.viewUser}
                                                >
                                                    <Image
                                                        source={{ uri: getUserImageUri(user, 50) }}
                                                        style={themeMenu.styles.headerTitleIcon}
                                                        transition={false}
                                                    />
                                                    {
                                                        hasNotifications && <View style={themeMenu.styles.notificationCircle3} />
                                                    }
                                                </Pressable>
                                                <Text numberOfLines={1} style={themeMenu.styles.headerTitleText}>
                                                    {user.details?.userName}
                                                </Text>
                                            </View>
                                            <Button
                                                icon={
                                                    <Icon
                                                        name="close"
                                                        size={30}
                                                        color={theme.colors.primary3}
                                                    />
                                                }
                                                iconRight
                                                onPress={hideModal}
                                                type="clear"
                                            />
                                        </View>
                                        <View style={themeMenu.styles.subheader}>
                                            <View style={themeMenu.styles.subheaderTitle}>
                                                <Button
                                                    type="clear"
                                                    icon={
                                                        <LogoIcon
                                                            name="therr-logo"
                                                            size={24}
                                                            style={themeMenu.styles.subheaderTitleIcon}
                                                        />
                                                    }
                                                />
                                                <Text numberOfLines={1} style={themeMenu.styles.subheaderTitleText}>
                                                    {`${(user.details?.settingsTherrCoinTotal || 0)} pts`}
                                                </Text>
                                            </View>
                                            <Button
                                                icon={
                                                    <Icon
                                                        name="info"
                                                        size={24}
                                                        color={theme.colors.brandingWhite}
                                                    />
                                                }
                                                iconRight
                                                onPress={this.togglePointsInfoModal}
                                                type="clear"
                                            />
                                        </View>
                                        <View style={themeMenu.styles.body}>
                                            {/* <Button
                                                buttonStyle={
                                                    currentScreen === 'Map'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'Map'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.map')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'Map'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="globe-americas"
                                                        size={18}
                                                    />
                                                }
                                                onPress={() => this.navTo('Map')}
                                            />
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'Areas'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'Areas'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.moments')}
                                                icon={
                                                    <MaterialIcon
                                                        style={
                                                            currentScreen === 'Areas'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="watch"
                                                        size={18}
                                                    />
                                                }
                                                onPress={() => this.navTo('Areas')}
                                            /> */}
                                            <View style={themeMenu.styles.notificationsItemContainer}>
                                                <Button
                                                    buttonStyle={
                                                        currentScreen === 'Notifications'
                                                            ? themeMenu.styles.buttonsActive
                                                            : themeMenu.styles.buttons
                                                    }
                                                    containerStyle={{ width: '100%' }}
                                                    titleStyle={
                                                        currentScreen === 'Notifications'
                                                            ? themeMenu.styles.buttonsTitleActive
                                                            : themeMenu.styles.buttonsTitle
                                                    }
                                                    title={this.translate('components.headerMenuRight.menuItems.notifications')}
                                                    icon={
                                                        <FontAwesomeIcon
                                                            style={
                                                                currentScreen === 'Notifications'
                                                                    ? themeMenu.styles.iconStyleActive
                                                                    : themeMenu.styles.iconStyle
                                                            }
                                                            name={hasNotifications ? 'bell' : 'bell-slash'}
                                                            size={18}
                                                        />
                                                    }
                                                    iconRight
                                                    onPress={() => this.navTo('Notifications')}
                                                />
                                                {
                                                    hasNotifications && <View style={themeMenu.styles.notificationCircle} />
                                                }
                                            </View>
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'Achievements'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                containerStyle={{ width: '100%' }}
                                                titleStyle={
                                                    currentScreen === 'Achievements'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.achievements')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'Achievements'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name={'trophy'}
                                                        size={18}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('Achievements')}
                                            />
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'MyDrafts'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                containerStyle={{ width: '100%' }}
                                                titleStyle={
                                                    currentScreen === 'MyDrafts'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.myDrafts')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'MyDrafts'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name={'pencil-alt'}
                                                        size={18}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('MyDrafts')}
                                            />
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'BookMarked'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                containerStyle={{ width: '100%' }}
                                                titleStyle={
                                                    currentScreen === 'BookMarked'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.bookmarks')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'BookMarked'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name={'bookmark'}
                                                        size={18}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('BookMarked')}
                                            />
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'ActiveConnections'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'ActiveConnections'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.chat')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'ActiveConnections'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="comments"
                                                        size={18}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('ActiveConnections')}
                                            />
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'CreateConnection'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'CreateConnection'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.addConnection')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'CreateConnection'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="user-plus"
                                                        size={18}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('CreateConnection')}
                                            />
                                            {/* <Button
                                                buttonStyle={
                                                    currentScreen === 'HostedChat'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'HostedChat'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.hostedChat')}
                                                icon={
                                                    <Icon
                                                        style={
                                                            currentScreen === 'HostedChat'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="chat"
                                                        size={18}
                                                    />
                                                }
                                                onPress={() => this.navTo('HostedChat')}
                                            /> */}
                                            {/* <Button
                                                buttonStyle={
                                                    currentScreen === 'ActiveConnections'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'ActiveConnections'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.connections')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'ActiveConnections'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="users"
                                                        size={18}
                                                    />
                                                }
                                                onPress={() => this.navTo('ActiveConnections')}
                                            /> */}
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'Settings'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'Settings'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.account')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'Settings'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="user-cog"
                                                        size={18}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('Settings')}
                                            />
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'Home'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'Home'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.feedback')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={
                                                            currentScreen === 'Home'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="question-circle"
                                                        size={18}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('Home')}
                                            />
                                        </View>
                                        <View style={themeMenu.styles.footer}>
                                            <Button
                                                titleStyle={themeMenu.styles.buttonsTitle}
                                                buttonStyle={[themeMenu.styles.buttons, , { justifyContent: 'center', marginBottom: 10 }]}
                                                title={this.translate('components.headerMenuRight.menuItems.tour')}
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={themeMenu.styles.iconStyle}
                                                        name="info"
                                                        size={18}
                                                    />
                                                }
                                                onPress={this.startTour}
                                            />
                                            <Button
                                                titleStyle={themeMenu.styles.buttonsTitle}
                                                buttonStyle={[themeMenu.styles.buttons, { justifyContent: 'center' }]}
                                                title={this.translate('components.headerMenuRight.menuItems.logout')}
                                                iconRight
                                                icon={
                                                    <FontAwesomeIcon
                                                        style={themeMenu.styles.iconStyle}
                                                        name="sign-out-alt"
                                                        size={18}
                                                    />
                                                }
                                                onPress={() => this.handleLogout(hideModal)}
                                            />
                                        </View>
                                    </View>
                                    <InfoModal
                                        isVisible={isPointsInfoModalVisible}
                                        translate={this.translate}
                                        onRequestClose={this.togglePointsInfoModal}
                                        themeButtons={themeButtons}
                                        themeModal={themeModal}
                                    />
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

export default connect(mapStateToProps, mapDispatchToProps)(HeaderMenuRight);
