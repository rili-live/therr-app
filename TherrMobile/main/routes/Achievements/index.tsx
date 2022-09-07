import React from 'react';
import { Pressable, SafeAreaView, View, Text } from 'react-native';
import { Image }  from 'react-native-elements';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { achievementsByClass } from 'therr-js-utilities/config';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildAchievementStyles } from '../../styles/achievements';
import BaseStatusBar from '../../components/BaseStatusBar';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';

const cardImages = {
    explorer: require('../../assets/explorer-card.png'),
    influencer: require('../../assets/influencer-card.png'),
};

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

const AchievementTile = ({ claimText, completedText, handleClaim, userAchievement, themeAchievements }) => {
    const achievement = achievementsByClass[userAchievement.achievementClass][userAchievement.achievementId];
    const progressPercent = `${userAchievement.progressCount * 100 / achievement.countToComplete}%`;
    const progressText = `${userAchievement.progressCount}/${achievement.countToComplete}`;

    return (
        <View style={themeAchievements.styles.achievementTile}>
            <View style={themeAchievements.styles.achievementTileContainer}>
                <View style={themeAchievements.styles.cardImageContainer}>
                    <Image
                        source={cardImages[userAchievement.achievementClass]}
                        style={themeAchievements.styles.cardImage}
                    />
                </View>
                <View style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingVertical: 6 }}>
                    <Text style={{ textTransform: 'capitalize', fontWeight: '600', fontSize: 18, paddingBottom: 4 }}>{userAchievement.achievementClass}</Text>
                    <Text style={{ flex: 1 }}>{achievement.description}</Text>
                    <View style={{ width: '100%', display: 'flex', flexDirection: 'row' }}>
                        <View style={{ position: 'relative', flex: 1 }}>
                            <View style={themeAchievements.styles.progressBarBackground}></View>
                            <View style={[themeAchievements.styles.progressBar, { width: progressPercent }]}></View>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', paddingLeft: 8 }}>
                            {userAchievement.completedAt ? '✓' : progressText}
                        </Text>
                    </View>
                </View>
            </View>
            {
                !!userAchievement.completedAt &&
                <>
                    {
                        userAchievement.unclaimedRewardPts > 0 ?
                            <View style={themeAchievements.styles.completedContainer}>
                                <Pressable onPress={handleClaim} style={themeAchievements.styles.claimButton}>
                                    <Text style={themeAchievements.styles.claimText}>{claimText}</Text>
                                </Pressable>
                            </View> :
                            <Text style={themeAchievements.styles.completeText}>{completedText}</Text>
                    }
                </>
            }
        </View>
    );
};

export class Achievements extends React.Component<IAchievementsProps, IAchievementsState> {
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
    }

    handleRefresh = () => {
        this.props.getMyAchievements().finally(() => {
            this.setState({
                isRefreshing: false,
            });
        });
    }

    handleClaim = (id: string, points: number) => {
        const { claimMyAchievement } = this.props;

        claimMyAchievement(id, points);
    }

    render() {
        const { navigation, user } = this.props;
        const { isRefreshing } = this.state;
        // const pageHeaderAchievements = this.translate('pages.achievements.pageHeader');
        const userAchievements = Object.values(user.achievements || {});

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colors.backgroundGray }]}>
                    <View style={[this.theme.styles.body, { backgroundColor: this.theme.colors.backgroundGray }]}>
                        {/* <View style={this.theme.styles.sectionContainer}>
                            <Text style={this.theme.styles.sectionTitle}>
                                {pageHeaderAchievements}
                            </Text>
                        </View> */}
                        <View style={this.theme.styles.sectionContainer}>
                            <FlatList
                                data={userAchievements}
                                keyExtractor={(item) => String(item.id)}
                                renderItem={({ item }) => <AchievementTile
                                    claimText={this.translate('pages.achievements.info.claimRewards')}
                                    completedText={this.translate('pages.achievements.info.completed')}
                                    handleClaim={() => this.handleClaim(item.id, item.unclaimedRewardPts)}
                                    themeAchievements={this.themeAchievements}
                                    userAchievement={item}
                                />}
                                refreshControl={<RefreshControl
                                    refreshing={isRefreshing}
                                    onRefresh={this.handleRefresh}
                                />}
                                ListEmptyComponent={() => (
                                    <View style={this.theme.styles.sectionContainer}>
                                        <Text style={this.theme.styles.sectionDescriptionCentered}>
                                            {this.translate(
                                                'pages.achievements.info.noAchievementsFound'
                                            )}
                                        </Text>
                                    </View>
                                )}
                                // stickyHeaderIndices={[0]}
                                // onContentSizeChange={() => connections.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
                            />
                        </View>
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
