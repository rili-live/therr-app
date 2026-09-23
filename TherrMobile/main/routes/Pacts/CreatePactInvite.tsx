import React from 'react';
import {
    View,
    Text,
    Pressable,
    TextInput,
    ActivityIndicator,
    Share,
    LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { HabitActions } from 'therr-react/redux/actions';
import {
    FeatureFlags,
    HabitGoalTypes,
    parseSavingsAmount,
    SavingsTargetScope,
    SavingsTargetScopes,
} from 'therr-js-utilities/constants';
import getConfig from '../../utilities/getConfig';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { streakFreezeRuleParams } from '../../utilities/streakFreezes';
import CadencePicker from '../../components/Habits/CadencePicker';
import {
    cacheKey as cadenceCacheKey,
    fromGoal as cadenceFromGoal,
    isComplete as isCadenceComplete,
    toGoalFields as cadenceToGoalFields,
    CadenceChoice,
    DAILY_CADENCE,
} from './cadenceOptions';

/** Sunday-first, matching `targetDaysOfWeek` and the `daysOfWeekShort` dictionary. */
const CADENCE_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
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
import SavingsAmountInput, { ERROR_KEY_BY_REASON } from '../../components/Habits/SavingsAmountInput';
import { buildInviteUrl } from '../../utilities/shareUrls';
import {
    WizardStep as Step,
    IWizardContext,
    canAdvanceFromPartnerStep,
    getBackTarget,
    getFinalAction,
    getNextStep,
    isSoloReview,
} from './wizardSteps';
import { getSoloUnlockProgress } from '../../utilities/soloHabitUnlock';
import { readApiError } from '../../utilities/apiErrorMessage';
import { getHabitCapPaywallParams, isHabitCapPaywallAvailable } from '../../utilities/habitCapPaywall';
import getDeviceSavingsCurrencyCode from '../../utilities/savingsCurrency';

const MAX_PARTNERS = 5;
const DEFAULT_PACT_DURATION_DAYS = 30;
// Used to keep a focused input clear of the footer until the footer reports its
// real height (one layout pass), so the very first focus is not left underneath it.
const FOOTER_HEIGHT_FALLBACK = 96;

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
    startUserHabit: Function;
    getUserHabitEligibility: Function;
    searchUsers: Function;
}

interface IStoreProps extends IDispatchProps {
    user: IUserState;
    habits: IHabitsState;
    userConnections: any;
}

interface ICreatePactInviteProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface ICreatePactInviteState {
    step: Step;
    selectedTemplateId: string | null;
    customHabitName: string;
    /**
     * How often the habit asks for a check-in. Defaults to daily, which is what every habit
     * created before this picker existed resolves to.
     */
    cadence: CadenceChoice;
    /**
     * Marks a *custom* habit as a savings goal. A template carries its own `goalType`,
     * so this is only consulted on the custom-name path — see `getIsSavingsSelection`.
     */
    isSavingsHabit: boolean;
    /** Raw text, so a half-typed "12." survives a keystroke. See SavingsAmountInput. */
    savingsTargetText: string;
    /** The parsed target, or null for an open-ended savings habit. */
    savingsTargetAmount: number | null;
    savingsTargetScope: SavingsTargetScope;
    selectedPartnerIds: string[];
    selectedPartnerDetailsById: { [id: string]: IConnectionDetails };
    searchQuery: string;
    isSearching: boolean;
    isSending: boolean;
    isLoadingTemplates: boolean;
    isStartingSolo: boolean;
    footerHeight: number;
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
    startUserHabit: HabitActions.startUserHabit,
    getUserHabitEligibility: HabitActions.getUserHabitEligibility,
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

/**
 * The wizard's action bar is bottom-anchored, so under edge-to-edge the Android
 * keyboard covers it (and, on step 1, the custom-habit input sitting just above
 * it). `KeyboardStickyView` translates the bar up with the keyboard instead.
 * Once the bar is riding on top of the keyboard the gesture-bar inset no longer
 * applies to it, so that padding is dropped while the keyboard is open —
 * otherwise a band of empty surface sits between the buttons and the keys.
 */
const WizardFooter = ({
    bottomInset,
    backgroundColor,
    shadowColor,
    onLayout,
    children,
}: {
    bottomInset: number;
    backgroundColor: string;
    shadowColor: string;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) => {
    const isKeyboardVisible = useKeyboardState((state) => state.isVisible);

    return (
        <KeyboardStickyView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <View
                onLayout={onLayout}
                style={{
                    flexDirection: 'row',
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 16 + (isKeyboardVisible ? 0 : bottomInset),
                    backgroundColor,
                    shadowColor,
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 4,
                }}
            >
                {children}
            </View>
        </KeyboardStickyView>
    );
};

export class CreatePactInvite extends React.Component<ICreatePactInviteProps, ICreatePactInviteState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeHabits = buildHabitStyles();
    private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    // The goal created for the current step-1 selection, so a retry after a
    // failed invite/start reuses it instead of creating a duplicate.
    private resolvedGoal: { selectionKey: string; habitGoalId: string } | null = null;

    constructor(props: ICreatePactInviteProps) {
        super(props);

        this.state = {
            step: 1,
            selectedTemplateId: null,
            cadence: DAILY_CADENCE,
            customHabitName: '',
            isSavingsHabit: false,
            savingsTargetText: '',
            savingsTargetAmount: null,
            savingsTargetScope: SavingsTargetScopes.PER_MEMBER,
            selectedPartnerIds: [],
            selectedPartnerDetailsById: {},
            searchQuery: '',
            isSearching: false,
            isSending: false,
            isLoadingTemplates: false,
            isStartingSolo: false,
            footerHeight: FOOTER_HEIGHT_FALLBACK,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key, params) => translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.getStepTitle(1),
        });

