import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
        logAppEvent('habits_paywall_view', {
            userId: this.props.user?.details?.id,
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

    render() {
        const { habits, navigation, route } = this.props;
        const {
            isLoading, isPurchasing, isSubscribing, localizedPrice, premiumPrice, isPremiumReady,
        } = this.state;
        const lifetimeOffer = habits.lifetimeOffer;
        const premiumOffer = habits.premiumOffer;
        const reason = route?.params?.reason;

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
                    <ScrollView contentContainerStyle={this.themeHabits.styles.dashboardScrollContent}>
                        <View style={this.themeHabits.styles.dashboardHeader}>
                            <Text style={this.themeHabits.styles.dashboardGreeting}>
                                {reason === 'habit-limit-reached'
                                    ? this.translate('pages.upgrade.limitTitle')
                                    : this.translate('pages.upgrade.title')}
                            </Text>
                            <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                {reason === 'habit-limit-reached'
                                    ? this.translate('pages.upgrade.limitSubtitle', {
                                        limit: route?.params?.limit ?? '',
                                    })
                                    : this.translate('pages.upgrade.subtitle')}
                            </Text>
                        </View>

                        {isLoading && (
                            <View style={this.themeHabits.styles.emptyStateContainer}>
                                <ActivityIndicator size="large" color={this.themeHabits.colors.primary} />
                            </View>
                        )}

                        {/* Both offer calls can fail — offline, or an app build
                            that reached Play ahead of the backend. Without this
                            branch the screen renders a title and nothing else,
                            including no way back, which strands anyone the 402
                            sent here. */}
                        {!isLoading && !hasAnyOffer && (
                            <View style={this.themeHabits.styles.dashboardSection}>
                                <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                    {this.translate('pages.upgrade.unavailable')}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    style={this.themeHabits.styles.emptyStateActionButton}
                                    onPress={() => navigation.goBack()}
                                >
                                    <Text style={this.themeHabits.styles.emptyStateActionLabel}>
                                        {this.translate('pages.upgrade.notNow')}
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {!isLoading && isEntitled && (
                            <View style={this.themeHabits.styles.dashboardSection}>
                                <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                    {(() => {
                                        const owned = getOwnedCopy(lifetimeOffer, premiumOffer);
                                        return this.translate(owned.key, owned.params);
                                    })()}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    style={this.themeHabits.styles.emptyStateActionButton}
                                    onPress={() => navigation.goBack()}
                                >
                                    <Text style={this.themeHabits.styles.emptyStateActionLabel}>
                                        {this.translate('pages.upgrade.notNow')}
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {/* Founder offer */}
                        {!isLoading && !isEntitled && !!lifetimeOffer && (
                            <View style={this.themeHabits.styles.dashboardSection}>
                                <Text style={this.themeHabits.styles.dashboardSectionTitle}>
                                    {this.translate('pages.upgrade.benefitsTitle')}
                                </Text>
                                {FOUNDER_BENEFIT_KEYS.map((key) => (
                                    <Text key={key} style={this.themeHabits.styles.dashboardSubtitle}>
                                        {`•  ${this.translate(`pages.upgrade.benefits.${key}`)}`}
                                    </Text>
                                ))}

                                {/* Scarcity is only credible if it is real, so the
                                    remaining count comes from the server rather
                                    than from a hardcoded number. */}
                                {!lifetimeOffer.isSoldOut && (
                                    <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                        {this.translate('pages.upgrade.seatsRemaining', {
                                            remaining: lifetimeOffer.remaining,
                                            total: lifetimeOffer.total,
                                        })}
                                    </Text>
                                )}

                                {lifetimeOffer.isSoldOut && (
                                    <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                        {this.translate('pages.upgrade.soldOut')}
                                    </Text>
                                )}

                                {canPurchase && (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityState={{ disabled: isPurchasing }}
                                        disabled={isPurchasing}
                                        style={[
                                            this.themeHabits.styles.emptyStateActionButton,
                                            isPurchasing && { opacity: 0.6 },
                                        ]}
                                        onPress={this.handlePurchase}
                                    >
                                        <Text style={this.themeHabits.styles.emptyStateActionLabel}>
                                            {isPurchasing
                                                ? this.translate('pages.upgrade.purchasing')
                                                : this.translate('pages.upgrade.buyCta', {
                                                    price: localizedPrice || '',
                                                })}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        )}

                        {/* Premium subscription */}
                        {!isLoading && !isEntitled && !!premiumOffer && (
                            <View style={this.themeHabits.styles.dashboardSection}>
                                <Text style={this.themeHabits.styles.dashboardSectionTitle}>
                                    {this.translate('pages.upgrade.premium.sectionTitle')}
                                </Text>
                                <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                    {this.translate('pages.upgrade.premium.subtitle')}
                                </Text>
                                {PREMIUM_BENEFIT_KEYS.map((key) => (
                                    <Text key={key} style={this.themeHabits.styles.dashboardSubtitle}>
                                        {`•  ${this.translate(`pages.upgrade.premium.benefits.${key}`)}`}
                                    </Text>
                                ))}

                                {canSubscribe && (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityState={{ disabled: isSubscribing }}
                                        disabled={isSubscribing}
                                        style={[
                                            this.themeHabits.styles.emptyStateActionButton,
                                            isSubscribing && { opacity: 0.6 },
                                        ]}
                                        onPress={this.handleSubscribe}
                                    >
                                        <Text style={this.themeHabits.styles.emptyStateActionLabel}>
                                            {isSubscribing
                                                ? this.translate('pages.upgrade.premium.subscribing')
                                                : (premiumPrice
                                                    ? this.translate('pages.upgrade.premium.buyCta', {
                                                        price: premiumPrice,
                                                    })
                                                    : this.translate('pages.upgrade.premium.buyCtaNoPrice'))}
                                        </Text>
                                    </Pressable>
                                )}

                                {!canSubscribe && premiumOffer.isStoreConfigured && isBillingSupported() && (
                                    <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                        {this.translate('pages.upgrade.unavailable')}
                                    </Text>
                                )}
                            </View>
                        )}

                        {!isLoading && hasAnyOffer && !isEntitled && (
                            <Pressable
                                accessibilityRole="button"
                                style={this.themeHabits.styles.emptyStateActionButton}
                                onPress={() => navigation.goBack()}
                            >
                                <Text style={this.themeHabits.styles.emptyStateActionLabel}>
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
