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
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import {
    endBilling,
    finishPurchase,
    fetchFounderProduct,
    getOwnedFounderPurchase,
    initBilling,
    isBillingSupported,
    requestFounderPurchase,
} from '../../utilities/habitsBilling';

interface IUpgradePaywallDispatchProps {
    getLifetimeOffer: Function;
    verifyLifetimePurchase: Function;
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
    localizedPrice: string | null;
}

const mapStateToProps = (state) => ({
    habits: state.habits,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getLifetimeOffer: HabitActions.getLifetimeOffer,
    verifyLifetimePurchase: HabitActions.verifyLifetimePurchase,
    getMe: UsersActions.getMe,
}, dispatch);

const BENEFIT_KEYS = [
    'unlimitedHabits',
    'unlimitedPacts',
    'allFutureFeatures',
    'foundersBadge',
    'noSubscription',
];

/**
 * The founder offer: one payment, premium for life, for the first N accounts.
 *
 * Three independent conditions have to hold before the buy button appears, and
 * each hides it for a different reason:
 *   - the store module is present and the platform is Android (iOS has no
 *     server-side receipt verification yet, so a purchase there could not be
 *     honoured);
 *   - the server reports Play credentials configured (`isStoreConfigured`);
 *   - seats remain.
 *
 * The screen is reachable both from a 402 (`habit-limit-reached`) and from a
 * direct tap, so it reads `route.params.reason` to decide whether to lead with
 * the limit or with the offer.
 */
export class UpgradePaywall extends React.Component<IUpgradePaywallProps, IUpgradePaywallState> {
    private translate: Function;

    private theme = buildStyles();

    private themeHabits = buildHabitStyles();

    constructor(props: IUpgradePaywallProps) {
        super(props);

        this.state = {
            isLoading: true,
            isPurchasing: false,
            localizedPrice: null,
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
        this.props.getLifetimeOffer()
            .then((offer: any) => this.prepareStore(offer))
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
     * Open the store connection and read the real localized price.
     *
     * Also recovers a purchase that completed but was never verified — if the
     * verify call failed (offline, server restart) the user is charged and
     * unentitled, and the only way back is to notice the owned purchase here.
     */
    prepareStore = async (offer: any) => {
        if (!offer?.productId || !isBillingSupported()) {
            return;
        }

        const connected = await initBilling();

        if (!connected) {
            return;
        }

        const product = await fetchFounderProduct(offer.productId);

        if (product) {
            this.setState({
                localizedPrice: product.displayPrice || product.localizedPrice || null,
            });
        }

        if (!offer.purchase && !offer.isEntitled) {
            const owned = await getOwnedFounderPurchase(offer.productId);

            if (owned) {
                await this.verifyAndFinish(owned, { isSilent: true });
            }
        }
    };

    verifyAndFinish = async (purchase: any, options: { isSilent?: boolean } = {}) => {
        const { navigation } = this.props;

        try {
            await this.props.verifyLifetimePurchase({
                platform: 'android',
                purchaseToken: purchase.purchaseToken,
                orderId: purchase.orderId,
            });

            // Acknowledged only after the server recorded the purchase — see
            // the note in `habitsBilling.finishPurchase`.
            await finishPurchase(purchase.rawPurchase);

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
            // A user cancelling out of the Play sheet is not an error worth a
            // toast — it is the second most common outcome of tapping "buy".
            const isCancelled = err?.code === 'E_USER_CANCELLED'
                || `${err?.message || ''}`.toLowerCase().includes('cancel');

            if (!isCancelled) {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.upgrade.errors.purchaseFailed'),
                });
            }
        } finally {
            this.setState({ isPurchasing: false });
        }
    };

    render() {
        const { habits, navigation, route } = this.props;
        const { isLoading, isPurchasing, localizedPrice } = this.state;
        const offer = habits.lifetimeOffer;
        const reason = route?.params?.reason;

        const canPurchase = !!offer
            && !offer.isEntitled
            && !offer.isSoldOut
            && offer.isStoreConfigured
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

                        {/* The offer call can fail — offline, or an app build
                            that reached Play ahead of the backend that serves
                            `/habits/lifetime`. Without this branch the screen
                            renders a title and nothing else, including no way
                            back, which strands anyone the 402 sent here. */}
                        {!isLoading && !offer && (
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

                        {!isLoading && !!offer && (
                            <View style={this.themeHabits.styles.dashboardSection}>
                                <Text style={this.themeHabits.styles.dashboardSectionTitle}>
                                    {this.translate('pages.upgrade.benefitsTitle')}
                                </Text>
                                {BENEFIT_KEYS.map((key) => (
                                    <Text key={key} style={this.themeHabits.styles.dashboardSubtitle}>
                                        {`•  ${this.translate(`pages.upgrade.benefits.${key}`)}`}
                                    </Text>
                                ))}

                                {/* Scarcity is only credible if it is real, so the
                                    remaining count comes from the server rather
                                    than from a hardcoded number. */}
                                {!offer.isSoldOut && (
                                    <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                        {this.translate('pages.upgrade.seatsRemaining', {
                                            remaining: offer.remaining,
                                            total: offer.total,
                                        })}
                                    </Text>
                                )}

                                {offer.isEntitled && (
                                    <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                        {offer.purchase?.founderNumber
                                            ? this.translate('pages.upgrade.ownedWithNumber', {
                                                number: offer.purchase.founderNumber,
                                            })
                                            : this.translate('pages.upgrade.owned')}
                                    </Text>
                                )}

                                {!offer.isEntitled && offer.isSoldOut && (
                                    <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                        {this.translate('pages.upgrade.soldOut')}
                                    </Text>
                                )}

                                {!offer.isEntitled && !offer.isSoldOut && !canPurchase && (
                                    <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                        {this.translate('pages.upgrade.unavailable')}
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
                    </ScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(UpgradePaywall);
