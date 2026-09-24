import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions } from 'therr-react/redux/actions';
import { IHabitsState, IUserState } from 'therr-react/types';
import UsersActions from '../../redux/actions/UsersActions';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import {
    formatSeatCount,
    getFounderValueAnchorMonths,
    getSeatFillRatio,
} from './paywallPresentation';
import {
    endBilling,
    finishPurchase,
    fetchFounderProduct,
    fetchPremiumProduct,
    getOwnedFounderPurchase,
    getOwnedSubscription,
    getSubscriptionOfferToken,
    initBilling,
    isBillingSupported,
    requestFounderPurchase,
    requestSubscriptionPurchase,
    resolvePurchaseValue,
    PURCHASE_TIMEOUT_CODE,
} from '../../utilities/habitsBilling';

interface IUpgradePaywallDispatchProps {
    getLifetimeOffer: Function;
    verifyLifetimePurchase: Function;
    getPremiumOffer: Function;
    verifyPremiumPurchase: Function;
    getMe: Function;
}

interface IStoreProps extends IUpgradePaywallDispatchProps {
    habits: IHabitsState;
    user: IUserState;
}

export interface IUpgradePaywallProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IUpgradePaywallState {
    isLoading: boolean;
    isPurchasing: boolean;
    isSubscribing: boolean;
    localizedPrice: string | null;
    premiumPrice: string | null;
    // The subscribe button appears only once an offer token is resolved, since a
    // Play subscription cannot be purchased without one.
    isPremiumReady: boolean;
}

const mapStateToProps = (state) => ({
    habits: state.habits,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getLifetimeOffer: HabitActions.getLifetimeOffer,
    verifyLifetimePurchase: HabitActions.verifyLifetimePurchase,
    getPremiumOffer: HabitActions.getPremiumOffer,
    verifyPremiumPurchase: HabitActions.verifyPremiumPurchase,
    getMe: UsersActions.getMe,
}, dispatch);

const FOUNDER_BENEFIT_KEYS = [
    'unlimitedHabits',
    'unlimitedPacts',
    'allFutureFeatures',
    'foundersBadge',
    'noSubscription',
];

const PREMIUM_BENEFIT_KEYS = [
    'unlimitedHabits',
    'unlimitedPacts',
    'allFeatures',
    'cancelAnytime',
];

/**
 * Which "you already have this" line to show an entitled account.
 *
 * Decided from evidence of what was bought, not from `isEntitled`: both offer
 * endpoints compute `isEntitled` from the same `hasHabitsPremiumEntitlement`,
 * which is true for a founder AND for a monthly subscriber, so the lifetime
 * offer's flag cannot tell the two apart — reading it told every subscriber
 * they had lifetime access. A founder is identified by the recorded purchase, a
 * subscriber by the active subscription row; an account entitled without either
 * (an admin) gets the generic line.
 */
export const getOwnedCopy = (
    lifetimeOffer: any,
    premiumOffer: any,
): { key: string; params?: Record<string, any> } => {
    const founderNumber = lifetimeOffer?.purchase?.founderNumber;

    if (founderNumber) {
        return { key: 'pages.upgrade.ownedWithNumber', params: { number: founderNumber } };
    }

    if (lifetimeOffer?.purchase) {
        return { key: 'pages.upgrade.owned' };
    }

    if (premiumOffer?.subscription) {
        return { key: 'pages.upgrade.premium.owned' };
    }

    return { key: 'pages.upgrade.owned' };
};

/**
 * The two ways to lift the free-tier limits, on one screen:
 *   - the founder offer — one payment, premium for life, for the first N
 *     accounts (Google Play in-app product); and
 *   - the $6.99/month premium subscription (Google Play subscription).
 *
 * Both grant `HABITS_PREMIUM`/`HABITS_LIFETIME` server-side, so a single
 * `isEntitled` (from either offer) hides every CTA once the account is paid. Each
 * CTA has its own gate: the store module must be present and Android (iOS has no
 * server-side receipt verification yet), the server must report Play credentials
 * configured, and — for the founder offer — seats must remain, while the
 * subscribe button additionally waits for an offer token to resolve.
 *
 * The screen is reachable both from a 402 (`habit-limit-reached`) and from a
 * direct tap, so it reads `route.params.reason` to decide whether to lead with
 * the limit or with the offer.
 */
