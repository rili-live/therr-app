import { RequestHandler } from 'express';
import {
    AccessLevels,
    BrandVariations,
    hasHabitsPremiumEntitlement,
} from 'therr-js-utilities/constants';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import {
    IPlaySubscriptionPurchase,
    V2_ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED,
    acknowledgeSubscriptionPurchase,
    getSubscriptionPurchase,
    isEntitlingSubscriptionState,
    isGooglePlayConfigured,
} from '../api/googlePlay';
import { mergeAccessLevels } from './helpers/checkoutSessionAccessLevels';
import { ISubscriptionPurchaseRow } from '../store/SubscriptionPurchasesStore';

/**
 * The Friends with Habits premium tier: $6.99/month, recurring, sold through
 * Google Play Billing.
 *
 * WHY GOOGLE PLAY BILLING, NOT STRIPE
 *
 * A subscription bought inside the Android app for in-app digital content is
 * exactly what Play policy requires to run on Play Billing — routing it through
 * an external Stripe checkout is the policy risk the founder-unlock handler
 * (habitsLifetime.ts) documents at length, and it is worse for a recurring tier
 * than for a one-off. This handler is the recurring sibling of that one: same
 * "trust nothing the client says, verify the token against Play, record it,
 * then grant" shape.
 *
 * WHAT THE ENTITLEMENT IS
 *
 * A verified, entitling subscription grants `AccessLevels.HABITS_PREMIUM`, which
 * every free-tier gate already honours through `hasHabitsPremiumEntitlement`.
 * That access level is deliberately distinct from `HABITS_LIFETIME`: a
 * subscription that lapses must eventually lose HABITS_PREMIUM (via Play's
 * Real-Time Developer Notifications — see docs/WORK_IN_PROGRESS.md), while a
 * lifetime buyer must never be caught by that revocation.
 */

const DEFAULT_PRODUCT_ID = 'habits_premium_monthly';

const getProductId = (): string => process.env.HABITS_PREMIUM_PRODUCT_ID || DEFAULT_PRODUCT_ID;

/**
 * Project a stored subscription down to the fields a client is allowed to see.
 *
 * `purchaseToken` / `linkedPurchaseToken` are bearer credentials for the
 * purchase and `verificationPayload` is Play's raw response kept for disputes;
 * none of them appears in the shape therr-react declares, so no client needs
 * them and shipping them only widens where a token can leak from. Written as an
 * allowlist so a column added later is withheld by default.
 */
const serializeSubscription = (subscription: ISubscriptionPurchaseRow | undefined | null) => {
    if (!subscription) {
        return null;
    }

    return {
        id: subscription.id,
        userId: subscription.userId,
        platform: subscription.platform,
        productId: subscription.productId,
        status: subscription.status,
        subscriptionState: subscription.subscriptionState,
        autoRenewing: subscription.autoRenewing,
        startTime: subscription.startTime,
        expiryTime: subscription.expiryTime,
        orderId: subscription.orderId,
        priceAmountMicros: subscription.priceAmountMicros,
        priceCurrencyCode: subscription.priceCurrencyCode,
        acknowledgedAt: subscription.acknowledgedAt,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
    };
};

/**
 * Pick the line item for the product being verified.
 *
 * A v2 subscription can carry more than one line item (a plan change in flight),
 * so the caller reads expiry/auto-renew from the item that actually matches the
 * SKU rather than blindly taking `lineItems[0]`.
 */
const findLineItem = (playSub: IPlaySubscriptionPurchase, productId: string) => (playSub.lineItems || [])
    .find((item) => item?.productId === productId);

/**
 * Product availability plus the caller's own entitlement state, in one call.
 *
 * The paywall renders a single screen from this — the product to offer, whether
 * this account already has premium, and enough of the current subscription to
 * show "you're subscribed" — and splitting it across endpoints only creates ways
 * for the halves to disagree on screen.
 */