        if (!this.props.habits.templates?.length) {
            this.setState({ isLoadingTemplates: true });
            Promise.resolve(this.props.getTemplates())
                .catch(() => {})
                .finally(() => this.setState({ isLoadingTemplates: false }));
        }

        // Decides whether step 2 may be skipped and what the locked state says.
        // A failure leaves the wizard locked, which is the safe direction: the
        // server would refuse the solo call anyway, and the user can still
        // finish the flow the normal way by choosing a partner.
        this.props.getUserHabitEligibility().catch(() => {});
    }

    componentWillUnmount() {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
    }

    /**
     * Entered from a "track a habit on my own" affordance rather than from the
     * pact CTA, which means step 2 (choose partners) is skipped outright rather
     * than merely being skippable. The wizard is otherwise identical — same
     * habit picker, same review, same goal creation.
     */
    isSoloMode = (): boolean => this.props.route?.params?.mode === 'solo';

    getSoloProgress = () => getSoloUnlockProgress(
        this.props.habits.userHabitEligibility,
        getConfig().featureFlags?.[FeatureFlags.ENABLE_HABITS_SOLO] === true,
    );

    getWizardContext = (): IWizardContext => ({
        isSoloMode: this.isSoloMode(),
        canCreateSolo: this.getSoloProgress().isUnlocked,
    });

    /**
     * Step 3 reviews whatever the user actually assembled. With nobody selected
     * it is a personal habit, whether they arrived via solo mode or simply
     * moved past the partner step without picking anyone.
     */
    isSoloReview = (): boolean => isSoloReview(this.state.selectedPartnerIds.length);

    getStepTitle = (step: Step): string => {
        if (step === 3 && this.isSoloReview()) {
            return this.translate('pages.pacts.wizard.soloReviewTitle');
        }

        return this.translate(`pages.pacts.wizard.step${step}Title`);
    };

    setStep = (step: Step) => {
        this.props.navigation.setOptions({
            title: this.getStepTitle(step),
        });
        this.setState({ step });
        if (step === 2) {
            // Fetch a default browse list (no query) so the user has people to
            // pick from immediately, including non-friends.
            this.runUserSearch('');
        }
    };

    selectTemplate = (templateId: string) => {
        const template = this.props.habits.templates?.find((t) => t.id === templateId);

        this.setState({
            selectedTemplateId: templateId,
            customHabitName: '',
            // A template proposes a cadence; the user can still change it before the goal is
            // cloned. `cadenceFromGoal` is the one place the server's precedence is mirrored,
            // so a template carrying fixed weekdays opens on the weekday control rather than
            // on whatever `frequencyType` happens to say.
            cadence: template ? cadenceFromGoal(template) : DAILY_CADENCE,
        });
    };

    setCadence = (cadence: CadenceChoice) => {
        this.setState({ cadence });
    };

    /**
     * The cadence in words, for the review step.
     *
     * Reuses `pages.habits.frequency.*` and `daysOfWeekShort.*` — the keys the habit card has
     * always rendered — so the sentence the user agrees to here is the same one they will see
     * on the card afterwards.
     */
    describeCadence = (cadence: CadenceChoice): string => {
        if (cadence.kind === 'weekdays') {
            return cadence.days
                .map((day) => this.translate(`pages.habits.daysOfWeekShort.${CADENCE_DAY_KEYS[day]}`))
                .join(', ');
        }
        if (cadence.kind === 'weeklyCount') {
            return this.translate('pages.habits.frequency.weekly', { count: cadence.count });
        }
        return this.translate('pages.habits.frequency.daily');
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
        (this.state.selectedTemplateId || this.state.customHabitName.trim().length > 0)
        && isCadenceComplete(this.state.cadence)
        && !this.hasInvalidSavingsTarget(),
    );

    /**
     * A savings target that was typed but does not parse. `SavingsAmountInput` reports it
     * as a null amount, which is indistinguishable from an empty field — so without this
     * gate the pact would be created open-ended and the number the user typed dropped.
     */
    hasInvalidSavingsTarget = (): boolean => this.getIsSavingsSelection()
        && this.state.savingsTargetText.trim().length > 0
        && this.state.savingsTargetAmount === null;

    handleNext = () => {
        const { step } = this.state;
        if (step === 1) {
            if (this.hasInvalidSavingsTarget()) {
                // The field is already showing why inline; the toast only explains the
                // button that did nothing.
                const { error } = parseSavingsAmount(this.state.savingsTargetText);
                Toast.show({
                    type: 'info',
                    text1: this.translate(ERROR_KEY_BY_REASON[error || 'not-a-number']),
                });
                return;
            }
            if (!this.canAdvanceFromStep1()) {
                // Two ways to be incomplete here, and they need different sentences: no habit
                // chosen, or "specific days" chosen with no days ticked. The second would
                // otherwise be told to pick a habit they have already picked.
                const message = isCadenceComplete(this.state.cadence)
                    ? this.translate('pages.pacts.wizard.pickTemplateFirst')
                    : this.translate('pages.habits.cadence.pickAtLeastOneDay');
                Toast.show({ type: 'info', text1: message });
                return;
            }
            if (this.state.selectedTemplateId) {
                AsyncStorage.setItem(HABITS_PRESTAGED_TEMPLATE_ID, this.state.selectedTemplateId).catch(() => {});
            }
        }

        if (step === 2 && !canAdvanceFromPartnerStep(
            this.state.selectedPartnerIds.length,
            this.getSoloProgress().isUnlocked,
        )) {
            // Locked: choosing someone is the only way on. The toast says how
            // many invites unlock the solo path so the requirement reads as
            // finite rather than as the screen simply refusing to respond.
            Toast.show({ type: 'info', text1: this.getPartnerRequiredMessage() });
            return;
        }

        this.setStep(getNextStep(step, this.getWizardContext()));
    };

    /**
     * Why the partner step will not advance. Falls back to the plain prompt
     * when there are no counts to quote — promising an unlock without being
     * able to say how far away it is is worse than not mentioning it.
     */
    getPartnerRequiredMessage = (): string => {
        const { hasProgress, remaining } = this.getSoloProgress();

        if (!hasProgress) {
            return this.translate('pages.pacts.wizard.pickPartnerFirst');
        }

        return this.translate('pages.pacts.wizard.pickPartnerFirstLocked', { remaining });
    };

    handleBack = () => {
        const target = getBackTarget(this.state.step, this.getWizardContext());

        if (target === 'exit') {
            this.props.navigation.goBack();
            return;
        }

        this.setStep(target);
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

    /**
     * Resolve the habit the user composed in step 1 into a real habit goal.
     *
     * Shared by the pact path and the solo path so the two cannot drift on how
     * a template is cloned — cloning matters because per-user stats (streaks,
     * completion rate) must not share rows across users.
     *
     * WHY THE RESULT IS CACHED
     *
     * `createGoal` runs before `bulkInvitePact` / `startUserHabit`, so a
     * failure in the second call leaves a goal already created. Without a cache
     * the obvious user response — tap the button again — created a second goal,
     * and a third, each one counting against the free-tier habit cap. Retries
     * are now common rather than rare: a 402 sends the user to the paywall and
     * straight back here. The cache is keyed on the step-1 selection so
     * changing the habit still creates a new goal.
     */
    resolveHabitGoalId = async (): Promise<string | null> => {
        const { selectedTemplateId, customHabitName, cadence } = this.state;

        // The cadence belongs in this key. Without it, changing the cadence after a failed
        // invite and tapping again would hit the cache and silently reuse the goal created with
        // the OLD cadence — a habit on the wrong schedule, with nothing to indicate it.
        const selectionKey = [
            selectedTemplateId || '',
            customHabitName.trim(),
            cadenceCacheKey(cadence),
        ].join('|');

        if (this.resolvedGoal && this.resolvedGoal.selectionKey === selectionKey) {
            return this.resolvedGoal.habitGoalId;
        }

        const habitGoalId = await this.createHabitGoal();

        if (habitGoalId) {
            this.resolvedGoal = { selectionKey, habitGoalId };
        }

        return habitGoalId;
    };

    /**
     * The create half of `resolveHabitGoalId`, split out so the caching above
     * has exactly one thing to wrap.
     */
    createHabitGoal = async (): Promise<string | null> => {
        const { habits, createGoal } = this.props;
        const {
            selectedTemplateId, customHabitName, cadence, isSavingsHabit,
        } = this.state;

        // The user's choice wins over the template's, on both paths. A template is a starting
        // point — `selectTemplate` prefills the picker from it — not a schedule the user is
        // stuck with. The custom path used to hardcode daily outright.
        const cadenceFields = cadenceToGoalFields(cadence);

        if (selectedTemplateId) {
            const template = habits.templates?.find((t) => t.id === selectedTemplateId);

            if (!template) {
                return selectedTemplateId;
            }

            const userGoal = await createGoal({
                name: template.name,
                description: template.description,
                category: template.category,
                emoji: template.emoji,
                // `goalType` was missing from this clone until now, and it is the field
                // that decides which achievement ladder the habit feeds and whether it
                // tracks money at all. Every clone of the seeded savings template came
                // out as `build_good` (the column default), so the group-trip template
                // shipped as an ordinary habit and no amount could ever be recorded
                // against it. Nothing failed — the goal was created, the pact worked,
                // the savings half was simply absent.
                goalType: template.goalType,
                // Replaces the template's own three cadence columns. `selectTemplate` seeds
                // the picker from the template, so an untouched selection sends exactly what
                // the template carried; a touched one sends what the user asked for.
                ...cadenceFields,
                ...this.getSavingsGoalFields(template.goalType),
            });

            return userGoal?.id || selectedTemplateId;
        }

        if (customHabitName.trim()) {
            const newGoal = await createGoal({
                name: customHabitName.trim(),
                goalType: isSavingsHabit ? HabitGoalTypes.SAVINGS_GOAL : undefined,
                // Was hardcoded `daily`/1, which is why no custom habit could ever be
                // anything but daily however the user actually intended to keep it.
                ...cadenceFields,
                ...this.getSavingsGoalFields(isSavingsHabit ? HabitGoalTypes.SAVINGS_GOAL : undefined),
            });

            return newGoal?.id || null;
        }

        return null;
    };

    /**
     * The savings target fields, or nothing at all for a habit that is not a savings
     * goal.
     *
     * Returned as a spread rather than always-present keys so a non-savings habit sends
     * no savings fields whatsoever — the server treats an absent key as "leave alone",
     * and a `targetAmount: null` on an ordinary habit would be a meaningless write.
     *
     * An empty amount on a savings habit is deliberately still a savings habit: that is
     * the open-ended case, which records a running total and never completes.
     */
    getSavingsGoalFields = (goalType?: string) => {
        if (goalType !== HabitGoalTypes.SAVINGS_GOAL) {
            return {};
        }

        const { savingsTargetAmount, savingsTargetScope } = this.state;

        return {
            targetAmount: savingsTargetAmount,
            currencyCode: this.getSavingsCurrencyCode(),
            savingsTargetScope,
        };
    };

    /**
     * The currency a savings target is recorded in.
     *
     * Taken from the device region rather than asked for. A picker would add a whole
     * step for a field almost nobody changes, and the value is display only: nothing in
     * the system converts between currencies. The source is the device region, not the
     * app locale, because the app locale is a language (`es` names no country). Falls
     * back to `DEFAULT_SAVINGS_CURRENCY_CODE` for a region the table does not know. See
     * `utilities/savingsCurrency.ts`.
     */
    getSavingsCurrencyCode = (): string => getDeviceSavingsCurrencyCode();

    /**
     * Whether the habit being composed is a savings goal — from the chosen template's
     * own type, or from the custom-habit toggle.
     */
    getIsSavingsSelection = (): boolean => {
        const { habits } = this.props;
        const { selectedTemplateId, isSavingsHabit } = this.state;

        if (selectedTemplateId) {
            const template = habits.templates?.find((t: IHabitGoal) => t.id === selectedTemplateId);
            return template?.goalType === HabitGoalTypes.SAVINGS_GOAL;
        }

        return isSavingsHabit;
    };

    /**
     * The free-tier cap answers with 402 and paywall metadata rather than a
     * generic error, so route to the offer instead of showing "something went
     * wrong" for something the user can actually act on.
     *
     * Returns true when it handled the error — false with the offer switched
     * off, when the paywall route is not registered (see
     * utilities/habitCapPaywall), so the toast still shows.
     */
    handlePossiblePaywall = (err: any): boolean => {
        const paywallParams = getHabitCapPaywallParams(err);

        if (!paywallParams) {
            return false;
        }

        this.props.navigation.navigate('UpgradePaywall', paywallParams);

        return true;
    };

    /**
     * A 403 means the invite threshold, not a failure. The server sends the
     * progress counts with it, so say how many invites are left rather than
     * "we could not start that habit" — the user can act on the first and not
     * the second. Refreshes eligibility so the locked section on step 2 catches
     * up with whatever the server just told us.
     *
     * Returns true when it handled the error.
     */
    handlePossibleSoloLock = (err: any): boolean => {
        const { status, body } = readApiError(err);

        if (status !== 403 || body?.error !== 'solo-locked') {
            return false;
        }

        this.props.getUserHabitEligibility().catch(() => {});

        const required = body?.requiredCount;
        const invited = body?.invitedCount;
        const remaining = typeof required === 'number' && typeof invited === 'number'
            ? Math.max(required - invited, 0)
            : null;

        Toast.show({
            type: 'info',
            text1: remaining === null
                ? this.translate('pages.pacts.wizard.soloError')
                : this.translate('pages.pacts.wizard.soloLockedTitle', { remaining }),
        });

        return true;
    };

    /**
     * Whether the cached eligibility says the user is at the free-tier habit cap.
     * `isAtHabitLimit` already accounts for the founder unlock and premium, so an
     * entitled user never reads as capped here.
     */
    isAtHabitCap = (): boolean => this.props.habits.userHabitEligibility?.isAtHabitLimit === true;

    openHabitCapOffer = (limit: number | null | undefined = this.props.habits.userHabitEligibility?.habitLimit) => {
        this.props.navigation.navigate('UpgradePaywall', {
            reason: 'habit-limit-reached',
            limit: limit ?? undefined,
        });
    };

    /** Archiving lives on the dashboard's habit list. It is free and loses nothing. */
    openArchiveHabits = () => {
        this.props.navigation.navigate('HabitsDashboard', { initialTab: 'habits' });
    };

    /**
     * Checks the cap once more before the final action, and stops there if the user
     * is at it.
     *
     * Both final actions create a `habits.habit_goals` row (`resolveHabitGoalId`)
     * *before* the server gets the chance to refuse the tracking row with a 402.
     * Without this check, a capped user who taps create leaves an orphaned goal
     * behind every time (#2922). The fetch is fresh, not cached, because the user
     * may have archived a habit or bought the unlock since this screen mounted.
     *
     * Fails open. If the fetch fails or comes back empty, the request goes ahead
     * and the server, which is still the authority, answers with the 402 that
     * `handlePossiblePaywall` handles. A client check that could block someone the
     * server would allow is worse than an orphaned goal.
     *
     * Returns true when the caller may proceed.
     */
    confirmHabitCapacity = async (): Promise<boolean> => {
        let eligibility: any;
        try {
            eligibility = await this.props.getUserHabitEligibility();
        } catch {
            return true;
        }

        if (eligibility?.isAtHabitLimit !== true) {
            return true;
        }

        if (isHabitCapPaywallAvailable()) {
            this.openHabitCapOffer(eligibility.habitLimit);
        } else {
            Toast.show({
                type: 'info',
                text1: this.translate('pages.upgrade.limitTitle'),
                text2: this.getHabitLimitBody(eligibility?.habitLimit),
            });
        }

        return false;
    };

    getHabitLimitBody = (limit?: number | null): string => (typeof limit === 'number'
        ? this.translate('pages.pacts.wizard.habitLimitBody', { limit })
        : this.translate('pages.pacts.wizard.habitLimitBodyGeneric'));

    /**
     * "Track this on my own" — creates the habit goal and starts tracking it
     * with no pact attached. The server can refuse it two ways: 403 while the
     * user is short of the invite threshold, and 402 at the free-tier habit
     * cap, which routes to the paywall like the pact path does.
     */
    handleStartSolo = async () => {
        const { navigation, startUserHabit } = this.props;

        this.setState({ isStartingSolo: true });

        try {
            if (!(await this.confirmHabitCapacity())) {
                return;
            }

            const habitGoalId = await this.resolveHabitGoalId();

            if (!habitGoalId) {
                throw new Error('missing habitGoalId');
            }

            await startUserHabit({ habitGoalId });

            // Solo tracking is activation too. Without this event a user who
            // unlocks solo mode and starts tracking reads as never activated,
            // which understates exactly the outcome the solo unlock exists to
            // produce. Kept distinct from habit_pact_create because the pact is
            // the thing paid acquisition is judged on.
            logAppEvent('habit_solo_start', {
                userId: this.props.user?.details?.id,
            });

            Toast.show({
                type: 'success',
                text1: this.translate('pages.pacts.wizard.soloSuccess'),
            });

            navigation.navigate('HabitsDashboard');
        } catch (err: any) {
            if (!this.handlePossibleSoloLock(err) && !this.handlePossiblePaywall(err)) {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.wizard.soloError'),
                });
            }
        } finally {
            this.setState({ isStartingSolo: false });
        }
    };

    handleSend = async () => {
        const { bulkInvitePact, navigation } = this.props;
        const { selectedPartnerIds } = this.state;

        this.setState({ isSending: true });

        try {
            if (!(await this.confirmHabitCapacity())) {
                return;
            }

            const habitGoalId = await this.resolveHabitGoalId();

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

            // THE activation event. `_rule_app_activation` in
            // scripts/google-ads judges the whole PRODUCT question on the rate
            // of this against profile_create_start; until it existed the
            // analyzer fell back to connection_invites_sent, which is a
            // strictly weaker claim (an invite is not a pact).
            //
            // Fired after bulkInvitePact resolves, never before: the server
            // refuses this with a 402 at the free-tier habit cap, and counting
            // an attempt as an activation would report the paywall as success.
            logAppEvent('habit_pact_create', {
                userId: this.props.user?.details?.id,
                partnerCount: selectedPartnerIds.length,
                pactType: 'accountability',
            });

            // Separate from the pact because the solo-tracking unlock counts
            // distinct people invited, not pacts created — one bulk invite can
            // move that counter by several.
            logAppEvent('habit_invite_sent', {
                userId: this.props.user?.details?.id,
                partnerCount: selectedPartnerIds.length,
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
        } catch (err: any) {
            // A 402 means the free-tier habit cap, not a failure — send the
            // user somewhere they can do something about it.
            if (!this.handlePossiblePaywall(err)) {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.wizard.sendingError'),
                });
            }
        } finally {
            this.setState({ isSending: false });
        }
    };

    /**
     * The savings target block — amount, and who the target belongs to.
     *
     * Only rendered once the composed habit is actually a savings goal, so an ordinary
     * habit's create flow is unchanged.
     *
     * The scope choice is the one control here that changes behaviour rather than
     * display: it decides whether the pact finishes when *each* member reaches the
     * number or when the group reaches it between them, and those complete on very
     * different days. It is therefore two labelled options with explanatory copy rather
     * than a bare switch — the wording is what makes the choice meaningful.
     */
    renderSavingsTarget = () => {
        const { savingsTargetText, savingsTargetScope } = this.state;

        if (!this.getIsSavingsSelection()) {
            return null;
        }

        const scopeOptions: { value: SavingsTargetScope; labelKey: string; hintKey: string }[] = [
            {
                value: SavingsTargetScopes.PER_MEMBER,
                labelKey: 'pages.pacts.wizard.savingsScopePerMemberLabel',
                hintKey: 'pages.pacts.wizard.savingsScopePerMemberHint',
            },
            {
                value: SavingsTargetScopes.GROUP,
                labelKey: 'pages.pacts.wizard.savingsScopeGroupLabel',
                hintKey: 'pages.pacts.wizard.savingsScopeGroupHint',
            },
        ];

        return (
            <View style={{ paddingHorizontal: 10, marginTop: 20 }}>
                <Text style={[this.themeHabits.styles.habitCardSubtitle, { fontWeight: '600', paddingHorizontal: 10 }]}>
                    {this.translate('pages.pacts.wizard.savingsSectionTitle')}
                </Text>
                <SavingsAmountInput
                    value={savingsTargetText}
                    onChangeText={(text) => this.setState({ savingsTargetText: text })}
                    onValueChange={(amount) => this.setState({ savingsTargetAmount: amount })}
                    currencyCode={this.getSavingsCurrencyCode()}
                    label={this.translate('pages.pacts.wizard.savingsTargetLabel')}
                    hint={this.translate('pages.pacts.wizard.savingsTargetHint')}
                    translate={this.translate}
                    colors={this.theme.colors}
                />
                {scopeOptions.map((option) => {
                    const isSelected = savingsTargetScope === option.value;

                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => this.setState({ savingsTargetScope: option.value })}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                gap: 10,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                            }}
                        >
                            <Text style={{ fontSize: 18 }}>{isSelected ? '🔘' : '⚪'}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[this.themeHabits.styles.habitCardTitle, { fontSize: 15 }]}>
                                    {this.translate(option.labelKey)}
                                </Text>
                                <Text style={this.themeHabits.styles.habitCardSubtitle}>
                                    {this.translate(option.hintKey)}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        );
    };

    /**
     * The free-tier cap, stated before the user builds a habit they cannot start
     * (#2922). Shown on step 1, before any work is put in, and again on step 3,
     * right above the create button. It offers two ways out side by side.
     * Archiving comes first because it is free and loses nothing: check-ins,
     * streaks and journal entries all stay. The upgrade button only shows when
     * the paywall route is registered.
     *
     * This notice does not block anything. The create button still works, and
     * `confirmHabitCapacity` re-checks with a fresh fetch at that point, so a
     * stale cache (say, a habit archived since mount) cannot lock the user out.
     */
    renderHabitLimitNotice = () => {
        if (!this.isAtHabitCap()) {
            return null;
        }

        const limit = this.props.habits.userHabitEligibility?.habitLimit;

        return (
            <View
                style={[
                    this.themeHabits.styles.habitCardContainer,
                    { borderWidth: 1, borderColor: this.theme.colors.primary3 },
                ]}
                accessibilityRole="alert"
            >
                <Text style={this.themeHabits.styles.habitCardTitle}>
                    {this.translate('pages.upgrade.limitTitle')}
                </Text>
                <Text style={[this.themeHabits.styles.habitCardSubtitle, { marginTop: 4 }]}>
                    {this.getHabitLimitBody(limit)}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                    <Pressable
                        onPress={this.openArchiveHabits}
                        accessibilityRole="button"
                        style={{ paddingVertical: 8, paddingRight: 16 }}
                    >
                        <Text style={this.themeButtons.styles.btnTitleBlack}>
                            {this.translate('pages.pacts.wizard.habitLimitArchive')}
                        </Text>
                    </Pressable>
                    {isHabitCapPaywallAvailable() && (
                        <Pressable
                            onPress={() => this.openHabitCapOffer()}
                            accessibilityRole="button"
                            style={{ paddingVertical: 8 }}
                        >
                            <Text style={this.themeButtons.styles.btnTitleBlack}>
                                {this.translate('pages.pacts.wizard.habitLimitUpgrade')}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    };

    renderStep1 = () => {
        const { habits } = this.props;
        const {
            selectedTemplateId, customHabitName, isLoadingTemplates, cadence, isSavingsHabit,
        } = this.state;
        const templates = habits.templates || [];

        return (
            <View>
                <Text style={[this.themeHabits.styles.dashboardSubtitle, { paddingHorizontal: 20 }]}>
                    {this.translate('pages.pacts.wizard.step1Subtitle')}
                </Text>

                {this.renderHabitLimitNotice()}

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
                    {!selectedTemplateId && customHabitName.trim().length > 0 ? (
                        // Offered only on the custom path. A template already declares its
                        // own `goalType`, and letting the toggle override it would let a
                        // user turn "Read 20 pages" into a savings habit by accident.
                        <Pressable
                            onPress={() => this.setState({ isSavingsHabit: !isSavingsHabit })}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSavingsHabit }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                                marginTop: 14,
                            }}
                        >
                            <Text style={{ fontSize: 18 }}>{isSavingsHabit ? '☑️' : '⬜'}</Text>
                            <Text style={[this.themeHabits.styles.habitCardSubtitle, { flex: 1 }]}>
                                {this.translate('pages.pacts.wizard.savingsToggleLabel')}
                            </Text>
                        </Pressable>
                    ) : null}
                </View>

                <CadencePicker
                    value={cadence}
                    onChange={this.setCadence}
                    themeHabits={this.themeHabits}
                    translate={this.translate}
                />

                {this.renderSavingsTarget()}
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

    /**
     * The solo branch at the foot of the partner step: an unlocked shortcut, or
     * the progress that gets the user there.
     */
    renderSoloSection = (isStartingSolo: boolean) => {
        const { isUnlocked, hasProgress, invitedCount, requiredCount, remaining } = this.getSoloProgress();

        if (!isUnlocked) {
            // Nothing to promise without counts — say nothing rather than
            // dangling a feature with no stated price.
            if (!hasProgress) {
                return null;
            }

            return (
                <View style={{ paddingHorizontal: 20, marginTop: 8, paddingBottom: 16 }}>
                    <Text style={[this.themeHabits.styles.habitCardSubtitle, { textAlign: 'center', fontWeight: '600' }]}>
                        {this.translate('pages.pacts.wizard.soloLockedTitle', { remaining })}
                    </Text>
                    <Text style={[this.themeHabits.styles.streakMilestoneText, { textAlign: 'center', marginTop: 4 }]}>
                        {this.translate('pages.pacts.wizard.soloLockedProgress', {
                            invited: invitedCount,
                            required: requiredCount,
                        })}
                    </Text>
                </View>
            );
        }

        return (
            <View style={{ paddingHorizontal: 20, marginTop: 8, paddingBottom: 16 }}>
                <Text style={[this.themeHabits.styles.habitCardSubtitle, { textAlign: 'center' }]}>
                    {this.translate('pages.pacts.wizard.soloHint')}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isStartingSolo }}
                    disabled={isStartingSolo}
                    onPress={this.handleStartSolo}
                    style={{ marginTop: 8, paddingVertical: 12, opacity: isStartingSolo ? 0.6 : 1 }}
                >
                    <Text style={[this.themeButtons.styles.btnTitleBlack, { textAlign: 'center' }]}>
                        {isStartingSolo
                            ? this.translate('pages.pacts.wizard.soloStarting')
                            : this.translate('pages.pacts.wizard.soloCta')}
                    </Text>
                </Pressable>
            </View>
        );
    };

    renderStep2 = () => {
        const { user, userConnections } = this.props;
        const {
            selectedPartnerIds, searchQuery, isSearching, isStartingSolo,
        } = this.state;
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

                {/*
                  * Non-default by design: the app is called Friends with Habits,
                  * so the solo route sits below the partner list rather than
                  * alongside it. While locked this is the one place in the flow
                  * that explains what the invites are *for*, so it renders the
                  * progress rather than hiding — a requirement nobody can see is
                  * indistinguishable from a broken screen.
                  */}
                {this.renderSoloSection(isStartingSolo)}
            </View>
        );
    };

    renderStep3 = () => {
        const { habits } = this.props;
        const {
            selectedTemplateId, customHabitName, selectedPartnerIds, cadence,
        } = this.state;
        const template = selectedTemplateId
            ? habits.templates?.find((t) => t.id === selectedTemplateId)
            : undefined;
        const habitName = template?.name || customHabitName.trim();
        const habitEmoji = template?.emoji || this.translate('pages.pacts.wizard.habitDefaultEmoji');
        const partnerCount = selectedPartnerIds.length;
        const isSolo = this.isSoloReview();

        return (
            <View>
                <Text style={[this.themeHabits.styles.dashboardSubtitle, { paddingHorizontal: 20 }]}>
                    {isSolo
                        ? this.translate('pages.pacts.wizard.soloReviewSubtitle')
                        : this.translate('pages.pacts.wizard.step3Subtitle')}
                </Text>
                {this.renderHabitLimitNotice()}
                <View style={this.themeHabits.styles.habitCardContainer}>
                    <View style={this.themeHabits.styles.habitCardHeader}>
                        <Text style={this.themeHabits.styles.habitCardEmoji}>{habitEmoji}</Text>
                        <View style={this.themeHabits.styles.habitCardTitleContainer}>
                            <Text style={this.themeHabits.styles.habitCardTitle}>{habitName}</Text>
                            <Text style={this.themeHabits.styles.habitCardSubtitle}>
                                {isSolo
                                    ? this.translate('pages.pacts.wizard.soloJustYou')
                                    : this.translate('pages.pacts.wizard.multiSelectCounter', { count: partnerCount })}
                            </Text>
                        </View>
                    </View>
                </View>
                {/*
                  * The cadence, restated on the last screen before the habit exists. It is the
                  * other half of the agreement the freeze rule below describes — a rule about
                  * "a day your habit asked for" only means something once the user can see
                  * which days those are.
                  */}
                <Text style={[this.themeHabits.styles.streakMilestoneText, { paddingHorizontal: 20, marginTop: 12 }]}>
                    {this.translate('pages.pacts.wizard.cadenceReview', {
                        cadence: this.describeCadence(cadence),
                    })}
                </Text>
                {isSolo && (
                    <Text style={[this.themeHabits.styles.streakMilestoneText, { paddingHorizontal: 20, marginTop: 12 }]}>
                        {this.translate('pages.pacts.wizard.soloAddPartnersLater')}
                    </Text>
                )}
                {/*
                  * State the streak-freeze allowance on the last screen before
                  * the habit exists. "Build in the miss" is explicitly a rule
                  * agreed in advance — a net the user only discovers after
                  * their first bad day cannot change what they do on it, and
                  * this is the last moment it is still in advance.
                  */}
                <Text style={[this.themeHabits.styles.streakMilestoneText, { paddingHorizontal: 20, marginTop: 12 }]}>
                    {this.translate('pages.pacts.wizard.freezeRule', streakFreezeRuleParams)}
                </Text>
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
        const { step, isSending, isStartingSolo, selectedPartnerIds } = this.state;
        const isFinalStep = step === 3;
        // With nobody selected the final action starts a personal habit rather
        // than sending invites, so the label and the handler move together —
        // a "Send invite" button that sends none reads as a broken button.
        const isSolo = getFinalAction(selectedPartnerIds.length) === 'startSolo';
        const sendKey = selectedPartnerIds.length > 1
            ? 'pages.pacts.wizard.sendMultiple'
            : 'pages.pacts.wizard.send';
        let primaryTitle = this.translate('pages.pacts.wizard.next');
        if (isFinalStep) {
            primaryTitle = isSolo
                ? this.translate('pages.pacts.wizard.soloCta')
                : this.translate(sendKey, { count: selectedPartnerIds.length });
        }
        const isBusy = isSending || isStartingSolo;

        let onPrimaryPress = this.handleNext;
        if (isFinalStep) {
            onPrimaryPress = isSolo ? this.handleStartSolo : this.handleSend;
        }

        return (
            <SafeAreaInsetsContext.Consumer>
                {(insets) => {
                    const bottomInset = insets?.bottom ?? bottomSafeAreaInset;
                    return (
                        <WizardFooter
                            bottomInset={bottomInset}
                            backgroundColor={this.theme.colors.surface}
                            shadowColor={this.theme.colors.textBlack}
                            onLayout={this.onFooterLayout}
                        >
                            <Pressable
                                onPress={this.handleBack}
                                disabled={isBusy}
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
                                    onPress={onPrimaryPress}
                                    disabled={isBusy}
                                />
                            </View>
                        </WizardFooter>
                    );
                }}
            </SafeAreaInsetsContext.Consumer>
        );
    };

    onFooterLayout = (event: LayoutChangeEvent) => {
        const { height } = event.nativeEvent.layout;

        if (height > 0 && Math.round(height) !== Math.round(this.state.footerHeight)) {
            this.setState({ footerHeight: height });
        }
    };

    render() {
        const { user } = this.props;
        const { footerHeight } = this.state;

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
                                /* `bottomOffset` keeps the focused input (the custom-habit
                                 * name on step 1, the people search on step 2) clear of the
                                 * action bar that sticks to the top of the keyboard. */
                                <KeyboardAwareScrollView
                                    bottomOffset={footerHeight}
                                    keyboardShouldPersistTaps="handled"
                                    contentContainerStyle={{ paddingBottom: footerHeight + 24 + bottomInset }}
                                >
                                    {this.renderStepContent()}
                                </KeyboardAwareScrollView>
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
