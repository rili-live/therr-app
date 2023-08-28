import React from 'react';
import { Pressable, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Image, Text } from 'react-native-elements';
import Overlay from 'react-native-modal-overlay';
import { CommonActions } from '@react-navigation/native';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
// import therrIconConfig from '../assets/therr-font-config.json';
// import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import { INotificationsState } from 'therr-react/types';
import translator from '../services/translator';
import { ILocationState } from '../types/redux/location';
import requestLocationServiceActivation from '../utilities/requestLocationServiceActivation';
import { ITherrThemeColors } from '../styles/themes';
import spacingStyles from '../styles/layouts/spacing';
import { getUserImageUri } from '../utilities/content';
import UsersActions from '../redux/actions/UsersActions';
import InfoModal from './Modals/InfoModal';
import TherrIcon from './TherrIcon';

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

class HeaderMenuRight extends React.PureComponent<
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
    };

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

    navTo = (routeName, params = {}) => {
        const { location, navigation, updateGpsStatus } = this.props;

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
                navigation.navigate(routeName, params);
            }).catch((error) => {
                // TODO: Allow viewing map when gps is disable
                // but disallow GPS required actions like viewing/deleting moments
                console.log(error);
                return this.toggleOverlay();
            });
        } else {
            this.toggleOverlay();

            navigation.navigate(routeName, params);
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
    };

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
    };

    viewUser = () => {
        const { navigation, user } = this.props;

        this.toggleOverlay();
        navigation.navigate('ViewUser', {
            userInView: {
                id: user.details.id,
            },
        });
    };

    sanitizeCoinTotal = (total: number) => {
        const rounded = Math.round((Number(total || 0) + Number.EPSILON) * 100) / 100;
        return rounded;
    };

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
        const unreadCount: number = notifications?.messages?.filter(m => m.isUnread)?.length || 0;
        const hasNotifications = unreadCount > 0;
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
                                        <TherrIcon
                                            name="menu"
                                            size={30}
                                            color={theme.colors.primary3}
                                        />}
                                    onPress={() => this.toggleOverlay()}
                                    type="clear"
                                    containerStyle={themeMenu.styles.userProfileButtonContainerVerified}
                                />
                                {
                                    hasNotifications && <Pressable onPress={() => this.toggleOverlay()} style={themeMenu.styles.notificationCircle2}>
                                        <Text style={themeMenu.styles.notificationsCountText}>{unreadCount.toString()}</Text>
                                    </Pressable>
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
                                                        height={themeMenu.styles.headerTitleIcon.height}
                                                        width={themeMenu.styles.headerTitleIcon.width}
                                                        transition={false}
                                                    />
                                                    {
                                                        hasNotifications && <View style={themeMenu.styles.notificationCircle3} />
                                                    }
                                                </Pressable>
                                                <Text numberOfLines={1} style={themeMenu.styles.headerTitleText}>
                                                    {user.details?.userName || ''}
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
                                                        <TherrIcon
                                                            name="therr-logo"
                                                            size={24}
                                                            style={themeMenu.styles.subheaderTitleIcon}
                                                        />
                                                    }
                                                />
                                                <Text numberOfLines={1} style={themeMenu.styles.subheaderTitleText}>
                                                    {`${this.sanitizeCoinTotal(user.settings?.settingsTherrCoinTotal)} coins`}
                                                </Text>
                                            </View>
                                            <Pressable onPress={() => this.navTo('ExchangePointsDisclaimer')}>
                                                <Text style={themeMenu.styles.subheaderLinkText}>
                                                    {this.translate('components.headerMenuRight.buttons.exchange')}
                                                </Text>
                                            </Pressable>
                                            <Button
                                                icon={
                                                    <TherrIcon
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
                                                    containerStyle={spacingStyles.fullWidth}
                                                    titleStyle={
                                                        currentScreen === 'Notifications'
                                                            ? themeMenu.styles.buttonsTitleActive
                                                            : themeMenu.styles.buttonsTitle
                                                    }
                                                    title={this.translate('components.headerMenuRight.menuItems.notifications')}
                                                    icon={
                                                        <TherrIcon
                                                            style={
                                                                currentScreen === 'Notifications'
                                                                    ? themeMenu.styles.iconStyleActive
                                                                    : themeMenu.styles.iconStyle
                                                            }
                                                            name={hasNotifications ? 'bell' : 'bell'}
                                                            size={24}
                                                        />
                                                    }
                                                    iconRight
                                                    onPress={() => this.navTo('Notifications')}
                                                />
                                                {
                                                    hasNotifications && <View style={themeMenu.styles.notificationCircle2}>
                                                        <Text style={{ color: 'white' }}>{unreadCount.toString()}</Text>
                                                    </View>
                                                }
                                            </View>
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'Achievements'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                containerStyle={spacingStyles.fullWidth}
                                                titleStyle={
                                                    currentScreen === 'Achievements'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.achievements')}
                                                icon={
                                                    <TherrIcon
                                                        style={
                                                            currentScreen === 'Achievements'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name={'achievement'}
                                                        size={24}
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
                                                containerStyle={spacingStyles.fullWidth}
                                                titleStyle={
                                                    currentScreen === 'MyDrafts'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.myDrafts')}
                                                icon={
                                                    <TherrIcon
                                                        style={
                                                            currentScreen === 'MyDrafts'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name={'edit'}
                                                        size={24}
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
                                                containerStyle={spacingStyles.fullWidth}
                                                titleStyle={
                                                    currentScreen === 'BookMarked'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.bookmarks')}
                                                icon={
                                                    <TherrIcon
                                                        style={
                                                            currentScreen === 'BookMarked'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name={'bookmark'}
                                                        size={24}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('BookMarked')}
                                            />
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'Contacts'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'Contacts'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.chat')}
                                                icon={
                                                    <TherrIcon
                                                        style={
                                                            currentScreen === 'Contacts'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="chat-smile"
                                                        size={24}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('Contacts')}
                                            />
                                            <Button
                                                buttonStyle={
                                                    currentScreen === 'Contacts'
                                                        ? themeMenu.styles.buttonsActive
                                                        : themeMenu.styles.buttons
                                                }
                                                titleStyle={
                                                    currentScreen === 'Contacts'
                                                        ? themeMenu.styles.buttonsTitleActive
                                                        : themeMenu.styles.buttonsTitle
                                                }
                                                title={this.translate('components.headerMenuRight.menuItems.addConnection')}
                                                icon={
                                                    <TherrIcon
                                                        style={
                                                            currentScreen === 'Contacts'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="key-plus"
                                                        size={24}
                                                    />
                                                }
                                                iconRight
                                                onPress={() => this.navTo('Contacts', {
                                                    activeTab: 'invite',
                                                })}
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
                                                    <TherrIcon
                                                        style={
                                                            currentScreen === 'Settings'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="settings"
                                                        size={24}
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
                                                    <TherrIcon
                                                        style={
                                                            currentScreen === 'Home'
                                                                ? themeMenu.styles.iconStyleActive
                                                                : themeMenu.styles.iconStyle
                                                        }
                                                        name="question"
                                                        size={24}
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
                                                    <TherrIcon
                                                        style={themeMenu.styles.iconStyle}
                                                        name="door-open"
                                                        size={24}
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

export default connect(mapStateToProps, mapDispatchToProps)(React.memo(HeaderMenuRight));
