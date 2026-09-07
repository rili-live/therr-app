import React from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native';
import { connect } from 'react-redux';
import { IHabitsState } from 'therr-react/types';
import { Button } from '../BaseButton';
import { Image } from '../BaseImage';
import 'react-native-gesture-handler';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import TherrIcon from '../../components/TherrIcon';
import { ButtonMenu, mapStateToProps as baseMapStateToProps, mapDispatchToProps } from './';
import { getHabitsTabLayout } from './habitsTabLayout';
import { getHabitsBadgeState } from './habitsBadgeState';
import getConfig from '../../utilities/getConfig';
import { getUserImageUri } from '../../utilities/content';
import { PEOPLE_CAROUSEL_TABS } from '../../constants';
import { isUserAuthenticated } from '../../utilities/authUtils';
import Toast from 'react-native-toast-message';

interface IHabitsButtonMenuProps {
    habits: IHabitsState;
    [key: string]: any;
}

const { width: screenWidth } = Dimensions.get('window');

// HABITS shows 5 tabs — Habits, Journal, Awards, Connect, Profile — dropping
// the flagged ones where they are switched off. See `habitsTabLayout.ts` for
// why the count is derived from the flags rather than constant.
const getTabLayout = () => getHabitsTabLayout(screenWidth, getConfig().featureFlags || {});

const localStyles = StyleSheet.create({
    // Unlike the icon-font tabs, the avatar is a bitmap that fills its box
    // edge-to-edge with no side bearing, so it needs an explicit gap to sit
    // the same distance from its label as the other tabs' glyphs do.
    profileIconContainer: {
        marginRight: 6,
    },
    // `menu-book` is one of the few Material glyphs that fills its 24px em box
    // horizontally, so its label sits flush against it while the other tabs'
    // narrower glyphs get a gap from their own side bearing.
    journalIconContainer: {
        marginRight: 4,
    },
    badge: {
        position: 'absolute',
        top: 7,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#E37107',
        paddingHorizontal: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
});

const ViewProfileButton = ({
    activeRoute,
    buttonWidth,
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
            iconContainerStyle={localStyles.profileIconContainer}
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
 * HABITS app button menu with Habits, Journal, Awards, Connect, and Profile tabs.
 *
 * There is no Pacts tab: the pact lists are segments of the Habits screen now,
 * so a second tab pointing at the same screen would only have split the two
 * halves of one flow across the bar. Awards (Achievements) took the slot.
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
        const {
            isCompact, translate, themeMenu, user, habits,
        } = (this.props as unknown as IHabitsButtonMenuProps);
        const { isJournalEnabled, isAchievementsEnabled, buttonWidth } = getTabLayout();
        const activeRoute = this.getActiveRoute();
        const isHabitsActive = [
            'HabitsDashboard', 'HabitDetail', 'PactDetail', 'CreatePact', 'CreatePactInvite',
        ].includes(activeRoute);
        const isJournalActive = activeRoute === 'Journal';
        const isAchievementsActive = ['Achievements', 'AchievementClaim'].includes(activeRoute);
        const isConnectActive = activeRoute === 'Connect';
        // Badge counts only invites awaiting this user's reply, and the landing
        // segment follows it — see `habitsBadgeState.ts` for why the sent-invite
        // count no longer badges the tab bar. That count still exists: it is the
        // chip on the dashboard's Sent segment, beside the nudge and re-invite
        // actions that can actually move it.
        const { badgeCount, initialTab: initialHabitsTab } = getHabitsBadgeState(
            habits?.pendingInvites,
            habits?.pacts,
            habits?.activePacts,
            user?.details?.id,
        );
        const imageStyle = {
            height: 26,
            width: 26,
            borderRadius: 15,
        };

        return (
            <ButtonMenu {...this.props}>
                {/* Habits Tab — habits and pacts both live behind this one */}
                <View style={{ width: buttonWidth }}>
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
                            <MaterialIcon
                                name="check-circle"
                                size={24}
                                style={
                                    isHabitsActive
                                        ? themeMenu.styles.buttonIconActive
                                        : themeMenu.styles.buttonIcon
                                }
                            />
                        }
                        onPress={() => this.onNavPressDynamic('HabitsDashboard', { initialTab: initialHabitsTab })}
                        accessibilityLabel={badgeCount > 0
                            ? translate('menus.habits.accessibility.habitsWithInvites', { count: badgeCount })
                            : translate('menus.habits.buttons.habits')}
                    />
                    {/* Count of invites awaiting this user's reply. Hidden from
                        the accessibility tree because the button above already
                        says it in words. */}
                    {badgeCount > 0 && (
                        <View
                            style={[localStyles.badge, { right: buttonWidth / 2 - 20 }]}
                            pointerEvents="none"
                            importantForAccessibility="no-hide-descendants"
                            accessibilityElementsHidden
                        >
                            <Text style={localStyles.badgeText}>
                                {badgeCount > 9 ? '9+' : String(badgeCount)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Journal Tab — gated on the same flag that registers the route */}
                {isJournalEnabled && <Button
                    title={!isCompact ? translate('menus.habits.buttons.journal') : null}
                    buttonStyle={
                        isJournalActive
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={[
                        (isJournalActive
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer),
                        {
                            width: buttonWidth,
                        },
                    ]}
                    titleStyle={
                        isJournalActive
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <MaterialIcon
                            name="menu-book"
                            size={24}
                            style={
                                isJournalActive
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    iconContainerStyle={!isCompact ? localStyles.journalIconContainer : undefined}
                    onPress={() => this.onNavPressDynamic('Journal')}
                />}

                {/* Achievements Tab — gated on the same flag that registers the route */}
                {isAchievementsEnabled && <Button
                    title={!isCompact ? translate('menus.habits.buttons.achievements') : null}
                    buttonStyle={
                        isAchievementsActive
                            ? themeMenu.styles.buttonsActive
                            : themeMenu.styles.buttons
                    }
                    containerStyle={[
                        (isAchievementsActive
                            ? themeMenu.styles.buttonContainerActive
                            : themeMenu.styles.buttonContainer),
                        {
                            width: buttonWidth,
                        },
                    ]}
                    titleStyle={
                        isAchievementsActive
                            ? themeMenu.styles.buttonsTitleActive
                            : themeMenu.styles.buttonsTitle
                    }
                    icon={
                        <TherrIcon
                            name="achievement"
                            size={24}
                            style={
                                isAchievementsActive
                                    ? themeMenu.styles.buttonIconActive
                                    : themeMenu.styles.buttonIcon
                            }
                        />
                    }
                    onPress={() => this.onNavPressDynamic('Achievements')}
                />}

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
                    buttonWidth={buttonWidth}
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

const mapStateToPropsHabits = (state: any) => ({
    ...baseMapStateToProps(state),
    habits: state.habits,
});

export default (connect(mapStateToPropsHabits, mapDispatchToProps)(React.memo(HabitsButtonMenu)));
