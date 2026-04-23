import React from 'react';
import { ActivityIndicator, Dimensions, View } from 'react-native';
import { connect } from 'react-redux';
import { Button, Image } from 'react-native-elements';
import 'react-native-gesture-handler';
import TherrIcon from '../../components/TherrIcon';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from './';
import { getUserImageUri } from '../../utilities/content';
import { PEOPLE_CAROUSEL_TABS } from '../../constants';
import { isUserAuthenticated } from '../../utilities/authUtils';
import Toast from 'react-native-toast-message';

const { width: screenWidth } = Dimensions.get('window');

// HABITS app has 4 tabs: Habits, Pacts, Connect, Profile
const HABITS_TAB_COUNT = 4;
const buttonWidth = screenWidth / HABITS_TAB_COUNT;

const ViewProfileButton = ({
    activeRoute,
    goToMyProfile,
    imageStyle,
    themeMenu,
    translate,
    user,
}) => (
    <View style={[
        (activeRoute === 'ViewUser'
            ? themeMenu.styles.buttonContainerActive
            : themeMenu.styles.buttonContainer),
        {
            width: buttonWidth,
        },
    ]}>
        <Button
            buttonStyle={themeMenu.styles.buttons}
            containerStyle={themeMenu.styles.buttonContainerUserProfile}
            titleStyle={themeMenu.styles.buttonsTitle}
            icon={
                isUserAuthenticated(user) ?
                    <Image
                        source={{ uri: getUserImageUri(user, 50) }}
                        style={imageStyle}
                        PlaceholderContent={<ActivityIndicator size="small" color={themeMenu.colors.primary} />}
                    /> :
                    <TherrIcon
                        name="user-star"
                        size={22}
                        style={themeMenu.styles.buttonIcon}
                    />
            }
            onPress={goToMyProfile}
            title={translate('menus.main.buttons.profile')}
            type="clear"
        />
    </View>
);

/**
 * HABITS app button menu with Habits, Pacts, Connect, and Profile tabs
 */
class HabitsButtonMenu extends ButtonMenu {
    constructor(props) {
        super(props);
        this.state = {};
    }

    navTo = (routeName, params = {}) => {
        const { navigation, user } = this.props;

        if (!isUserAuthenticated(user)) {
            navigation.reset({
                index: 1,
                routes: [
                    {
                        name: 'HabitsDashboard',
                    },
                    {
                        name: 'Login',
                    },
                ],
            });
        } else {
            navigation.navigate(routeName, params);
        }
    };

    goToMyProfile = () => {
        const { navigation, user } = this.props;
        const currentScreen = this.getCurrentScreen();

        if (!isUserAuthenticated(user)) {
            navigation.reset({
                index: 1,
                routes: [
                    {
                        name: 'HabitsDashboard',
                    },
                    {
                        name: 'Login',
                    },
                ],
            });
        } else if (currentScreen === 'ViewUser') {
            navigation.setParams({
                userInView: {
                    id: user.details.id,
                },
            });
        } else {
            navigation.navigate('ViewUser', {
                userInView: {
                    id: user.details.id,
                },
            });
        }
    };

    onNavPressDynamic = (viewDestinationName: string, viewDestinationParams = {}) => {
        const { onActionButtonPress } = this.props;
        const currentScreen = this.getCurrentScreen();

        if (currentScreen === viewDestinationName && onActionButtonPress) {
            onActionButtonPress();
        } else {
            this.navTo(viewDestinationName, viewDestinationParams);
        }
    };

    showLoginToast = (message) => {
        const { navigation, translate } = this.props;

        Toast.show({
            type: 'info',
            text1: translate('alertTitles.loginRequired'),
            text2: message,
            visibilityTime: 3000,
            onPress: () => {
                Toast.hide();
                navigation.navigate('Login');
            },
        });
    };

    render() {
        const { isCompact, translate, themeMenu, user } = this.props;
        const activeRoute = this.getActiveRoute();
        const isHabitsActive = ['HabitsDashboard', 'HabitDetail'].includes(activeRoute);
        const isPactsActive = ['PactsList', 'PactDetail', 'CreatePact'].includes(activeRoute);
        const isConnectActive = activeRoute === 'Connect';
        const imageStyle = {
            height: 26,
            width: 26,
            borderRadius: 15,
        };

        return (
            <ButtonMenu {...this.props}>
                {/* Habits Tab */}
                <Button
                    title={!isCompact ? translate('menus.habits.buttons.habits') : null}
                    buttonStyle={
                        isHabitsActive
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={[
                        (isHabitsActive
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer),
                        {
                            width: buttonWidth,
                        },
                    ]}
                    titleStyle={
                        isHabitsActive
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="check-mark"
                            size={24}
                            style={
                                isHabitsActive
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.onNavPressDynamic('HabitsDashboard')}
                />

                {/* Pacts Tab */}
                <Button
                    title={!isCompact ? translate('menus.habits.buttons.pacts') : null}
                    buttonStyle={
                        isPactsActive
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={[
                        (isPactsActive
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer),
                        {
                            width: buttonWidth,
                        },
                    ]}
                    titleStyle={
                        isPactsActive
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="group"
                            size={24}
                            style={
                                isPactsActive
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.onNavPressDynamic('PactsList')}
                />

                {/* Connect Tab (for finding partners) */}
                <Button
                    title={!isCompact ? translate('menus.habits.buttons.partners') : null}
                    buttonStyle={
                        isConnectActive
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={[
                        (isConnectActive
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer),
                        {
                            width: buttonWidth,
                        },
                    ]}
                    titleStyle={
                        isConnectActive
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="key-user"
                            size={22}
                            style={
                                isConnectActive
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => {
                        this.navTo('Connect', {
                            activeTab: PEOPLE_CAROUSEL_TABS.PEOPLE,
                        });
                    }}
                />

                {/* Profile Tab (always shown) */}
                <ViewProfileButton
                    activeRoute={activeRoute}
                    goToMyProfile={this.goToMyProfile}
                    imageStyle={imageStyle}
                    themeMenu={themeMenu}
                    translate={translate}
                    user={user}
                />
            </ButtonMenu>
        );
    }
}

export default (connect(mapStateToProps, mapDispatchToProps)(React.memo(HabitsButtonMenu)));
