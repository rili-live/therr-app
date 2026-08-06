import React from 'react';
import {
    ScrollView,
    View,
    Text,
    Pressable,
    TextInput,
    ActivityIndicator,
    Share,
} from 'react-native';
import { SafeAreaView, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { HabitActions } from 'therr-react/redux/actions';
import permissions from '../../utilities/permissionsOrchestrator';
import UsersActions from '../../redux/actions/UsersActions';
import { IUserState, IHabitsState, IHabitGoal } from 'therr-react/types';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import { Button } from '../../components/BaseButton';
import { HABITS_PRESTAGED_TEMPLATE_ID } from '../../components/Habits/PactPreviewOverlay';
import { buildInviteUrl } from '../../utilities/shareUrls';

const MAX_PARTNERS = 5;
const DEFAULT_PACT_DURATION_DAYS = 30;

type Step = 1 | 2 | 3;

interface IConnectionDetails {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
}

interface IDispatchProps {
    getTemplates: Function;
    createGoal: Function;
    bulkInvitePact: Function;
    searchUsers: Function;
}

interface IStoreProps extends IDispatchProps {
    user: IUserState;
    habits: IHabitsState;
    userConnections: any;
}

interface ICreatePactInviteProps extends IStoreProps {
    navigation: any;
}

interface ICreatePactInviteState {
    step: Step;
    selectedTemplateId: string | null;
    customHabitName: string;
    selectedPartnerIds: string[];
    selectedPartnerDetailsById: { [id: string]: IConnectionDetails };
    searchQuery: string;
    isSearching: boolean;
    isSending: boolean;
    isLoadingTemplates: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getTemplates: HabitActions.getTemplates,
    createGoal: HabitActions.createGoal,
    bulkInvitePact: HabitActions.bulkInvitePact,
    searchUsers: UsersActions.search,
}, dispatch);

const resolvePartnerDetails = (
    connection: any,
    currentUserId: string,
): IConnectionDetails => {
    if (connection?.users) {
        return connection.users.find((u: any) => u.id !== currentUserId) || connection.users[0] || {};
    }
    return connection;
};

const partnerDisplayName = (
    details: IConnectionDetails,
    fallback: string,
): string => {
    if (details.firstName || details.lastName) {
        return `${details.firstName || ''} ${details.lastName || ''}`.trim();
    }
    return details.userName || fallback;
};

