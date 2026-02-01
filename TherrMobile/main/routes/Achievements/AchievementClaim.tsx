/* eslint-disable max-len */
import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import LottieView from 'lottie-react-native';
import { IUserState } from 'therr-react/types';
import { achievementsByClass } from 'therr-js-utilities/config';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildAchievementStyles } from '../../styles/achievements';
import textStyles from '../../styles/text';
import BaseStatusBar from '../../components/BaseStatusBar';
import { ScrollView } from 'react-native-gesture-handler';

const achievementConfetti = require('../../assets/achievement-confetti-2.json');
const cardImagesLottie = {
    explorer: require('../../assets/explorer-card.json'),
    influencer: require('../../assets/influencer-card.json'),
    socialite: require('../../assets/socialite-card.json'),
    communityLeader: require('../../assets/socialite-card.json'),
    thinker: require('../../assets/thinker-card.json'),
};

interface IAchievementClaimDispatchProps {
    claimMyAchievement: Function;
    updateUser: Function;
}

interface IStoreProps extends IAchievementClaimDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IAchievementClaimProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IAchievementClaimState {
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    claimMyAchievement: UsersActions.claimMyAchievement,
    updateUser: UsersActions.update,
}, dispatch);

export class AchievementClaim extends React.Component<IAchievementClaimProps, IAchievementClaimState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeAchievements = buildAchievementStyles();

    constructor(props) {
        super(props);

        this.state = {
            isRefreshing: false,
        };

        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeAchievements = buildAchievementStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.achievements.headerTitle'),
        });

        this.handleRefresh();
    };

    handleRefresh = () => {
        console.log('refresh');
    };

    renderDescription = (userAchievement) => {
        const { route } = this.props;
        const { isClaiming } = route.params;

        if (userAchievement.completedAt) {
            if (parseFloat(userAchievement.unclaimedRewardPts || '0') !== 0) {
                if (isClaiming) {
                    if (userAchievement.achievementClass === 'influencer') {
                        return (
                            <Text style={[this.theme.styles.sectionDescriptionCentered]}>
                                {this.translate('pages.achievements.info.congratulationsInfluencer', { achievementTitle: userAchievement.achievementClass })}
                            </Text>
                        );
                    }
                    return (
                        <Text style={[this.theme.styles.sectionDescriptionCentered]}>
                            {this.translate('pages.achievements.info.congratulations', { achievementTitle: userAchievement.achievementClass })}
                        </Text>
                    );
                }

                return (
                    <Text style={[this.theme.styles.sectionDescriptionCentered]}>
                        {this.translate('pages.achievements.info.unClaimed', { achievementTitle: userAchievement.achievementClass })}
                    </Text>
                );
            }

            return (
                <Text style={[this.theme.styles.sectionDescriptionCentered]}>
                    {this.translate('pages.achievements.info.alreadyClaimed', { achievementTitle: userAchievement.achievementClass })}
                </Text>
            );
        }

        return (
            <Text style={[this.theme.styles.sectionDescriptionCentered]}>
                {this.translate('pages.achievements.info.inProgressDescription', { achievementTitle: userAchievement.achievementClass })}
            </Text>
        );
    };

    renderTitle = (userAchievement) => {
        const { route } = this.props;
        const { isClaiming } = route.params;
        const achievement = achievementsByClass[userAchievement.achievementClass][userAchievement.achievementId];

        if (userAchievement.completedAt) {
            if (parseFloat(userAchievement.unclaimedRewardPts || '0') !== 0) {
                if (isClaiming) {
                    return (
                        <Text style={[this.theme.styles.sectionTitleCenter, textStyles.capitalize]}>
                            {this.translate('pages.achievements.info.claimTitle', {
                                achievementClass: userAchievement.achievementClass.replace(/([A-Z])/g, ' $1'),
                                achievementTitle: achievement.title,
                            })}
                        </Text>
                    );
                }
                return (
                    <Text style={[this.theme.styles.sectionTitleCenter, textStyles.capitalize]}>
                        {this.translate('pages.achievements.info.claimTitleInProgress', {
                            achievementClass: userAchievement.achievementClass.replace(/([A-Z])/g, ' $1'),
                            achievementTitle: achievement.title,
                        })}
                    </Text>
                );
            }
        }

        return (
            <Text style={[this.theme.styles.sectionTitleCenter, textStyles.capitalize]}>
                {this.translate('pages.achievements.info.claimTitleInProgress', {
                    achievementClass: userAchievement.achievementClass.replace(/([A-Z])/g, ' $1'),
                    achievementTitle: achievement.title,
                })}
            </Text>
        );
    };

    renderDetails = (userAchievement) => {
        const achievement = achievementsByClass[userAchievement.achievementClass][userAchievement.achievementId];

        if (userAchievement.completedAt) {
            if (parseFloat(userAchievement.unclaimedRewardPts || '0') === 0) {
                return (
                    null
                );
            }
        }

        return (
            <>
                <Text style={[this.theme.styles.sectionDescriptionCentered]}>
                    {`${this.translate('pages.achievements.labels.coinValue')}:`} <Text style={{ fontWeight: '600' }}>{this.translate('pages.achievements.info.numberOfCoins', { pointReward: achievement.pointReward })}</Text>
                </Text>
                <Text style={[this.theme.styles.sectionDescriptionCentered]}>
                    {`${this.translate('pages.achievements.labels.xpValue')}:`} <Text style={{ fontWeight: '600' }}>{this.translate('pages.achievements.info.numberOfXp', { pointReward: achievement.xp })}</Text>
                </Text>
            </>
        );
    };

    render() {
        const { navigation, route, user } = this.props;
        // const pageHeaderAchievements = this.translate('pages.achievements.pageHeader');
        const { userAchievement } = route.params;
        // const achievement = achievementsByClass[userAchievement.achievementClass][userAchievement.achievementId];


        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={[this.theme.styles.safeAreaView]}>
                    <ScrollView
                        style={[this.theme.styles.body]}
                        contentContainerStyle={[this.theme.styles.bodyScroll]}
                    >
                        {/* <View style={this.theme.styles.sectionContainer}>
                            <Text style={this.theme.styles.sectionTitle}>
                                {pageHeaderAchievements}
                            </Text>
                        </View> */}
                        <View style={{ display: 'flex', height: 420, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <LottieView
                                source={achievementConfetti}
                                resizeMode="cover"
                                speed={1}
                                autoPlay
                                loop
                                style={{ position: 'absolute', width: '100%', height: '100%' }}
                            />
                            <View style={this.themeAchievements.styles.cardImageContainerLarge}>
                                {/* <Image
                                    source={cardImages[userAchievement.achievementClass]}
                                    style={this.themeAchievements.styles.cardImageLarge}
                                /> */}
                                <View style={this.themeAchievements.styles.cardImageLarge}>
                                    <LottieView
                                        source={cardImagesLottie[userAchievement.achievementClass]}
                                        resizeMode="cover"
                                        speed={2.4}
                                        autoPlay
                                        loop={false}
                                        style={{ position: 'absolute', width: '100%', height: '100%' }}
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={this.theme.styles.sectionContainer}>
                            {
                                this.renderTitle(userAchievement)
                            }
                            {
                                this.renderDescription(userAchievement)
                            }
                            {
                                this.renderDetails(userAchievement)
                            }
                        </View>
                    </ScrollView>
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

export default connect(mapStateToProps, mapDispatchToProps)(AchievementClaim);