const getPremiumOffer: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation, hasExplicitBrand } = getBrandContext(req.headers);

    // The SKU is a Friends with Habits subscription on a Friends with Habits Play
    // listing; a Therr or Teem client can never complete this purchase, so it must
    // not be offered one.
    //
    // Keyed on `hasExplicitBrand`, NOT on `brandVariation` alone, and the difference
    // decides whether the paywall works at all. getBrandContext defaults a missing or
    // unrecognized `x-brand-variation` to THERR, so testing `brandVariation !== HABITS`
    // would suppress the offer for every client that does not send the header — which
    // is what a legacy install is, and the deployed app cannot be force-updated. The
    // sibling lifetime handler makes the same call the other way round, defaulting a
    // missing brand to HABITS (`brandVariation || BrandVariations.HABITS`). Suppress
    // only when a client has explicitly declared itself as some other brand.
    const isBrandSupported = !hasExplicitBrand || brandVariation === BrandVariations.HABITS;

    try {
        const [subscription, [user]] = await Promise.all([
            Store.subscriptionPurchases.getActiveByUserId(userId),
            Store.users.findUser({ id: userId }, ['accessLevels']),
        ]);

        return res.status(200).send({
            productId: getProductId(),
            // Reported independently of `subscription` because entitlement can
            // come from elsewhere — a SUPER_ADMIN, or a lifetime founder — and
            // the paywall should stay hidden for those accounts too.
            //
            // Answered truthfully even for an unsupported brand: it describes the
            // caller's own account, and the free-tier gates read the access level
            // regardless of which client is asking.
            isEntitled: hasHabitsPremiumEntitlement((user?.accessLevels as string[]) || []),
            // A Habits subscription is not another brand's business to render.
            subscription: isBrandSupported ? serializeSubscription(subscription) : null,
            // Doubles as the "cannot buy here" signal. Deployed clients already hide
            // the CTA on this flag, so reusing it is what makes the guard effective
            // without a client release; `isBrandSupported` below is the honest reason,
            // for a client new enough to read it.
            isStoreConfigured: isBrandSupported && isGooglePlayConfigured(),
            isBrandSupported,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABITS_PREMIUM_ROUTES:ERROR' });
    }
};

/**
 * Verify a completed Play subscription purchase and grant premium.
 *
 * Ordering mirrors the lifetime handler and is not interchangeable:
 *   1. Verify with Play          — never trust the client's claim.
 *   2. Record the subscription   — UNIQUE(purchaseToken) makes a replayed token
 *                                  update in place rather than granting twice,
 *                                  and supersedes any prior active row.
 *   3. Grant the access level    — the thing the user actually paid for.
 *   4. Acknowledge with Play     — last, because Play auto-refunds anything
 *                                  unacknowledged after three days. Failing here
 *                                  leaves an entitled user and a retryable
 *                                  acknowledgement; acknowledging first would
 *                                  risk the reverse.
 */
const verifyPremiumPurchase: RequestHandler = async (req: any, res: any) => {
    const { locale, userId, brandVariation } = parseHeaders(req.headers);
    const {
        platform, productId, purchaseToken, orderId,
    } = req.body;

    if (!purchaseToken || typeof purchaseToken !== 'string') {
        return handleHttpError({
            res,
            message: 'purchaseToken is required',
            statusCode: 400,
        });
    }

    if (platform && platform !== 'android') {
        return handleHttpError({
            res,
            message: `Unsupported purchase platform: ${platform}`,
            statusCode: 400,
        });
    }

    const expectedProductId = getProductId();

    // The product id is validated rather than taken from the client, so a token
    // for some other (cheaper, or unrelated) subscription cannot be presented as
    // the premium tier.
    if (productId && productId !== expectedProductId) {
        return handleHttpError({
            res,
            message: `Unexpected productId: ${productId}`,
            statusCode: 400,
        });
    }

    if (!isGooglePlayConfigured()) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Google Play billing is not configured; cannot verify a subscription'],
            traceArgs: { 'user.id': userId },
        });

        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habits.premiumVerificationFailed'),
            statusCode: 503,
        });
    }

    try {
        const playSub = await getSubscriptionPurchase(purchaseToken);

        if (!playSub) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.habits.premiumPurchaseNotFound'),
                statusCode: 400,
            });
        }

        const lineItem = findLineItem(playSub, expectedProductId);

        // A token that verifies but carries no line item for our SKU is a token
        // for a different subscription — rejected the same way a mismatched
        // productId in the body is.
        if (!lineItem) {
            return handleHttpError({
                res,
                message: `Unexpected productId: ${expectedProductId} not found on subscription`,
                statusCode: 400,
            });
        }

        const expiryTime = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
        const isEntitling = isEntitlingSubscriptionState(playSub.subscriptionState)
            && (!expiryTime || expiryTime.getTime() > Date.now());

        if (!isEntitling) {
            // Covers a pending (deferred payment), on-hold, paused or already
            // expired subscription. None is access we can grant right now; the
            // client retries when Play reports the subscription active.
            return res.status(409).send({
                error: 'subscription-not-active',
                message: translate(locale, 'errorMessages.habits.premiumPurchaseNotActive'),
                subscriptionState: playSub.subscriptionState,
            });
        }

        // A token already bound to a different account is the replay case the
        // UNIQUE index exists for. Catching it here gives a clear 409 instead of
        // a constraint violation surfacing as a 500.
        const existingForToken = await Store.subscriptionPurchases.getByPurchaseToken(purchaseToken);

        if (existingForToken && existingForToken.userId !== userId) {
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: ['Premium subscription token presented by a second account'],
                traceArgs: {
                    'user.id': userId,
                    'subscription.ownerUserId': existingForToken.userId,
                },
            });

            return res.status(409).send({
                error: 'subscription-already-claimed',
                message: translate(locale, 'errorMessages.habits.premiumAlreadyClaimed'),
            });
        }

        const { purchase, wasAlreadyRecorded } = await Store.subscriptionPurchases.upsertByPurchaseToken({
            userId,
            platform: platform || 'android',
            productId: expectedProductId,
            purchaseToken,
            linkedPurchaseToken: playSub.linkedPurchaseToken || null,
            orderId: orderId || playSub.latestOrderId || null,
            status: 'active',
            subscriptionState: playSub.subscriptionState || null,
            autoRenewing: lineItem.autoRenewingPlan?.autoRenewEnabled ?? null,
            startTime: playSub.startTime ? new Date(playSub.startTime) : null,
            expiryTime,
            verificationPayload: playSub,
        });

        // Read accessLevels explicitly. A partially-selected user record makes
        // the merge below see `undefined` and *replace* the array rather than
        // extend it, which strips EMAIL_VERIFIED and locks the account out of
        // login. That has happened before — see docs/WORK_IN_PROGRESS.md § 1.5.
        const [existingUser] = await Store.users.findUser({ id: userId }, ['id', 'accessLevels']);

        if (!existingUser) {
            return handleHttpError({
                res,
                message: `User not found with id ${userId}`,
                statusCode: 404,
            });
        }

        const accessLevels = mergeAccessLevels(
            existingUser.accessLevels,
            [AccessLevels.HABITS_PREMIUM],
        );

        await Store.users.updateUser({
            accessLevels: JSON.stringify(accessLevels),
        }, { id: userId });

        // Acknowledge last, and never let its failure fail the request: the user
        // is entitled either way, and an unacknowledged purchase is recoverable
        // (Play accepts a repeat acknowledgement) while a 500 here would push the
        // client into a retry loop against an already-granted purchase.
        if (playSub.acknowledgementState !== V2_ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED) {
            await acknowledgeSubscriptionPurchase(expectedProductId, purchaseToken)
                .then(() => Store.subscriptionPurchases.markAcknowledged(purchase.id))
                .catch((err: any) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Failed to acknowledge a Google Play subscription; it will be auto-refunded in 3 days if not retried'],
                        traceArgs: {
                            'error.message': err?.message,
                            'subscription.id': purchase.id,
                            'user.id': userId,
                        },
                    });
                });
        }

        return res.status(wasAlreadyRecorded ? 200 : 201).send({
            subscription: serializeSubscription(purchase),
            accessLevels,
            isEntitled: true,
            brandVariation: brandVariation || BrandVariations.HABITS,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABITS_PREMIUM_ROUTES:ERROR' });
    }
};

export {
    getPremiumOffer,
    verifyPremiumPurchase,
};
