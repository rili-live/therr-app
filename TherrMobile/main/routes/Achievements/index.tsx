import React from 'react';
import { Pressable, SafeAreaView, SectionList, View, Text } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { showToast } from '../../utilities/toasts';
import { RefreshControl } from 'react-native-gesture-handler';
import { achievementsByClass } from 'therr-js-utilities/config';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildAchievementStyles } from '../../styles/achievements';
import BaseStatusBar from '../../components/BaseStatusBar';
import AchievementTile from './AchievementTile';

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
    collapsedSections: { [key: string]: boolean };
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
            collapsedSections: {},
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
        this.props.getMyAchievements().finally(() => {
            this.setState({
                isRefreshing: false,
            });
        });
    };

    handleClaim = (userAchievement: any) => {
        const { claimMyAchievement, getMyAchievements } = this.props;

        claimMyAchievement(userAchievement.id, userAchievement.unclaimedRewardPts).then(() => {
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
            getMyAchievements();
            this.onPressAchievement(claimedAchievement, true);
        }).catch(() => {
            showToast.error({
                text1: this.translate('alertTitles.backendErrorMessage'),
                text2: this.translate('alertMessages.backendErrorMessage'),
            });
        });
    };

    onPressAchievement = (userAchievement: any, isClaiming: boolean = false) => {
        const { navigation } = this.props;

        navigation.navigate('AchievementClaim', {
            userAchievement,
            isClaiming,
        });
    };

    toggleSection = (sectionTitle: string) => {
        this.setState((prevState) => ({
            collapsedSections: {
                ...prevState.collapsedSections,
                [sectionTitle]: !prevState.collapsedSections[sectionTitle],
            },
        }));
    };

    /** Groups achievements into sections for SectionList */
    getAchievementSections = () => {
        const { user } = this.props;

        const achArray = Object.values(user.achievements || {});
        const unclaimed: any[] = [];
        const incomplete: any[] = [];
        const claimedByClass: { [key: string]: any[] } = {};

        achArray.forEach((ach: any) => {
            if (!ach.completedAt) {
                incomplete.push(ach);
            } else if (ach.unclaimedRewardPts > 0) {
                unclaimed.push(ach);
            } else {
                const className = ach.achievementClass || 'other';
                if (!claimedByClass[className]) {
                    claimedByClass[className] = [];
                }
                claimedByClass[className].push(ach);
            }
        });

        const sections: any[] = [];

        if (unclaimed.length > 0) {
            sections.push({
                title: this.translate('pages.achievements.sections.unclaimed'),
                data: unclaimed,
                isCollapsible: false,
            });
        }

        if (incomplete.length > 0) {
            sections.push({
                title: this.translate('pages.achievements.sections.inProgress'),
                data: incomplete,
                isCollapsible: false,
            });
        }

        // Group completed by achievementClass
        const classNames = Object.keys(achievementsByClass);
        classNames.forEach((className) => {
            if (claimedByClass[className]?.length > 0) {
                const displayName = className.replace(/([A-Z])/g, ' $1').trim();
                const sectionTitle = `${displayName.charAt(0).toUpperCase()}${displayName.slice(1)}`;
                sections.push({
                    title: sectionTitle,
                    data: claimedByClass[className],
                    isCollapsible: true,
                    isCompleted: true,
                });
            }
        });

        return sections;
    };

    renderSectionHeader = ({ section }) => {
        const { collapsedSections } = this.state;
        const isCollapsed = collapsedSections[section.title];

        if (!section.isCollapsible) {
            return (
                <View style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: this.theme.colors.backgroundGray,
                }}>
                    <Text style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: this.theme.colors.textWhite,
                    }}>
                        {section.title}
                    </Text>
                </View>
            );
        }

        return (
            <Pressable
                onPress={() => this.toggleSection(section.title)}
                style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: this.theme.colors.backgroundGray,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: this.theme.colors.textWhite,
                }}>
                    {section.title} ({section.totalCount ?? section.data.length})
                </Text>
                <FontAwesome5Icon
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={14}
                    color={this.theme.colors.textWhite}
                />
            </Pressable>
        );
    };

    render() {
        const { navigation, user } = this.props;
        const { collapsedSections, isRefreshing } = this.state;
        const sections = this.getAchievementSections();

        // Apply collapsed state: replace data with empty array for collapsed sections
        // Preserve original count so header still shows it when collapsed
        const displaySections = sections.map((section) => ({
            ...section,
            totalCount: section.data.length,
            data: (section.isCollapsible && collapsedSections[section.title]) ? [] : section.data,
        }));

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colors.backgroundGray }]}>
                    <View style={[this.theme.styles.body, { backgroundColor: this.theme.colors.backgroundGray }]}>
                        <SectionList
                            sections={displaySections}
                            keyExtractor={(item: any) => String(item.id)}
                            renderItem={({ item }) => <AchievementTile
                                claimText={this.translate('pages.achievements.info.claimRewards')}
                                completedText={this.translate('pages.achievements.info.completed')}
                                handleClaim={() => this.handleClaim(item)}
                                onPressAchievement={() => this.onPressAchievement(item)}
                                themeAchievements={this.themeAchievements}
                                userAchievement={item}
                            />}
                            renderSectionHeader={this.renderSectionHeader}
                            refreshControl={<RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={this.handleRefresh}
                            />}
                            ListEmptyComponent={
                                <View style={this.theme.styles.sectionContainer}>
                                    <Text style={this.theme.styles.sectionDescriptionCentered}>
                                        {this.translate(
                                            'pages.achievements.info.noAchievementsFound'
                                        )}
                                    </Text>
                                </View>
                            }
                            stickySectionHeadersEnabled={false}
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
