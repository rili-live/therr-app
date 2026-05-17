import React from 'react';
import {
    Dimensions,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { TabBar, TabView } from 'react-native-tab-view';
import { HabitActions } from 'therr-react/redux/actions';
import { IHabitsState, IUserState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import spacingStyles from '../../styles/layouts/spacing';
import translator from '../../utilities/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import { RefreshControl } from 'react-native-gesture-handler';
import PactCard from './components/PactCard';
import Toast from 'react-native-toast-message';

const { width: viewportWidth } = Dimensions.get('window');

interface IMyPactsDispatchProps {
    getUserPacts: Function;
    getPendingInvites: Function;
    nudgePact: Function;
    acceptPact: Function;
    declinePact: Function;
}

interface IStoreProps extends IMyPactsDispatchProps {
    habits: IHabitsState;
    user: IUserState;
}

export interface IMyPactsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IMyPactsState {
    isLoading: boolean;
    nudgingPactId: string | null;
    tabIndex: number;
}

const TAB_SENT = 0;
const TAB_RECEIVED = 1;

const mapStateToProps = (state) => ({
    habits: state.habits,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserPacts: HabitActions.getUserPacts,
    getPendingInvites: HabitActions.getPendingInvites,
    nudgePact: HabitActions.nudgePact,
    acceptPact: HabitActions.acceptPact,
    declinePact: HabitActions.declinePact,
}, dispatch);

class MyPacts extends React.Component<IMyPactsProps, IMyPactsState> {
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private translate: Function;

    constructor(props: IMyPactsProps) {
        super(props);

        const activeTab = props.route?.params?.activeTab;
        this.state = {
            isLoading: false,
            nudgingPactId: null,
            tabIndex: activeTab === 'Received' ? TAB_RECEIVED : TAB_SENT,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.loadData();
    }

    loadData = () => {
        const { getUserPacts, getPendingInvites } = this.props;
        this.setState({ isLoading: true });
        Promise.all([
            getUserPacts('pending'),
            getPendingInvites(),
        ]).finally(() => {
            this.setState({ isLoading: false });
        });
    };

    handleNudge = (pactId: string) => {
        const { nudgePact } = this.props;
        this.setState({ nudgingPactId: pactId });
        nudgePact(pactId)
            .then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.myPacts.messages.nudgeSuccess'),
                });
            })
            .catch(() => {
                Toast.show({
                    type: 'errorToast',
                    text1: this.translate('pages.myPacts.messages.nudgeCooldown'),
                });
            })
            .finally(() => {
                this.setState({ nudgingPactId: null });
                this.loadData();
            });
    };

    handleAccept = (pactId: string) => {
        const { acceptPact } = this.props;
        acceptPact(pactId).then(() => this.loadData()).catch(() => {});
    };

    handleDecline = (pactId: string) => {
        const { declinePact } = this.props;
        declinePact(pactId).then(() => this.loadData()).catch(() => {});
    };

    handlePickNewPartner = (habitGoalId: string) => {
        const { navigation } = this.props;
        navigation.navigate('Invite', { habitGoalId });
    };

    handleCreateNewPact = (habitGoalId: string) => {
        const { navigation } = this.props;
        navigation.navigate('Invite', { habitGoalId, createNewPact: true });
    };

    renderSentTab = () => {
        const { habits, user } = this.props;
        const { isLoading, nudgingPactId } = this.state;
        const currentUserId = user.details?.id;

        const sentPacts = (habits.pacts || []).filter(
            (p) => p.creatorUserId === currentUserId && p.status === 'pending',
        );

        if (!isLoading && sentPacts.length === 0) {
            return (
                <View style={[spacingStyles.padMd, spacingStyles.flexCenter]}>
                    <Text style={this.theme.styles.sectionTitleSmall}>
                        {this.translate('pages.myPacts.messages.noSentPacts')}
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView
                contentContainerStyle={[spacingStyles.padMd, { paddingBottom: buttonMenuHeight + 16 }]}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={this.loadData} />}
            >
                {sentPacts.map((pact) => (
                    <PactCard
                        key={pact.id}
                        pact={pact}
                        currentUserId={currentUserId}
                        isSentTab
                        isNudging={nudgingPactId === pact.id}
                        onNudge={this.handleNudge}
                        onPickNewPartner={this.handlePickNewPartner}
                        onCreateNewPact={this.handleCreateNewPact}
                        translate={this.translate}
                        theme={this.theme}
                    />
                ))}
            </ScrollView>
        );
    };

    renderReceivedTab = () => {
        const { habits, user } = this.props;
        const { isLoading } = this.state;
        const currentUserId = user.details?.id;

        const receivedPacts = habits.pendingInvites || [];

        if (!isLoading && receivedPacts.length === 0) {
            return (
                <View style={[spacingStyles.padMd, spacingStyles.flexCenter]}>
                    <Text style={this.theme.styles.sectionTitleSmall}>
                        {this.translate('pages.myPacts.messages.noReceivedPacts')}
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView
                contentContainerStyle={[spacingStyles.padMd, { paddingBottom: buttonMenuHeight + 16 }]}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={this.loadData} />}
            >
                {receivedPacts.map((pact) => (
                    <PactCard
                        key={pact.id}
                        pact={pact}
                        currentUserId={currentUserId}
                        isSentTab={false}
                        onNudge={this.handleNudge}
                        onPickNewPartner={this.handlePickNewPartner}
                        onCreateNewPact={this.handleCreateNewPact}
                        onAccept={this.handleAccept}
                        onDecline={this.handleDecline}
                        translate={this.translate}
                        theme={this.theme}
                    />
                ))}
            </ScrollView>
        );
    };

    render() {
        const { navigation, user } = this.props;
        const { tabIndex } = this.state;

        const routes = [
            { key: 'sent', title: this.translate('pages.myPacts.tabs.sent') },
            { key: 'received', title: this.translate('pages.myPacts.tabs.received') },
        ];

        return (
            <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                <BaseStatusBar themeName={user.settings?.mobileThemeName} />
                <TabView
                    navigationState={{ index: tabIndex, routes }}
                    renderScene={({ route }) => {
                        if (route.key === 'sent') return this.renderSentTab();
                        if (route.key === 'received') return this.renderReceivedTab();
                        return null;
                    }}
                    onIndexChange={(index) => this.setState({ tabIndex: index })}
                    initialLayout={{ width: viewportWidth }}
                    renderTabBar={(tabBarProps) => (
                        <TabBar
                            {...tabBarProps}
                            style={{ backgroundColor: this.theme.colors.primary }}
                            indicatorStyle={{ backgroundColor: '#7B5EA7' }}
                            labelStyle={{ color: this.theme.colors.textWhite, fontWeight: '600' }}
                        />
                    )}
                />
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={() => {}}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </SafeAreaView>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MyPacts);
