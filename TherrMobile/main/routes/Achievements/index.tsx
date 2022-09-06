import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
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
import { FlatList } from 'react-native-gesture-handler';

const cardImages = {
    explorer: require('../../assets/explorer-card.png'),
    influencer: require('../../assets/influencer-card.png'),
};

interface IAchievementsDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends IAchievementsDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IAchievementsProps extends IStoreProps {
    navigation: any;
}

interface IAchievementsState {}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

const AchievementTile = ({ userAchievement, themeAchievements }) => {
    const achievement = achievementsByClass[userAchievement.achievementClass][userAchievement.achievementId];
    const progressPercent = `${userAchievement.progressCount * 100 / achievement.countToComplete}%`;

    return (
        <View style={themeAchievements.styles.achievementTile}>
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
                    <Text style={{ fontSize: 14, fontWeight: '600', paddingLeft: 8 }}>{`${userAchievement.progressCount}/${achievement.countToComplete}`}</Text>
                </View>
            </View>
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

        this.state = {};

        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeAchievements = buildAchievementStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.achievements.headerTitle'),
        });
    }

    handleRefresh = () => {
        console.log('refresh');
    }

    render() {
        const { navigation, user } = this.props;
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
                                renderItem={({ item }) => <AchievementTile themeAchievements={this.themeAchievements} userAchievement={item} />}
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
