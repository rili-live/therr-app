import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { showToast } from '../../utilities/toasts';
import { RefreshControl } from 'react-native-gesture-handler';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../utilities/translator';
import {
    triggerClaimErrorFeedback,
    triggerClaimPressFeedback,
    triggerClaimSuccessFeedback,
} from '../../utilities/rewardFeedback';
import { recordPositiveSignal } from '../../utilities/appReviewPrompt';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildAchievementStyles } from '../../styles/achievements';
import BaseStatusBar from '../../components/BaseStatusBar';
import AchievementCollection from './AchievementCollection';
import { IAchievementBadge } from '../../utilities/achievementCollection';
import HabitCompanionCard from '../../components/HabitCompanion/HabitCompanionCard';

// The growing chameleon companion is a Friends with Habits feature: its stages are tuned to
// the habits achievement ladder, which no other brand earns.
const isHabitCompanionEnabled = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;

interface IAchievementsDispatchProps {
    claimMyAchievement: Function;
    getMyAchievements: Function;
    updateUser: Function;
}

interface IStoreProps extends IAchievementsDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IAchievementsProps extends IStoreProps {
    navigation: any;
}

interface IAchievementsState {
    claimingIds: { [key: string]: boolean };
    isRefreshing: boolean;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    claimMyAchievement: UsersActions.claimMyAchievement,
    getMyAchievements: UsersActions.getMyAchievements,
    updateUser: UsersActions.update,
}, dispatch);

export class Achievements extends React.Component<IAchievementsProps, IAchievementsState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeAchievements = buildAchievementStyles();
    private unsubscribeNavigationListener;

    constructor(props) {
        super(props);

        this.state = {
            claimingIds: {},
            isRefreshing: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeAchievements = buildAchievementStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.achievements.headerTitle'),
        });

        this.unsubscribeNavigationListener = this.props.navigation.addListener('focus', () => {
            this.handleRefresh();
        });

        this.handleRefresh();
    };

    componentWillUnmount() {
        if (this.unsubscribeNavigationListener) {
            this.unsubscribeNavigationListener();
        }
    }

    handleRefresh = () => {
        // A failed refresh leaves whatever is cached on screen — the collection still draws
        // from the config — so it is logged rather than surfaced as an error over content
        // the user can still read.
        this.props.getMyAchievements()
            .catch((err) => console.log('GET_ACHIEVEMENTS_ERROR', err))
            .finally(() => {
                this.setState({
                    isRefreshing: false,
                });
            });
    };

    handlePullToRefresh = () => {
        this.setState({ isRefreshing: true });
        this.handleRefresh();
    };

    handleClaim = (badge: IAchievementBadge) => {
        const { claimMyAchievement, getMyAchievements } = this.props;
        const { userAchievement } = badge;

        if (!userAchievement?.id || this.state.claimingIds[userAchievement.id]) {
            return;
        }

        // Tactile acknowledgement fires before the request so the button feels
        // instant even when the network is slow.
        triggerClaimPressFeedback();

        this.setState((prev) => ({
            claimingIds: { ...prev.claimingIds, [userAchievement.id]: true },
        }));

        claimMyAchievement(userAchievement.id, userAchievement.unclaimedRewardPts).then(() => {
            triggerClaimSuccessFeedback();
            // Counts toward the app-review prompt. Fire-and-forget: a storage failure must
            // not affect the claim that just succeeded.
            recordPositiveSignal('achievementClaimed').catch((err) => console.log('APP_REVIEW_SIGNAL_ERROR', err));
            showToast.success({
                text1: this.translate('alertTitles.coinsReceived'),
                text2: this.translate('alertMessages.coinsReceived', {
                    total: userAchievement.unclaimedRewardPts,
                }),
            });
            const claimedAchievement = {
                ...userAchievement,
                unclaimedRewardPts: 0,
                completedAt: userAchievement.completedAt || new Date().toISOString(),
            };
            getMyAchievements().catch((err) => console.log('GET_ACHIEVEMENTS_ERROR', err));
            this.openAchievement(claimedAchievement, true);
        }).catch(() => {
            triggerClaimErrorFeedback();
            showToast.error({
                text1: this.translate('alertTitles.backendErrorMessage'),
                text2: this.translate('alertMessages.backendErrorMessage'),
            });
        }).finally(() => {
            this.setState((prev) => {
                const next = { ...prev.claimingIds };
                delete next[userAchievement.id];
                return { claimingIds: next };
            });
        });
    };

    openAchievement = (userAchievement: any, isClaiming: boolean = false) => {
        const { navigation } = this.props;

        navigation.navigate('AchievementClaim', {
            userAchievement,
            isClaiming,
        });
    };

    onPressBadge = (badge: IAchievementBadge) => {
        // A locked badge has no backend row yet; the detail screen only needs to know which
        // achievement it is, and reads everything else from the config.
        this.openAchievement(badge.userAchievement || {
            achievementClass: badge.achievementClass,
            achievementId: badge.achievementId,
        });
    };

    goToLeaderboard = () => {
        const { navigation } = this.props;

        navigation.navigate('Leaderboard');
    };

    renderListHeader = () => (
        <>
            {isHabitCompanionEnabled && (
                <HabitCompanionCard
                    achievements={this.props.user.achievements}
                    accountCreatedAt={this.props.user.details?.createdAt}
                    brandVariation={CURRENT_BRAND_VARIATION}
                    themeAchievements={this.themeAchievements}
                    translate={this.translate as (key: string, params?: any) => string}
                />
            )}
            {this.renderLeaderboardLink()}
        </>
    );

    renderLeaderboardLink = () => (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={this.translate('pages.achievements.buttons.viewLeaderboard')}
            onPress={this.goToLeaderboard}
            style={({ pressed }) => [
                this.themeAchievements.styles.leaderboardLink,
                pressed && this.themeAchievements.styles.leaderboardLinkPressed,
            ]}
        >
            <View style={this.themeAchievements.styles.leaderboardLinkContent}>
                <View style={this.themeAchievements.styles.leaderboardIconContainer}>
                    <FontAwesome5Icon
                        name="trophy"
                        size={14}
                        color={this.themeAchievements.colors.onBrand}
                    />
                </View>
                <Text style={this.themeAchievements.styles.leaderboardLinkText}>
                    {this.translate('pages.achievements.buttons.viewLeaderboard')}
                </Text>
            </View>
            <FontAwesome5Icon
                name="chevron-right"
                size={13}
                color={this.themeAchievements.colors.onBrand}
            />
        </Pressable>
    );

    render() {
        const { navigation, user } = this.props;
        const { claimingIds, isRefreshing } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]}  style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colors.backgroundGray }]}>
                    <View style={[this.theme.styles.body, { backgroundColor: this.theme.colors.backgroundGray }]}>
                        <AchievementCollection
                            achievements={user.achievements}
                            brandVariation={CURRENT_BRAND_VARIATION}
                            claimingIds={claimingIds}
                            onClaim={this.handleClaim}
                            onPressBadge={this.onPressBadge}
                            ListHeaderComponent={this.renderListHeader()}
                            ListEmptyComponent={
                                <View style={this.theme.styles.sectionContainer}>
                                    <Text style={this.theme.styles.sectionDescriptionCentered}>
                                        {this.translate(
                                            'pages.achievements.info.noAchievementsFound'
                                        )}
                                    </Text>
                                </View>
                            }
                            refreshControl={<RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={this.handlePullToRefresh}
                            />}
                            themeAchievements={this.themeAchievements}
                            translate={this.translate as (key: string, params?: any) => string}
                        />
                    </View>
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Achievements);
