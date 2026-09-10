import { RequestHandler } from 'express';
import {
    AccessLevels,
    BrandVariations,
    HABITS_LIFETIME_FOUNDER_LIMIT,
    hasHabitsPremiumEntitlement,
} from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import {
    ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED,
    PURCHASE_STATE_PURCHASED,
    PURCHASE_TYPE_TEST,
    acknowledgeProductPurchase,
    getProductPurchase,
    isGooglePlayConfigured,
} from '../api/googlePlay';
import { mergeAccessLevels } from './helpers/checkoutSessionAccessLevels';
import { ILifetimePurchaseRow } from '../store/LifetimePurchasesStore';

/**
 * The Friends with Habits founder offer: one payment, premium for life, for the
 * first N accounts.
 *
 * SOLD THROUGH GOOGLE PLAY BILLING, NOT STRIPE
 *
 * An earlier plan (docs/niche-sub-apps/habits/HABITS_PAYMENT_WORKFLOW.md, since
 * rewritten) routed this through a Stripe checkout page opened in an external
 * browser, to avoid Play's cut. That is defensible for a subscription on an
 * established app, but it trades a 15% fee for policy risk on the exact release
 * we are trying to promote to production, and it requires the app to avoid
 * *mentioning* that an external purchase exists — which is a poor experience
 * for a headline offer. Play Billing is the rail that unambiguously complies.
 *
 * WHAT THE SERVER TRUSTS
 *
 * Nothing the client says about the purchase. The client sends a purchase
 * token; the server asks Play what that token actually is. A client-reported
 * "I bought it" is not evidence, and the token is verified, recorded and
 * acknowledged server-side before any entitlement is granted.
 */

const DEFAULT_PRODUCT_ID = 'habits_lifetime_founder';

const getProductId = (): string => process.env.HABITS_LIFETIME_PRODUCT_ID || DEFAULT_PRODUCT_ID;

/**
 * Project a stored purchase down to the fields a client is allowed to see.
 *
 * The row is not safe to return wholesale. `purchaseToken` is a bearer credential
 * for the purchase — the thing the UNIQUE index and the replay check exist to
 * protect — and `verificationPayload` is Play's raw response, kept for disputes
 * rather than for display. Neither appears in `IHabitsLifetimePurchase`, the
 * shape therr-react declares for this object, so no client needs them and
 * shipping them only widens where a token can leak from (logs, crash reports,
 * response caches).
 *
 * Written as an explicit allowlist rather than a delete-list so a column added to
 * the table later is withheld by default instead of being published by omission.
 */
const serializePurchase = (purchase: ILifetimePurchaseRow | undefined | null) => {
    if (!purchase) {
        return null;
    }

    return {
        id: purchase.id,
        userId: purchase.userId,
        platform: purchase.platform,
        productId: purchase.productId,
        status: purchase.status,
        founderNumber: purchase.founderNumber,
        priceAmountMicros: purchase.priceAmountMicros,
        priceCurrencyCode: purchase.priceCurrencyCode,
        purchasedAt: purchase.purchasedAt,
        acknowledgedAt: purchase.acknowledgedAt,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
    };
};

/**
 * Availability plus the caller's own state, in one call.
 *
 * The paywall needs all of it to render a single screen — how many seats are
 * left, whether this account already owns the unlock, and what its founder
 * number is — and splitting it across endpoints only creates ways for the two
 * halves to disagree on screen.
 */