export class UpgradePaywall extends React.Component<IUpgradePaywallProps, IUpgradePaywallState> {
    private translate: Function;

    private theme = buildStyles();

    private themeHabits = buildHabitStyles();

    /**
     * The store products, kept off state on purpose: they are read back within
     * the same call stack that recovery sets them in, and `setState` does not
     * update `this.state` synchronously. State carries the display strings and
     * readiness flag, which is all the render needs.
     */
    private founderProduct: any = null;

    private premiumProduct: any = null;

    private premiumOfferToken: string | null = null;

    constructor(props: IUpgradePaywallProps) {
        super(props);

        this.state = {
            isLoading: true,
            isPurchasing: false,
            isSubscribing: false,
            localizedPrice: null,
            premiumPrice: null,
            isPremiumReady: false,
        };

        const themeName = props.user.settings?.mobileThemeName;
        this.theme = buildStyles(themeName);
        this.themeHabits = buildHabitStyles(themeName);

        this.translate = (key: string, params: any) => translator(
            props.user.settings?.locale || 'en-us',
            key,
            params,
        );
    }

    componentDidMount() {
        // The denominator for the purchase events below. Without it a zero
        // purchase count is unreadable: it cannot distinguish "nobody is
        // reaching the paywall" from "everybody reaches it and nobody buys",
        // which are opposite problems with opposite fixes.
        //
        // `source` is which door they came through (see `PaywallSource`) and
        // `reason` whether a wall sent them. Together they turn one view count
        // into a per-surface funnel: nudge impression → this → purchase.
        logAppEvent('habits_paywall_view', {
            userId: this.props.user?.details?.id,
            source: this.getSource(),
            reason: this.props.route?.params?.reason,
        });

        Promise.all([
            this.props.getLifetimeOffer().catch(() => null),
            this.props.getPremiumOffer().catch(() => null),
        ])
            .then(([lifetimeOffer, premiumOffer]) => this.prepareStore(lifetimeOffer, premiumOffer))
            .catch(() => null)
            .finally(() => {
                this.setState({ isLoading: false });
            });
    }

    componentWillUnmount() {
        // The billing connection is a native resource; leaving it open holds a
        // service binding for the rest of the app session.
        endBilling();
    }

    /**
     * The entry point, for analytics. A 402 that arrived without a named source
     * (an older call site) is still distinguishable from a deliberate visit.
     */
    getSource = (): string => {
        const { route } = this.props;

        if (route?.params?.source) {
            return route.params.source;
        }

        return route?.params?.reason ? 'habit-limit' : 'direct';
    };

    /**
     * Open the store connection and read the real localized prices.
     *
     * Also recovers a purchase that completed but was never verified — if the
     * verify call failed (offline, server restart) the user is charged and
     * unentitled, and the only way back is to notice the owned purchase here.
     */
    prepareStore = async (lifetimeOffer: any, premiumOffer: any) => {
        if (!isBillingSupported()) {
            return;
        }

        const isEntitled = !!lifetimeOffer?.isEntitled || !!premiumOffer?.isEntitled;

        if (!lifetimeOffer?.productId && !premiumOffer?.productId) {
            return;
        }

        const connected = await initBilling();

        if (!connected) {
            return;
        }

        if (lifetimeOffer?.productId) {
            const product = await fetchFounderProduct(lifetimeOffer.productId);

            if (product) {
                this.founderProduct = product;
                this.setState({
                    localizedPrice: product.displayPrice || product.localizedPrice || null,
                });
            }
        }

        if (premiumOffer?.productId) {
            const product = await fetchPremiumProduct(premiumOffer.productId);

            if (product) {
                this.premiumProduct = product;
                this.premiumOfferToken = getSubscriptionOfferToken(product);
                this.setState({
                    premiumPrice: product.displayPrice || product.localizedPrice || null,
                    isPremiumReady: !!this.premiumOfferToken,
                });
            }
        }

        if (!isEntitled) {
            // Recover a purchase whose verification never landed. Founder first
            // — a lifetime unlock supersedes the need for a subscription — then
            // the subscription.
            if (lifetimeOffer?.productId && !lifetimeOffer?.purchase) {
                const recovered = await this.recoverOwnedFounderPurchase(lifetimeOffer.productId);

                if (recovered) {
                    return;
                }
            }

            if (premiumOffer?.productId && !premiumOffer?.subscription) {
                await this.recoverOwnedSubscription(premiumOffer.productId);
            }
        }
    };