class CreatePactInvite extends React.Component<ICreatePactInviteProps, ICreatePactInviteState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeHabits = buildHabitStyles();
    private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: ICreatePactInviteProps) {
        super(props);

        this.state = {
            step: 1,
            selectedTemplateId: null,
            customHabitName: '',
            selectedPartnerIds: [],
            selectedPartnerDetailsById: {},
            searchQuery: '',
            isSearching: false,
            isSending: false,
            isLoadingTemplates: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key, params) => translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.pacts.wizard.step1Title'),
        });

        if (!this.props.habits.templates?.length) {
            this.setState({ isLoadingTemplates: true });
            Promise.resolve(this.props.getTemplates())
                .catch(() => {})
                .finally(() => this.setState({ isLoadingTemplates: false }));
        }
    }

    componentWillUnmount() {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
    }

    setStep = (step: Step) => {
        this.props.navigation.setOptions({
            title: this.translate(`pages.pacts.wizard.step${step}Title`),
        });
        this.setState({ step });
        if (step === 2) {
            // Fetch a default browse list (no query) so the user has people to
            // pick from immediately, including non-friends.
            this.runUserSearch('');
        }
    };

    selectTemplate = (templateId: string) => {
        this.setState({ selectedTemplateId: templateId, customHabitName: '' });
    };

    setCustomName = (text: string) => {
        this.setState({ customHabitName: text, selectedTemplateId: null });
    };

    runUserSearch = (query: string) => {
        this.setState({ isSearching: true });
        Promise.resolve(this.props.searchUsers({
            query,
            limit: 20,
            offset: 0,
            withMedia: true,
        }))
            .catch(() => {})
            .finally(() => this.setState({ isSearching: false }));
    };

    onChangeSearchQuery = (query: string) => {
        this.setState({ searchQuery: query });
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
            this.runUserSearch(query.trim());
        }, 300);
    };

    togglePartner = (partnerId: string, partnerDetails?: IConnectionDetails) => {
        const { selectedPartnerIds, selectedPartnerDetailsById } = this.state;
        if (selectedPartnerIds.includes(partnerId)) {
            const nextDetails = { ...selectedPartnerDetailsById };
            delete nextDetails[partnerId];
            this.setState({
                selectedPartnerIds: selectedPartnerIds.filter((id) => id !== partnerId),
                selectedPartnerDetailsById: nextDetails,
            });
            return;
        }
        if (selectedPartnerIds.length >= MAX_PARTNERS) {
            Toast.show({
                type: 'info',
                text1: this.translate('pages.pacts.wizard.maxPartnersReached'),
            });
            return;
        }
        this.setState({
            selectedPartnerIds: [...selectedPartnerIds, partnerId],
            selectedPartnerDetailsById: partnerDetails
                ? { ...selectedPartnerDetailsById, [partnerId]: partnerDetails }
                : selectedPartnerDetailsById,
        });
    };

    canAdvanceFromStep1 = (): boolean => Boolean(
        this.state.selectedTemplateId || this.state.customHabitName.trim().length > 0,
    );

    canAdvanceFromStep2 = (): boolean => this.state.selectedPartnerIds.length > 0;

    handleNext = () => {
        const { step } = this.state;
        if (step === 1) {
            if (!this.canAdvanceFromStep1()) {
                Toast.show({ type: 'info', text1: this.translate('pages.pacts.wizard.pickTemplateFirst') });
                return;
            }
            if (this.state.selectedTemplateId) {
                AsyncStorage.setItem(HABITS_PRESTAGED_TEMPLATE_ID, this.state.selectedTemplateId).catch(() => {});
            }
            this.setStep(2);
            return;
        }
        if (step === 2) {
            if (!this.canAdvanceFromStep2()) {
                Toast.show({ type: 'info', text1: this.translate('pages.pacts.wizard.pickPartnerFirst') });
                return;
            }
            this.setStep(3);
        }
    };

    handleBack = () => {
        const { step } = this.state;
        if (step === 1) {
            this.props.navigation.goBack();
            return;
        }
        this.setStep((step - 1) as Step);
    };

    onShareLink = () => {
        const { user } = this.props;
        const locale = user.settings?.locale || 'en-us';
        const shareUrl = buildInviteUrl(locale, user.details?.userName || '');
        Share.share({
            message: this.translate('forms.createConnection.shareLink.message', {
                inviteCode: user.details?.userName,
                shareUrl,
            }),
            url: shareUrl,
            title: this.translate('forms.createConnection.shareLink.title'),
        }).catch(() => {});
    };

    handleSend = async () => {
        const { habits, createGoal, bulkInvitePact, navigation } = this.props;
        const { selectedTemplateId, customHabitName, selectedPartnerIds } = this.state;

        this.setState({ isSending: true });

        try {
            let habitGoalId: string | null = null;

            if (selectedTemplateId) {
                // Clone the template into a user-owned goal so per-user stats
                // (streaks, completion rate) don't share rows across users.
                const template = habits.templates?.find((t) => t.id === selectedTemplateId);
                if (template) {
                    const userGoal = await createGoal({
                        name: template.name,
                        description: template.description,
                        category: template.category,
                        emoji: template.emoji,
                        frequencyType: template.frequencyType,
                        frequencyCount: template.frequencyCount,
                        targetDaysOfWeek: template.targetDaysOfWeek,
                    });
                    habitGoalId = userGoal?.id || selectedTemplateId;
                } else {
                    habitGoalId = selectedTemplateId;
                }
            } else if (customHabitName.trim()) {
                const newGoal = await createGoal({
                    name: customHabitName.trim(),
                    frequencyType: 'daily',
                    frequencyCount: 1,
                });
                habitGoalId = newGoal?.id;
            }

            if (!habitGoalId) throw new Error('missing habitGoalId');

            // Single bulk-invite request: one pact + N pending member invites.
            // Replaces the prior Promise.all loop over createPact, which had
            // partial-failure exposure (some pacts created, others not).
            await bulkInvitePact({
                habitGoalId,
                partnerUserIds: selectedPartnerIds,
                pactType: 'accountability',
                durationDays: DEFAULT_PACT_DURATION_DAYS,
            });

            const successKey = selectedPartnerIds.length > 1
                ? 'pages.pacts.wizard.sendMultipleSuccess'
                : 'pages.pacts.wizard.sendSuccess';
            Toast.show({
                type: 'success',
                text1: this.translate(successKey, { count: selectedPartnerIds.length }),
            });

            permissions.requestIfAppropriate('notifications', { trigger: 'pactCreate' });

            navigation.navigate('HabitsDashboard');
        } catch {
            Toast.show({
                type: 'error',
                text1: this.translate('pages.pacts.wizard.sendingError'),
            });
        } finally {
            this.setState({ isSending: false });
        }
    };

    renderStep1 = () => {
        const { habits } = this.props;
        const { selectedTemplateId, customHabitName, isLoadingTemplates } = this.state;
        const templates = habits.templates || [];

        return (
            <View>
                <Text style={[this.themeHabits.styles.dashboardSubtitle, { paddingHorizontal: 20 }]}>
                    {this.translate('pages.pacts.wizard.step1Subtitle')}
                </Text>

                {isLoadingTemplates && (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator />
                    </View>
                )}

                {!isLoadingTemplates && templates.length === 0 && (
                    <Text style={[this.themeHabits.styles.streakMilestoneText, { padding: 20 }]}>
                        {this.translate('pages.pacts.wizard.templatesEmpty')}
                    </Text>
                )}

                {templates.map((t: IHabitGoal) => {
                    const isSelected = selectedTemplateId === t.id;
                    return (
                        <Pressable
                            key={t.id}
                            onPress={() => this.selectTemplate(t.id)}
                            style={[
                                this.themeHabits.styles.habitCardContainer,
                                isSelected && { borderWidth: 2, borderColor: this.theme.colors.primary3 },
                            ]}
                        >
                            <View style={this.themeHabits.styles.habitCardHeader}>
                                <Text style={this.themeHabits.styles.habitCardEmoji}>
                                    {t.emoji || this.translate('pages.pacts.wizard.habitDefaultEmoji')}
                                </Text>
                                <View style={this.themeHabits.styles.habitCardTitleContainer}>
                                    <Text style={this.themeHabits.styles.habitCardTitle}>{t.name}</Text>
                                    {t.description && (
                                        <Text style={this.themeHabits.styles.habitCardSubtitle}>{t.description}</Text>
                                    )}
                                </View>
                                {isSelected && <Text style={{ fontSize: 20 }}>{'✅'}</Text>}
                            </View>
                        </Pressable>
                    );
                })}

                <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
                    <Text style={[this.themeHabits.styles.habitCardSubtitle, { fontWeight: '600' }]}>
                        {this.translate('pages.pacts.wizard.customHabitLabel')}
                    </Text>
                    <TextInput
                        value={customHabitName}
                        onChangeText={this.setCustomName}
                        placeholder={this.translate('pages.pacts.wizard.customHabitNamePlaceholder')}
                        style={{
                            borderWidth: 1,
                            borderColor: this.theme.colorVariations.textGrayFade || '#ccc',
                            borderRadius: 8,
                            padding: 12,
                            marginTop: 8,
                            color: this.theme.colors.accentTextBlack,
                        }}
                        placeholderTextColor={this.theme.colors.textGray}
                    />
                </View>
            </View>
        );
    };

    renderPartnerRow = (partner: IConnectionDetails, isFriend: boolean) => {
        const partnerId = partner.id;
        if (!partnerId) return null;
        const isSelected = this.state.selectedPartnerIds.includes(partnerId);
        return (
            <Pressable
                key={partnerId}
                onPress={() => this.togglePartner(partnerId, partner)}
                style={[
                    this.themeHabits.styles.habitCardContainer,
                    { flexDirection: 'row', alignItems: 'center' },
                    isSelected && { borderWidth: 2, borderColor: this.theme.colors.primary3 },
                ]}
            >
                <View style={this.themeHabits.styles.pactPartnerAvatar}>
                    <Text>{(partner.firstName?.[0] || partner.userName?.[0] || '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={this.themeHabits.styles.pactPartnerName}>
                        {partnerDisplayName(partner, this.translate('pages.pacts.partnerFallback'))}
                    </Text>
                    {isFriend && (
                        <Text style={this.themeHabits.styles.habitCardSubtitle}>
                            {this.translate('pages.pacts.wizard.friendBadge')}
                        </Text>
                    )}
                </View>
                {isSelected && <Text style={{ fontSize: 20 }}>{'✅'}</Text>}
            </Pressable>
        );
    };

    renderStep2 = () => {
        const { user, userConnections } = this.props;
        const { selectedPartnerIds, searchQuery, isSearching } = this.state;
        const currentUserId = user.details?.id || '';
        const connections = (userConnections?.activeConnections || userConnections?.connections || []) as any[];

        const friendsById: { [id: string]: IConnectionDetails } = {};
        const friends: IConnectionDetails[] = [];
        connections.forEach((c: any) => {
            const partner = resolvePartnerDetails(c, currentUserId);
            if (partner?.id && partner.id !== currentUserId && !friendsById[partner.id]) {
                friendsById[partner.id] = partner;
                friends.push(partner);
            }
        });

        const usersMap = ((this.props.user as any).users || {}) as { [id: string]: IConnectionDetails };
        const searchResults: IConnectionDetails[] = Object.values(usersMap)
            .filter((u) => u?.id && u.id !== currentUserId && !friendsById[u.id]);

        const q = searchQuery.trim().toLowerCase();
        const visibleFriends = q
            ? friends.filter((f) => {
                const haystack = `${f.firstName || ''} ${f.lastName || ''} ${f.userName || ''}`.toLowerCase();
                return haystack.includes(q);
            })
            : friends;

        const hasAnyResults = visibleFriends.length > 0 || searchResults.length > 0;

        return (
            <View>
                <Text style={[this.themeHabits.styles.dashboardSubtitle, { paddingHorizontal: 20 }]}>
                    {this.translate('pages.pacts.wizard.step2Subtitle')}
                </Text>
                <Text style={[this.themeHabits.styles.streakMilestoneText, { paddingHorizontal: 20, marginTop: 8 }]}>
                    {this.translate('pages.pacts.wizard.multiSelectCounter', { count: selectedPartnerIds.length })}
                </Text>

                <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
                    <TextInput
                        value={searchQuery}
                        onChangeText={this.onChangeSearchQuery}
                        placeholder={this.translate('pages.pacts.wizard.searchPeoplePlaceholder')}
                        style={{
                            borderWidth: 1,
                            borderColor: this.theme.colorVariations.textGrayFade || '#ccc',
                            borderRadius: 8,
                            padding: 12,
                            color: this.theme.colors.accentTextBlack,
                        }}
                        placeholderTextColor={this.theme.colors.textGray}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                </View>

                {visibleFriends.length > 0 && (
                    <>
                        <Text style={[this.themeHabits.styles.habitCardSubtitle, { paddingHorizontal: 20, marginTop: 16, fontWeight: '600' }]}>
                            {this.translate('pages.pacts.wizard.friendsSectionTitle')}
                        </Text>
                        {visibleFriends.map((p) => this.renderPartnerRow(p, true))}
                    </>
                )}

                {(searchResults.length > 0 || isSearching) && (
                    <>
                        <Text style={[this.themeHabits.styles.habitCardSubtitle, { paddingHorizontal: 20, marginTop: 16, fontWeight: '600' }]}>
                            {q
                                ? this.translate('pages.pacts.wizard.searchResultsTitle')
                                : this.translate('pages.pacts.wizard.suggestedTitle')}
                        </Text>
                        {isSearching && (
                            <View style={{ padding: 12, alignItems: 'center' }}>
                                <ActivityIndicator />
                            </View>
                        )}
                        {searchResults.map((p) => this.renderPartnerRow(p, false))}
                    </>
                )}

                {!isSearching && !hasAnyResults && (
                    <View style={[this.themeHabits.styles.emptyStateContainer, { paddingTop: 24 }]}>
                        <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🤝'}</Text>
                        <Text style={this.themeHabits.styles.emptyStateTitle}>
                            {q
                                ? this.translate('pages.pacts.wizard.noPeopleFound')
                                : this.translate('pages.pacts.onboarding.title')}
                        </Text>
                        <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                            {this.translate('pages.pacts.wizard.searchHelp')}
                        </Text>
                    </View>
                )}

                <Pressable
                    onPress={this.onShareLink}
                    style={{ paddingHorizontal: 20, marginTop: 16, paddingVertical: 12 }}
                >
                    <Text style={[this.themeButtons.styles.btnTitleBlack, { textAlign: 'center' }]}>
                        {this.translate('forms.createConnection.shareLink.title')}
                    </Text>
                </Pressable>
            </View>
        );
    };

    renderStep3 = () => {
        const { habits } = this.props;
        const { selectedTemplateId, customHabitName, selectedPartnerIds } = this.state;
        const template = selectedTemplateId
            ? habits.templates?.find((t) => t.id === selectedTemplateId)
            : undefined;
        const habitName = template?.name || customHabitName.trim();
        const habitEmoji = template?.emoji || this.translate('pages.pacts.wizard.habitDefaultEmoji');
        const partnerCount = selectedPartnerIds.length;

        return (
            <View>
                <Text style={[this.themeHabits.styles.dashboardSubtitle, { paddingHorizontal: 20 }]}>
                    {this.translate('pages.pacts.wizard.step3Subtitle')}
                </Text>
                <View style={this.themeHabits.styles.habitCardContainer}>
                    <View style={this.themeHabits.styles.habitCardHeader}>
                        <Text style={this.themeHabits.styles.habitCardEmoji}>{habitEmoji}</Text>
                        <View style={this.themeHabits.styles.habitCardTitleContainer}>
                            <Text style={this.themeHabits.styles.habitCardTitle}>{habitName}</Text>
                            <Text style={this.themeHabits.styles.habitCardSubtitle}>
                                {this.translate('pages.pacts.wizard.multiSelectCounter', { count: partnerCount })}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    renderStepContent = () => {
        switch (this.state.step) {
            case 1: return this.renderStep1();
            case 2: return this.renderStep2();
            case 3:
            default: return this.renderStep3();
        }
    };

    renderFooter = () => {
        const { step, isSending, selectedPartnerIds } = this.state;
        const isFinalStep = step === 3;
        const sendKey = selectedPartnerIds.length > 1
            ? 'pages.pacts.wizard.sendMultiple'
            : 'pages.pacts.wizard.send';
        const primaryTitle = isFinalStep
            ? this.translate(sendKey, { count: selectedPartnerIds.length })
            : this.translate('pages.pacts.wizard.next');

        return (
            <SafeAreaInsetsContext.Consumer>
                {(insets) => {
                    const bottomInset = insets?.bottom ?? bottomSafeAreaInset;
                    return (
                        <View
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                flexDirection: 'row',
                                paddingHorizontal: 16,
                                paddingTop: 16,
                                paddingBottom: 16 + bottomInset,
                                backgroundColor: this.theme.colors.surface,
                                shadowColor: this.theme.colors.textBlack,
                                shadowOffset: { width: 0, height: -2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                elevation: 4,
                            }}
                        >
                            <Pressable
                                onPress={this.handleBack}
                                disabled={isSending}
                                style={{ paddingVertical: 12, paddingHorizontal: 16 }}
                            >
                                <Text style={this.themeButtons.styles.btnTitleBlack}>
                                    {step === 1
                                        ? this.translate('pages.pacts.wizard.cancel')
                                        : this.translate('pages.pacts.wizard.back')}
                                </Text>
                            </Pressable>
                            <View style={{ flex: 1 }}>
                                <Button
                                    buttonStyle={[this.themeButtons.styles.btnLargeWithText, { width: '100%' }]}
                                    titleStyle={this.themeButtons.styles.btnLargeTitle}
                                    title={primaryTitle}
                                    onPress={isFinalStep ? this.handleSend : this.handleNext}
                                    disabled={isSending}
                                />
                            </View>
                        </View>
                    );
                }}
            </SafeAreaInsetsContext.Consumer>
        );
    };

    render() {
        const { user } = this.props;

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView
                    edges={[]}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <SafeAreaInsetsContext.Consumer>
                        {(insets) => {
                            const bottomInset = insets?.bottom ?? bottomSafeAreaInset;
                            return (
                                <ScrollView contentContainerStyle={{ paddingBottom: 120 + bottomInset }}>
                                    {this.renderStepContent()}
                                </ScrollView>
                            );
                        }}
                    </SafeAreaInsetsContext.Consumer>
                    {this.renderFooter()}
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CreatePactInvite);