const getLifetimeOffer: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    try {
        const [claimed, purchase, [user]] = await Promise.all([
            Store.lifetimePurchases.countClaimedFounderSlots(),
            Store.lifetimePurchases.getByUserId(userId),
            Store.users.findUser({ id: userId }, ['accessLevels']),
        ]);

        const remaining = Math.max(HABITS_LIFETIME_FOUNDER_LIMIT - claimed, 0);

        return res.status(200).send({
            productId: getProductId(),
            total: HABITS_LIFETIME_FOUNDER_LIMIT,
            claimed,
            remaining,
            isSoldOut: remaining <= 0,
            // Reported separately from `purchase` because entitlement can come
            // from somewhere else — a SUPER_ADMIN, or a future subscription —
            // and the paywall should stay hidden for those accounts too.
            isEntitled: hasHabitsPremiumEntitlement((user?.accessLevels as string[]) || []),
            purchase: serializePurchase(purchase),
            isStoreConfigured: isGooglePlayConfigured(),
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABITS_LIFETIME_ROUTES:ERROR' });
    }
};

/**
 * Verify a completed Play purchase and grant the lifetime entitlement.
 *
 * Ordering is deliberate and not interchangeable:
 *   1. Verify with Play          — never trust the client's claim.
 *   2. Record the purchase row   — allocates the founder slot atomically and
 *                                  makes a replayed token fail on the UNIQUE
 *                                  index rather than granting twice.
 *   3. Grant the access level    — the thing the user actually paid for.
 *   4. Acknowledge with Play     — last, because Play auto-refunds anything
 *                                  unacknowledged after three days. Failing
 *                                  here leaves an entitled user and a
 *                                  retryable acknowledgement; acknowledging
 *                                  first would risk the reverse, a consumed
 *                                  purchase we never honoured.
 */
const verifyLifetimePurchase: RequestHandler = async (req: any, res: any) => {
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
    // for some other (cheaper, or unrelated) product cannot be presented as the
    // lifetime unlock.
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
            messages: ['Google Play billing is not configured; cannot verify a purchase'],
            traceArgs: { 'user.id': userId },
        });

        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habits.lifetimeVerificationFailed'),
            statusCode: 503,
        });
    }

    try {
        const playPurchase = await getProductPurchase(expectedProductId, purchaseToken);

        if (!playPurchase) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.habits.lifetimePurchaseNotFound'),
                statusCode: 400,
            });
        }

        if (playPurchase.purchaseState !== PURCHASE_STATE_PURCHASED) {
            // Covers both a cancelled purchase and one still pending (deferred
            // payment methods such as cash-on-delivery in some markets). Neither
            // is money in hand, so neither grants anything; the client retries
            // when Play tells it the purchase settled.
            return res.status(409).send({
                error: 'purchase-not-completed',
                message: translate(locale, 'errorMessages.habits.lifetimePurchaseNotCompleted'),
                purchaseState: playPurchase.purchaseState,
            });
        }

        // A token already bound to a different account is the replay case the
        // UNIQUE index exists for. Catching it here gives a clear 409 instead of
        // a constraint violation surfacing as a 500.
        const existingForToken = await Store.lifetimePurchases.getByPurchaseToken(purchaseToken);

        if (existingForToken && existingForToken.userId !== userId) {
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: ['Lifetime purchase token presented by a second account'],
                traceArgs: {
                    'user.id': userId,
                    'purchase.ownerUserId': existingForToken.userId,
                },
            });

            return res.status(409).send({
                error: 'purchase-already-claimed',
                message: translate(locale, 'errorMessages.habits.lifetimeAlreadyClaimed'),
            });
        }

        // A license-tester purchase is not a sale, so it must not consume one of a
        // fixed 5,000 paid founder seats — QA exercising this flow a few dozen
        // times would otherwise quietly sell out part of the offer. The
        // entitlement is still granted: testing the real path is the whole point.
        // Promo and rewarded purchases DO take a slot; those are deliberate grants
        // to real users.
        const isTestPurchase = playPurchase.purchaseType === PURCHASE_TYPE_TEST;

        const { purchase, wasAlreadyRecorded } = await Store.lifetimePurchases.createWithFounderSlot({
            userId,
            platform: platform || 'android',
            productId: expectedProductId,
            purchaseToken,
            orderId: orderId || playPurchase.orderId || null,
            priceAmountMicros: playPurchase.priceAmountMicros ?? null,
            priceCurrencyCode: playPurchase.priceCurrencyCode ?? null,
            purchasedAt: playPurchase.purchaseTimeMillis
                ? new Date(Number(playPurchase.purchaseTimeMillis))
                : null,
            verificationPayload: playPurchase,
        }, HABITS_LIFETIME_FOUNDER_LIMIT, !isTestPurchase);

        if (!wasAlreadyRecorded && isTestPurchase) {
            logSpan({
                level: 'info',
                messageOrigin: 'API_SERVER',
                messages: ['Granted a lifetime entitlement for a Play test purchase; no founder slot consumed'],
                traceArgs: {
                    'user.id': userId,
                    'purchase.id': purchase.id,
                    'purchase.type': playPurchase.purchaseType,
                },
            });
        }

        if (!wasAlreadyRecorded && !isTestPurchase && purchase.founderNumber === null) {
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: ['Lifetime purchase completed after the founder limit was reached; honouring it anyway'],
                traceArgs: {
                    'user.id': userId,
                    'purchase.id': purchase.id,
                    'founder.limit': HABITS_LIFETIME_FOUNDER_LIMIT,
                },
            });
        }

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
            [AccessLevels.HABITS_LIFETIME],
        );

        await Store.users.updateUser({
            accessLevels: JSON.stringify(accessLevels),
        }, { id: userId });

        // Acknowledge last, and never let its failure fail the request: the user
        // is entitled either way, and an unacknowledged purchase is recoverable
        // (Play accepts a repeat acknowledgement) while a 500 here would push
        // the client into a retry loop against an already-granted purchase.
        if (playPurchase.acknowledgementState !== ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED) {
            await acknowledgeProductPurchase(expectedProductId, purchaseToken)
                .then(() => Store.lifetimePurchases.markAcknowledged(purchase.id))
                .catch((err: any) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Failed to acknowledge a Google Play purchase; it will be auto-refunded in 3 days if not retried'],
                        traceArgs: {
                            'error.message': err?.message,
                            'purchase.id': purchase.id,
                            'user.id': userId,
                        },
                    });
                });
        }

        return res.status(wasAlreadyRecorded ? 200 : 201).send({
            purchase: serializePurchase(purchase),
            accessLevels,
            isEntitled: true,
            brandVariation: brandVariation || BrandVariations.HABITS,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABITS_LIFETIME_ROUTES:ERROR' });
    }
};

export {
    getLifetimeOffer,
    verifyLifetimePurchase,
};