    /**
     * Verify a founder purchase the store says the account already owns. Returns
     * whether anything was recovered so callers know whether they still owe the
     * user a message.
     */
    recoverOwnedFounderPurchase = async (productId: string): Promise<boolean> => {
        const owned = await getOwnedFounderPurchase(productId);

        if (!owned) {
            return false;
        }

        await this.verifyAndFinish(owned, { isSilent: true });

        return true;
    };

    recoverOwnedSubscription = async (productId: string): Promise<boolean> => {
        const owned = await getOwnedSubscription(productId);

        if (!owned) {
            return false;
        }

        await this.verifyPremiumAndFinish(owned, { isSilent: true });

        return true;
    };

    verifyAndFinish = async (purchase: any, options: { isSilent?: boolean } = {}) => {
        const { navigation } = this.props;

        try {
            const verified = await this.props.verifyLifetimePurchase({
                platform: 'android',
                purchaseToken: purchase.purchaseToken,
                orderId: purchase.orderId,
            });

            // Acknowledged only after the server recorded the purchase — see
            // the note in `habitsBilling.finishPurchase`.
            await finishPurchase(purchase.rawPurchase);

            const purchaseValue = resolvePurchaseValue(verified?.purchase, this.founderProduct);

            logAppEvent('habits_founder_unlock_purchase', {
                userId: this.props.user?.details?.id,
                value: purchaseValue?.value,
                currency: purchaseValue?.currency,
                isRecovery: !!options.isSilent,
                source: this.getSource(),
            });

            // The entitlement lives on the user record, not in habits state, so
            // the user has to be refreshed or every gate keeps reading stale
            // access levels until the next sign-in.
            await this.props.getMe().catch(() => null);

            showToast.success({
                text1: this.translate('pages.upgrade.success.title'),
                text2: this.translate('pages.upgrade.success.message'),
            });

            navigation.goBack();
        } catch {
            // Silent on the recovery path — the user did not ask for this, and
            // a toast about a purchase they made days ago would be confusing.
            if (!options.isSilent) {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.upgrade.errors.verifyFailed'),
                });
            }
        }
    };

    verifyPremiumAndFinish = async (purchase: any, options: { isSilent?: boolean } = {}) => {
        const { navigation } = this.props;

        try {
            const verified = await this.props.verifyPremiumPurchase({
                platform: 'android',
                purchaseToken: purchase.purchaseToken,
                orderId: purchase.orderId,
            });

            // A subscription is acknowledged, never consumed — same call as the
            // founder unlock, after the server has recorded it.
            await finishPurchase(purchase.rawPurchase);

            // The verify response does not carry a subscription price, so the
            // store product (its recurring pricing phase) is the source of the
            // conversion value. Reported after the SERVER recorded the purchase,
            // so a failed verification never counts as a conversion.
            const purchaseValue = resolvePurchaseValue(verified?.subscription, this.premiumProduct);

            logAppEvent('habits_premium_subscription_purchase', {
                userId: this.props.user?.details?.id,
                value: purchaseValue?.value,
                currency: purchaseValue?.currency,
                isRecovery: !!options.isSilent,
                source: this.getSource(),
            });

            await this.props.getMe().catch(() => null);

            showToast.success({
                text1: this.translate('pages.upgrade.premium.success.title'),
                text2: this.translate('pages.upgrade.premium.success.message'),
            });

            navigation.goBack();
        } catch {
            if (!options.isSilent) {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.upgrade.errors.verifyFailed'),
                });
            }
        }
    };

    handlePurchase = async () => {
        const { habits } = this.props;
        const offer = habits.lifetimeOffer;

        if (!offer?.productId) {
            return;
        }

        this.setState({ isPurchasing: true });

        try {
            const connected = await initBilling();

            if (!connected) {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.upgrade.errors.storeUnavailable'),
                });
                return;
            }

            const purchase = await requestFounderPurchase(offer.productId);
            await this.verifyAndFinish(purchase);
        } catch (err: any) {
            this.handlePurchaseError(err, () => this.recoverOwnedFounderPurchase(offer.productId));
        } finally {
            this.setState({ isPurchasing: false });
        }
    };

    handleSubscribe = async () => {
        const { habits } = this.props;
        const offer = habits.premiumOffer;

        if (!offer?.productId) {
            return;
        }

        this.setState({ isSubscribing: true });

        try {
            const connected = await initBilling();

            if (!connected) {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.upgrade.errors.storeUnavailable'),
                });
                return;
            }

            // The offer token is fetched with the product; recover it here if the
            // first fetch missed it, so a slow catalogue load does not dead-end
            // the button.
            if (!this.premiumOfferToken && this.premiumProduct) {
                this.premiumOfferToken = getSubscriptionOfferToken(this.premiumProduct);
            }

            if (!this.premiumOfferToken) {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.upgrade.errors.storeUnavailable'),
                });
                return;
            }

            const purchase = await requestSubscriptionPurchase(offer.productId, this.premiumOfferToken);
            await this.verifyPremiumAndFinish(purchase);
        } catch (err: any) {
            this.handlePurchaseError(err, () => this.recoverOwnedSubscription(offer.productId));
        } finally {
            this.setState({ isSubscribing: false });
        }
    };

    /**
     * Shared purchase-error handling for both flows. A user cancelling out of the
     * Play sheet is the second most common outcome of tapping buy and is not
     * worth a toast; a timeout may still land, so it triggers recovery and never
     * claims failure; anything else is a real error.
     */
    handlePurchaseError = async (err: any, recover: () => Promise<boolean>) => {
        const isCancelled = err?.code === 'E_USER_CANCELLED'
            || `${err?.message || ''}`.toLowerCase().includes('cancel');

        if (err?.code === PURCHASE_TIMEOUT_CODE) {
            const recovered = await recover();

            if (!recovered) {
                showToast.info({
                    text1: this.translate('pages.upgrade.errors.purchasePending'),
                });
            }
        } else if (!isCancelled) {
            showToast.error({
                text1: this.translate('alertTitles.backendErrorMessage'),
                text2: this.translate('pages.upgrade.errors.purchaseFailed'),
            });
        }
    };

    getLocale = (): string => this.props.user.settings?.locale || 'en-us';

    handleNotNow = () => {
        this.props.navigation.goBack();
    };

    renderBenefit = (label: string, iconStyle: any, textStyle: any) => (
        <View key={label} style={this.themeHabits.styles.paywallBenefitRow}>
            <FontAwesome5Icon name="check-circle" solid size={16} style={iconStyle} />
            <Text style={textStyle}>{label}</Text>
        </View>
    );

    /**
     * The header: what the user is being told and why they are here. From a 402
     * it leads with the limit — and shows it, as a full row of pips — so the
     * offer below reads as the way past something concrete rather than as an
     * ad. Arriving by choice, it leads with the offer.
     */
    renderHeader = () => {
        const { route } = this.props;
        const reason = route?.params?.reason;
        const isLimit = reason === 'habit-limit-reached';
        const limit = Number(route?.params?.limit);
        const hasLimit = Number.isFinite(limit) && limit > 0 && limit <= 12;

        return (
            <View style={this.themeHabits.styles.paywallHeader}>
                {isLimit && hasLimit && (
                    <View
                        style={this.themeHabits.styles.paywallLimitMeter}
                        accessibilityRole="text"
                        accessibilityLabel={this.translate('pages.upgrade.limitMeterLabel', { limit })}
                    >
                        {Array.from({ length: limit }, (_, index) => (
                            <View key={index} style={this.themeHabits.styles.paywallLimitPip} />
                        ))}
                        <Text style={this.themeHabits.styles.paywallLimitMeterLabel}>
                            {this.translate('pages.upgrade.limitMeterLabel', { limit })}
                        </Text>
                    </View>
                )}
                <Text style={this.themeHabits.styles.dashboardGreeting}>
                    {isLimit
                        ? this.translate('pages.upgrade.limitTitle')
                        : this.translate('pages.upgrade.title')}
                </Text>
                <Text style={this.themeHabits.styles.dashboardSubtitle}>
                    {isLimit
                        ? this.translate('pages.upgrade.limitSubtitle', {
                            limit: route?.params?.limit ?? '',
                        })
                        : this.translate('pages.upgrade.subtitle')}
                </Text>
            </View>
        );
    };

    /**
     * The founder offer, as the one thing on the screen that looks like a
     * product. Rendered whenever the offer exists — sold out included, since a
     * user who has seen the offer advertised deserves to be told it is gone
     * rather than to find it silently missing.
     */
    renderFounderCard = (canPurchase: boolean) => {
        const { habits } = this.props;
        const { isPurchasing, localizedPrice } = this.state;
        const lifetimeOffer = habits.lifetimeOffer;
        const { styles } = this.themeHabits;

        if (!lifetimeOffer) {
            return null;
        }

        const locale = this.getLocale();
        const seatFill = getSeatFillRatio(lifetimeOffer);

        return (
            <LinearGradient
                colors={this.themeHabits.paywallHeroGradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.paywallHeroCard}
            >
                <View style={styles.paywallEyebrowRow}>
                    <View style={styles.paywallEyebrowChip}>
                        <FontAwesome5Icon name="star" solid size={11} style={styles.paywallEyebrowIcon} />
                        <Text style={styles.paywallEyebrowText}>
                            {this.translate('pages.upgrade.eyebrow')}
                        </Text>
                    </View>
                    <Text style={styles.paywallEyebrowAside}>
                        {this.translate('pages.upgrade.oneTime')}
                    </Text>
                </View>

                <View style={styles.paywallPriceRow}>
                    {!!localizedPrice && (
                        <Text style={styles.paywallPrice}>{localizedPrice}</Text>
                    )}
                    <Text style={styles.paywallPriceCaption}>
                        {this.translate('pages.upgrade.priceCaption')}
                    </Text>
                </View>

                <Text style={styles.paywallHeroSubtitle}>
                    {this.translate('pages.upgrade.benefitsTitle')}
                </Text>
                <View style={styles.paywallBenefitList}>
                    {FOUNDER_BENEFIT_KEYS.map((key) => this.renderBenefit(
                        this.translate(`pages.upgrade.benefits.${key}`),
                        styles.paywallBenefitIcon,
                        styles.paywallBenefitText,
                    ))}
                </View>

                {/* Scarcity is only credible if it is real, so the remaining
                    count comes from the server rather than from a hardcoded
                    number — and the bar is drawn from the same figures. */}
                <View
                    style={styles.paywallSeatTrack}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: 100, now: Math.round(seatFill * 100) }}
                >
                    <View style={[styles.paywallSeatFill, { width: `${Math.round(seatFill * 100)}%` }]} />
                </View>
                <Text style={styles.paywallSeatCaption}>
                    {lifetimeOffer.isSoldOut
                        ? this.translate('pages.upgrade.soldOut')
                        : this.translate('pages.upgrade.seatsRemaining', {
                            remaining: formatSeatCount(lifetimeOffer.remaining, locale),
                            total: formatSeatCount(lifetimeOffer.total, locale),
                        })}
                </Text>

                {canPurchase && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isPurchasing, busy: isPurchasing }}
                        disabled={isPurchasing}
                        style={({ pressed }) => [
                            styles.paywallHeroCta,
                            (pressed || isPurchasing) && styles.pressedOpacity,
                        ]}
                        onPress={this.handlePurchase}
                    >
                        {isPurchasing && (
                            <ActivityIndicator
                                size="small"
                                color={this.themeHabits.colors.brandDark}
                                style={styles.paywallCtaSpinner}
                            />
                        )}
                        <Text style={styles.paywallHeroCtaText}>
                            {isPurchasing
                                ? this.translate('pages.upgrade.purchasing')
                                : (localizedPrice
                                    ? this.translate('pages.upgrade.buyCta', { price: localizedPrice })
                                    : this.translate('pages.upgrade.buyCtaNoPrice'))}
                        </Text>
                    </Pressable>
                )}

                {/* Under a button: how it is billed. With no button (store not
                    configured, or a platform without receipt verification):
                    why there is none, in place of a promise about billing. */}
                <Text style={styles.paywallHeroFootnote}>
                    {canPurchase || lifetimeOffer.isSoldOut
                        ? this.translate('pages.upgrade.billingFootnote')
                        : this.translate('pages.upgrade.unavailable')}
                </Text>
            </LinearGradient>
        );
    };

    /**
     * The monthly plan. Deliberately the quieter of the two: its job is as much
     * to make "once" look good as to sell itself. When the founder offer is
     * gone it is the only thing for sale and takes the primary fill.
     */
    renderMonthlyCard = (canSubscribe: boolean, isFounderAvailable: boolean) => {
        const { habits } = this.props;
        const { isSubscribing, premiumPrice } = this.state;
        const premiumOffer = habits.premiumOffer;
        const { styles } = this.themeHabits;

        if (!premiumOffer) {
            return null;
        }

        const isStoreReachable = premiumOffer.isStoreConfigured && isBillingSupported();
        const anchorMonths = isFounderAvailable
            ? getFounderValueAnchorMonths(this.founderProduct, this.premiumProduct)
            : null;

        return (
            <>
                {isFounderAvailable && (
                    <View style={styles.paywallDividerRow}>
                        <View style={styles.paywallDividerLine} />
                        <Text style={styles.paywallDividerText}>
                            {this.translate('pages.upgrade.orDivider')}
                        </Text>
                        <View style={styles.paywallDividerLine} />
                    </View>
                )}
                <View style={[styles.paywallPlanCard, !isFounderAvailable && styles.paywallPlanCardStandalone]}>
                    <View style={styles.paywallPlanHeader}>
                        <Text style={styles.paywallPlanName}>
                            {this.translate('pages.upgrade.premium.planName')}
                        </Text>
                        {!!premiumPrice && (
                            <View style={styles.paywallPlanPriceRow}>
                                <Text style={styles.paywallPlanPrice}>{premiumPrice}</Text>
                                <Text style={styles.paywallPlanPriceSuffix}>
                                    {this.translate('pages.upgrade.premium.priceSuffix')}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.paywallPlanSubtitle}>
                        {this.translate('pages.upgrade.premium.subtitle')}
                    </Text>
                    <View style={styles.paywallBenefitList}>
                        {PREMIUM_BENEFIT_KEYS.map((key) => this.renderBenefit(
                            this.translate(`pages.upgrade.premium.benefits.${key}`),
                            styles.paywallPlanBenefitIcon,
                            styles.paywallPlanBenefitText,
                        ))}
                    </View>

                    {canSubscribe && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isSubscribing, busy: isSubscribing }}
                            disabled={isSubscribing}
                            style={({ pressed }) => [
                                styles.paywallSecondaryCta,
                                !isFounderAvailable && styles.paywallSecondaryCtaFilled,
                                (pressed || isSubscribing) && styles.pressedOpacity,
                            ]}
                            onPress={this.handleSubscribe}
                        >
                            {isSubscribing && (
                                <ActivityIndicator
                                    size="small"
                                    color={isFounderAvailable
                                        ? this.themeHabits.colors.brand
                                        : this.themeHabits.colors.onBrand}
                                    style={styles.paywallCtaSpinner}
                                />
                            )}
                            <Text style={[
                                styles.paywallSecondaryCtaText,
                                !isFounderAvailable && styles.paywallSecondaryCtaTextFilled,
                            ]}>
                                {isSubscribing
                                    ? this.translate('pages.upgrade.premium.subscribing')
                                    : (premiumPrice
                                        ? this.translate('pages.upgrade.premium.buyCta', { price: premiumPrice })
                                        : this.translate('pages.upgrade.premium.buyCtaNoPrice'))}
                            </Text>
                        </Pressable>
                    )}

                    {/* The store is configured but the product (or its offer
                        token) did not come back — the button would dead-end,
                        so say so, in the card's own voice rather than the
                        screen-wide "offer unavailable" line. */}
                    {!canSubscribe && isStoreReachable && (
                        <Text style={styles.paywallPlanFootnote}>
                            {this.translate('pages.upgrade.premium.unavailable')}
                        </Text>
                    )}

                    {canSubscribe && !!anchorMonths && (
                        <Text style={styles.paywallPlanFootnote}>
                            {this.translate('pages.upgrade.valueAnchor', { months: anchorMonths })}
                        </Text>
                    )}
                </View>
            </>
        );
    };

    renderStatusCard = (title: string, body: string, buttonLabel: string) => {
        const { styles } = this.themeHabits;

        return (
            <View style={styles.paywallStatusCard}>
                <View style={styles.paywallStatusIconCircle}>
                    <FontAwesome5Icon name="check" size={26} style={styles.paywallStatusIcon} />
                </View>
                <Text style={styles.paywallStatusTitle}>{title}</Text>
                <Text style={styles.paywallStatusBody}>{body}</Text>
                <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                        styles.emptyStateActionButton,
                        pressed && styles.pressedOpacity,
                    ]}
                    onPress={this.handleNotNow}
                >
                    <Text style={styles.emptyStateActionLabel}>{buttonLabel}</Text>
                </Pressable>
            </View>
        );
    };

    render() {
        const { habits } = this.props;
        const { isLoading, isPremiumReady } = this.state;
        const lifetimeOffer = habits.lifetimeOffer;
        const premiumOffer = habits.premiumOffer;
        const { styles } = this.themeHabits;

        const isEntitled = !!lifetimeOffer?.isEntitled || !!premiumOffer?.isEntitled;
        const hasAnyOffer = !!lifetimeOffer || !!premiumOffer;

        const canPurchase = !!lifetimeOffer
            && !isEntitled
            && !lifetimeOffer.isSoldOut
            && lifetimeOffer.isStoreConfigured
            && isBillingSupported();

        const canSubscribe = !!premiumOffer
            && !isEntitled
            && premiumOffer.isStoreConfigured
            && isPremiumReady
            && isBillingSupported();

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]} style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colors.backgroundGray }]}>
                    <ScrollView contentContainerStyle={styles.paywallScrollContent}>
                        {this.renderHeader()}

                        {isLoading && (
                            <View style={styles.paywallLoading}>
                                <ActivityIndicator size="large" color={this.themeHabits.colors.primary} />
                            </View>
                        )}

                        {/* Both offer calls can fail — offline, or an app build
                            that reached Play ahead of the backend. Without this
                            branch the screen renders a title and nothing else,
                            including no way back, which strands anyone the 402
                            sent here. */}
                        {!isLoading && !hasAnyOffer && this.renderStatusCard(
                            this.translate('pages.upgrade.unavailableTitle'),
                            this.translate('pages.upgrade.unavailable'),
                            this.translate('pages.upgrade.notNow'),
                        )}

                        {!isLoading && isEntitled && this.renderStatusCard(
                            this.translate('pages.upgrade.entitledTitle'),
                            (() => {
                                const owned = getOwnedCopy(lifetimeOffer, premiumOffer);
                                return this.translate(owned.key, owned.params);
                            })(),
                            this.translate('pages.upgrade.done'),
                        )}

                        {!isLoading && !isEntitled && this.renderFounderCard(canPurchase)}

                        {!isLoading && !isEntitled && this.renderMonthlyCard(canSubscribe, canPurchase)}

                        {!isLoading && hasAnyOffer && !isEntitled && (
                            <Pressable
                                accessibilityRole="button"
                                style={({ pressed }) => [
                                    styles.paywallTextLink,
                                    pressed && styles.pressedOpacity,
                                ]}
                                onPress={this.handleNotNow}
                            >
                                <Text style={styles.paywallTextLinkLabel}>
                                    {this.translate('pages.upgrade.notNow')}
                                </Text>
                            </Pressable>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(UpgradePaywall);

