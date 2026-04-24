import React from 'react';
import { Pressable, Text, View, Modal, ScrollView, Dimensions, InteractionManager } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Badge, Drawer } from 'react-native-paper';
import { Button } from './BaseButton';
import { Image } from './BaseImage';
import { CommonActions } from '@react-navigation/native';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { INotificationsState } from 'therr-react/types';
import { BrandVariations } from 'therr-js-utilities/constants';
import {
    AttachStep,
} from 'react-native-spotlight-tour';
import translator from '../utilities/translator';
import { ILocationState } from '../types/redux/location';
import requestLocationServiceActivation from '../utilities/requestLocationServiceActivation';
import { ITherrThemeColors } from '../styles/themes';
import { getUserImageUri } from '../utilities/content';
import UsersActions from '../redux/actions/UsersActions';
import InfoModal from './Modals/InfoModal';
import TherrIcon from './TherrIcon';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import { GROUPS_CAROUSEL_TABS, PEOPLE_CAROUSEL_TABS } from '../constants';
import { Sheets } from 'react-native-actions-sheet';

const LOGO_GLYPH_NAME = CURRENT_BRAND_VARIATION === BrandVariations.HABITS
    ? 'cami-glyph'
    : 'therr-logo';

// const TherrIcon = createIconSetFromIcoMoon(
//     therrIconConfig,
//     'TherrFont',
//     'TherrFont.ttf'
// );

const DRAWER_ANIM_DURATION = 280;
const DRAWER_EASING_IN = Easing.in(Easing.cubic);
const DRAWER_EASING_OUT = Easing.out(Easing.cubic);

interface IDrawerOverlayProps {
    isOpen: boolean;
    onRequestClose: () => void;
    onTransitionEnd?: () => void;
    overlayStyle: any;
    drawerContainerStyle: any;
    drawerBodyStyle: any;
    children: React.ReactNode;
}

const DrawerOverlay: React.FC<IDrawerOverlayProps> = ({
    isOpen,
    onRequestClose,
    onTransitionEnd,
    overlayStyle,
    drawerContainerStyle,
    drawerBodyStyle,
    children,
}) => {
    const slide = useSharedValue(Dimensions.get('window').width * 0.75);
    const backdropOpacity = useSharedValue(0);
    const [isMounted, setIsMounted] = React.useState(false);
    const onTransitionEndRef = React.useRef(onTransitionEnd);
    React.useEffect(() => {
        onTransitionEndRef.current = onTransitionEnd;
    });
    const notifyTransitionEnd = React.useCallback(() => {
        if (onTransitionEndRef.current) {
            onTransitionEndRef.current();
        }
    }, []);

    React.useEffect(() => {
        const menuWidth = Dimensions.get('window').width * 0.75;
        if (isOpen) {
            if (!isMounted) {
                slide.value = menuWidth;
                backdropOpacity.value = 0;
                setIsMounted(true);
                return undefined;
            }
            // Defer the opening animation until after the Modal's native window
            // has mounted; starting in the same frame drops frames on Android.
            const task = InteractionManager.runAfterInteractions(() => {
                slide.value = withTiming(0, {
                    duration: DRAWER_ANIM_DURATION,
                    easing: DRAWER_EASING_OUT,
                });
                backdropOpacity.value = withTiming(
                    1,
                    { duration: DRAWER_ANIM_DURATION, easing: DRAWER_EASING_OUT },
                    (finished) => {
                        'worklet';
                        if (finished) {
                            runOnJS(notifyTransitionEnd)();
                        }
                    }
                );
            });
            return () => task.cancel();
        }
        if (isMounted) {
            slide.value = withTiming(menuWidth, {
                duration: DRAWER_ANIM_DURATION,
                easing: DRAWER_EASING_IN,
            });
            backdropOpacity.value = withTiming(
                0,
                { duration: DRAWER_ANIM_DURATION, easing: DRAWER_EASING_IN },
                (finished) => {
                    'worklet';
                    if (finished) {
                        runOnJS(setIsMounted)(false);
                        runOnJS(notifyTransitionEnd)();
                    }
                }
            );
        }
        return undefined;
    }, [isOpen, isMounted, notifyTransitionEnd, slide, backdropOpacity]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const drawerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: slide.value }],
    }));

    return (
        <Modal
            animationType="none"
            visible={isMounted}
            onRequestClose={onRequestClose}
            transparent={true}
        >
            <Animated.View style={[{ flex: 1 }, backdropStyle]}>
                <Pressable onPress={onRequestClose} style={overlayStyle}>
                    <Animated.View style={[drawerContainerStyle, drawerStyle]}>
                        <Pressable style={drawerBodyStyle} onPress={() => { /* Prevent dismissal when tapping inside */ }}>
                            {children}
                        </Pressable>
                    </Animated.View>
                </Pressable>
            </Animated.View>
        </Modal>
    );
};

interface IHeaderMenuRightDispatchProps {
    updateTour: Function;
}

interface IStoreProps extends IHeaderMenuRightDispatchProps {
}

// Regular component props
export interface IHeaderMenuRightProps extends IStoreProps {
    currentScreen: string;
    currentScreenParams: {
        [key: string]: any;
    };
    isVisible: boolean;
    isEmailVerifed: boolean;
    location: ILocationState;
    logout: Function;
    navigation: any;
    notifications: INotificationsState;
    styleName: 'light' | 'dark' | 'accent';
    updateGpsStatus: Function;
    user: any;
    showActionSheet:(sheetId: 'group-sheet' | 'user-sheet', options?: {
        payload: Partial<Sheets[typeof sheetId]['payload']>;
        // onClose?: (data: Sheets[typeof sheetId]['returnValue'] | undefined) => void;
        context?: string;
    }) => Promise<any>;
    startNavigationTour: () => void;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        styles: any;
    };
    themeInfoModal: {
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

const mapStateToProps = (state: any) => ({ user: state.user });

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

    private bottomSheetRef;

    private pendingOverlayResolver: ((value: null) => void) | null = null;

    constructor(props) {
        super(props);

        this.state = {
            isModalVisible: false,
            isPointsInfoModalVisible: false,
        };

        this.translate = (key: string, params: any) => translator(props.user?.settings?.locale || 'en-us', key, params);
    }

    componentWillUnmount = () => {
        clearTimeout(this.timeoutId);
    };

    toggleOverlay = (shouldClose?: boolean) => {
        const { isModalVisible } = this.state;
        const nextVisible = shouldClose ? false : !isModalVisible;

        return new Promise<null>((resolve) => {
            if (nextVisible === isModalVisible) {
                resolve(null);
                return;
            }
            if (this.pendingOverlayResolver) {
                const prev = this.pendingOverlayResolver;
                this.pendingOverlayResolver = null;
                prev(null);
            }
            this.pendingOverlayResolver = resolve;
            this.setState({ isModalVisible: nextVisible });
        });
    };

    handleDrawerTransitionEnd = () => {
        const pending = this.pendingOverlayResolver;
        if (pending) {
            this.pendingOverlayResolver = null;
            pending(null);
        }
    };

    handleRequestDrawerClose = () => {
        this.toggleOverlay(true);
    };

    expandBottomSheet = (index = 1) => {
        const bottomSheetRef = this.bottomSheetRef;
        this.setState({
            // bottomSheetIsTransparent: false,
            // bottomSheetContentType: content,
        }, () => {
            if (index < 0) {
                bottomSheetRef?.current?.close();
            } else {
                bottomSheetRef?.current?.snapToIndex(index);
            }
        });
    };

    navTo = (routeName, params = {}) => {
        const { currentScreen, location, navigation, updateGpsStatus } = this.props;

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

            if (routeName === 'Connect' && currentScreen.startsWith('Connect')) {
                navigation.replace(routeName, params);
            } else if (routeName === 'Groups' && currentScreen.startsWith('Groups')) {
                navigation.replace(routeName, params);
            } else {
                navigation.navigate(routeName, params);
            }
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

        updateTour({
            isTouring: true,
        }, user.details.id);

        if (this.getCurrentScreen() !== 'Map') {
            navigation.navigate('Map', {
                shouldShowPreview: false,
            });
        }
    };

    startNavigationTour = () => {
        const { navigation, user, updateTour } = this.props;
        this.toggleOverlay();

        updateTour({
            isTouring: false,
            isNavigationTouring: true,
        }, user.details.id);

        if (this.getCurrentScreen() !== 'Map') {
            // Navigate to Map with param so Map can start the tour after mounting
            navigation.navigate('Map', {
                shouldShowPreview: false,
                shouldStartNavigationTour: true,
            });
        } else {
            this.props.startNavigationTour();
        }
    };

    getCurrentScreen = () => {
        const navState = this.props.navigation.getState();
        if (navState.routes[navState.routes.length - 1]) {
            if (navState.routes[navState.routes.length - 1]?.params?.activeTab) {
                return `${navState.routes[navState.routes.length - 1].name}-${navState.routes[navState.routes.length - 1]?.params?.activeTab}`;
            }
            return navState.routes[navState.routes.length - 1].name;
        }

        return '';
    };

    getCurrentScreenParams = () => {
        const navState = this.props.navigation.getState();

        return navState.routes?.[navState.routes.length - 1]?.params || {};
    };

    togglePointsInfoModal = () => {
        const { isPointsInfoModalVisible } = this.state;

        if (!isPointsInfoModalVisible) {
            // Close the menu first so the modal is not hidden behind it
            this.toggleOverlay(true);
        }

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
            currentScreen,
            currentScreenParams,
            isVisible,
            isEmailVerifed,
            notifications,
            showActionSheet,
            // styleName,
            theme,
            themeButtons,
            themeInfoModal,
            themeMenu,
            user,
        } = this.props;

        const { isModalVisible, isPointsInfoModalVisible } = this.state;
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

            if (!isEmailVerifed) {
                return (
                    <AttachStep index={4}>
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
                    </AttachStep>
                );
            }

            if (currentScreen === 'ViewGroup' && currentScreenParams?.id) {
                return (
                    <>
                        <View>
                            <Button
                                icon={
                                    <TherrIcon
                                        name="dots-horiz"
                                        size={30}
                                        color={theme.colors.primary3}
                                    />}
                                onPress={() => showActionSheet('group-sheet', {
                                    payload: {
                                        group: currentScreenParams,
                                    },
                                })}
                                type="clear"
                                containerStyle={themeMenu.styles.userProfileButtonContainerVerified}
                            />
                        </View>
                    </>
                );
            }

            if (currentScreen === 'ViewUser' && (currentScreenParams?.userInView?.id !== user.details.id) && user?.userInView?.connectionType > 0) {
                const connectionType = user?.userInView?.connectionType;
                const isStrongConnection = connectionType && connectionType > 1;
                let iconName = 'star';
                if (connectionType && connectionType === 2)  {
                    iconName = 'star-half';
                }
                if (connectionType && connectionType > 2)  {
                    iconName = 'star-filled';
                }
                return (
                    <>
                        <View>
                            <Button
                                icon={
                                    <TherrIcon
                                        name={iconName}
                                        size={30}
                                        style={{ color: isStrongConnection ? theme.colors.ternary2 : theme.colors.textGray }}
                                    />
                                }
                                onPress={() => showActionSheet('user-sheet', {
                                    payload: {
                                        group: currentScreenParams,
                                    },
                                })}
                                type="clear"
                                containerStyle={themeMenu.styles.userProfileButtonContainerVerified}
                            />
                        </View>
                    </>
                );
            }

            return (
                <>
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
                        <AttachStep index={4}>
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
                        </AttachStep>
                        {
                            hasNotifications && <Pressable onPress={() => this.toggleOverlay()} style={themeMenu.styles.notificationCircle2}>
                                <Text style={themeMenu.styles.notificationsCountText}>{unreadCount.toString()}</Text>
                            </Pressable>
                        }
                    </View>
                    <DrawerOverlay
                        isOpen={isModalVisible}
                        onRequestClose={this.handleRequestDrawerClose}
                        onTransitionEnd={this.handleDrawerTransitionEnd}
                        overlayStyle={theme.styles.overlay}
                        drawerContainerStyle={themeMenu.styles.overlayContainer}
                        drawerBodyStyle={themeMenu.styles.container}
                    >
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
                                onPress={() => this.toggleOverlay(true)}
                                type="clear"
                            />
                        </View>
                        <View style={themeMenu.styles.subheader}>
                            <View style={themeMenu.styles.subheaderTitle}>
                                <Button
                                    type="clear"
                                    icon={
                                        <TherrIcon
                                            name={LOGO_GLYPH_NAME}
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
                        <ScrollView
                            showsVerticalScrollIndicator
                            persistentScrollbar
                            style={themeMenu.styles.body}
                        >
                            <Drawer.Section>
                                <View style={themeMenu.styles.notificationsItemContainer}>
                                    <Drawer.Item
                                        label={this.translate('components.headerMenuRight.menuItems.notifications')}
                                        icon={() => (
                                            <TherrIcon
                                                style={
                                                    currentScreen === 'Notifications'
                                                        ? themeMenu.styles.iconStyleActive
                                                        : themeMenu.styles.iconStyle
                                                }
                                                name="bell"
                                                size={24}
                                            />
                                        )}
                                        active={currentScreen === 'Notifications'}
                                        onPress={() => this.navTo('Notifications')}
                                    />
                                    {
                                        hasNotifications && (
                                            <Badge style={themeMenu.styles.notificationBadge} size={20}>
                                                {unreadCount}
                                            </Badge>
                                        )
                                    }
                                </View>
                                <Drawer.Item
                                    label={this.translate('components.headerMenuRight.menuItems.achievements')}
                                    icon={() => (
                                        <TherrIcon
                                            style={
                                                currentScreen === 'Achievements'
                                                    ? themeMenu.styles.iconStyleActive
                                                    : themeMenu.styles.iconStyle
                                            }
                                            name="achievement"
                                            size={24}
                                        />
                                    )}
                                    active={currentScreen === 'Achievements'}
                                    onPress={() => this.navTo('Achievements')}
                                />
                                <Drawer.Item
                                    label={this.translate('components.headerMenuRight.menuItems.chat')}
                                    icon={() => (
                                        <TherrIcon
                                            style={
                                                currentScreen === `Connect`
                                                    ? themeMenu.styles.iconStyleActive
                                                    : themeMenu.styles.iconStyle
                                            }
                                            name="chat-smile"
                                            size={24}
                                        />
                                    )}
                                    active={currentScreen === `Connect`}
                                    onPress={() => this.navTo('Connect', {
                                        activeTab: PEOPLE_CAROUSEL_TABS.MESSAGES,
                                    })}
                                />
                                <Drawer.Item
                                    label={this.translate('components.headerMenuRight.menuItems.groups')}
                                    icon={() => (
                                        <TherrIcon
                                            style={
                                                currentScreen === 'Groups'
                                                    ? themeMenu.styles.iconStyleActive
                                                    : themeMenu.styles.iconStyle
                                            }
                                            name="group"
                                            size={24}
                                        />
                                    )}
                                    active={currentScreen === `Groups`}
                                    onPress={() => this.navTo('Groups', {
                                        activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                                    })}
                                />
                                <Drawer.Item
                                    label={this.translate('components.headerMenuRight.menuItems.addConnection')}
                                    icon={() => (
                                        <TherrIcon
                                            style={
                                                currentScreen === 'Invite'
                                                    ? themeMenu.styles.iconStyleActive
                                                    : themeMenu.styles.iconStyle
                                            }
                                            name="key-plus"
                                            size={24}
                                        />
                                    )}
                                    active={currentScreen === 'Invite'}
                                    onPress={() => this.navTo('Invite')}
                                />
                                <Drawer.Item
                                    label={this.translate('components.headerMenuRight.menuItems.myDrafts')}
                                    icon={() => (
                                        <TherrIcon
                                            style={
                                                currentScreen === 'MyDrafts'
                                                    ? themeMenu.styles.iconStyleActive
                                                    : themeMenu.styles.iconStyle
                                            }
                                            name="edit"
                                            size={24}
                                        />
                                    )}
                                    active={currentScreen === 'MyDrafts'}
                                    onPress={() => this.navTo('MyDrafts')}
                                />
                            </Drawer.Section>
                            <Drawer.Section>
                                <Drawer.Item
                                    label={this.translate('components.headerMenuRight.menuItems.account')}
                                    icon={() => (
                                        <TherrIcon
                                            style={
                                                currentScreen === 'Settings'
                                                    ? themeMenu.styles.iconStyleActive
                                                    : themeMenu.styles.iconStyle
                                            }
                                            name="settings"
                                            size={24}
                                        />
                                    )}
                                    active={currentScreen === 'Settings'}
                                    onPress={() => this.navTo('Settings')}
                                />
                                {user.details?.isBusinessAccount ? (
                                    <Drawer.Item
                                        label={this.translate('components.headerMenuRight.menuItems.manageSpaces')}
                                        icon={() => (
                                            <TherrIcon
                                                style={
                                                    currentScreen === 'ManageSpaces'
                                                        ? themeMenu.styles.iconStyleActive
                                                        : themeMenu.styles.iconStyle
                                                }
                                                name="storefront"
                                                size={24}
                                            />
                                        )}
                                        active={currentScreen === 'ManageSpaces'}
                                        onPress={() => this.navTo('ManageSpaces')}
                                    />
                                ) : (
                                    <Drawer.Item
                                        label={this.translate('components.headerMenuRight.menuItems.wallet')}
                                        icon={() => (
                                            <TherrIcon
                                                style={
                                                    currentScreen === 'ExchangePointsDisclaimer'
                                                        ? themeMenu.styles.iconStyleActive
                                                        : themeMenu.styles.iconStyle
                                                }
                                                name="wallet"
                                                size={24}
                                            />
                                        )}
                                        active={currentScreen === 'ExchangePointsDisclaimer'}
                                        onPress={() => this.navTo('ExchangePointsDisclaimer')}
                                    />
                                )}
                                <Drawer.Item
                                    label={this.translate('components.headerMenuRight.menuItems.bookmarks')}
                                    icon={() => (
                                        <TherrIcon
                                            style={
                                                currentScreen === 'BookMarked'
                                                    ? themeMenu.styles.iconStyleActive
                                                    : themeMenu.styles.iconStyle
                                            }
                                            name="bookmark"
                                            size={24}
                                        />
                                    )}
                                    active={currentScreen === 'BookMarked'}
                                    onPress={() => this.navTo('BookMarked')}
                                />
                                <Drawer.Item
                                    label={this.translate('components.headerMenuRight.menuItems.feedback')}
                                    icon={() => (
                                        <TherrIcon
                                            style={
                                                currentScreen === 'Home'
                                                    ? themeMenu.styles.iconStyleActive
                                                    : themeMenu.styles.iconStyle
                                            }
                                            name="question"
                                            size={24}
                                        />
                                    )}
                                    active={currentScreen === 'Home'}
                                    onPress={() => this.navTo('Home')}
                                />
                            </Drawer.Section>
                        </ScrollView>
                        <View style={themeMenu.styles.footer}>
                            <Button
                                titleStyle={themeMenu.styles.buttonsTitle}
                                buttonStyle={[
                                    themeMenu.styles.buttons,
                                    themeMenu.styles.footerButtonCenter,
                                    themeMenu.styles.footerButtonMargin,
                                ]}
                                title={this.translate('components.headerMenuRight.menuItems.tour')}
                                icon={
                                    <FontAwesomeIcon
                                        style={themeMenu.styles.iconStyle}
                                        name="info"
                                        size={18}
                                    />
                                }
                                onPress={this.startNavigationTour}
                            />
                            <Button
                                titleStyle={themeMenu.styles.buttonsTitle}
                                buttonStyle={[themeMenu.styles.buttons, themeMenu.styles.footerButtonCenter]}
                                title={this.translate('components.headerMenuRight.menuItems.logout')}
                                icon={
                                    <TherrIcon
                                        style={themeMenu.styles.iconStyle}
                                        name="door-open"
                                        size={24}
                                    />
                                }
                                onPress={() => this.handleLogout(() => this.toggleOverlay(true))}
                            />
                        </View>
                    </DrawerOverlay>
                    <InfoModal
                        isVisible={isPointsInfoModalVisible}
                        translate={this.translate}
                        onRequestClose={this.togglePointsInfoModal}
                        themeButtons={themeButtons}
                        themeModal={themeInfoModal}
                    />
                </>
            );
        }

        return null;
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderMenuRight);
