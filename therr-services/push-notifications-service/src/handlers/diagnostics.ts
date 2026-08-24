import { RequestHandler } from 'express';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import {
    createMessage,
    describeBrandPushRouting,
    sendMessageForBrandRaw,
} from '../api/firebaseAdmin';

/**
 * Push-notification diagnostics.
 *
 * The delivery chain has five links and, until this existed, four of them were
 * unobservable in production:
 *
 *   1. mobile grants OS permission and FCM issues a device token
 *   2. the token reaches `main.userDeviceTokens` under the *right brand*
 *      (users-service `GET /users/:userId/push-diagnostics` covers this link)
 *   3. push-notifications-service resolves that brand to a Firebase app
 *   4. FCM accepts the message
 *   5. APNS/Android accepts it and the device renders it
 *
 * Link 4 is the only one that ever produced a signal, and
 * `predictAndSendNotification` swallows even that so a bad token can't fail a
 * user-facing request. Link 5 fails *silently by design*: APNS drops a push
 * whose `apns-topic` isn't the receiving app's bundle id and reports nothing
 * back through FCM, so "Push successfully sent" in the logs is compatible with
 * the user seeing nothing at all.
 *
 * These endpoints make links 3–5 inspectable: the exact envelope that would be
 * sent, which Firebase project it goes through, and the raw FCM result.
 *
 * Exposed via the gateway behind SUPER_ADMIN. Deliberately never returns
 * credential material — only a project id and a masked client email, which are
 * enough to tell two service accounts apart in a report.
 */

// GET /v1/notifications/diagnostics
// Reports how each brand's pushes are routed. Uses `x-brand-variation` for the
// `requestedBrand` summary but reports every brand, since the most common real
// finding is that two brands resolve to the same place when they shouldn't (or
// vice versa).
const getPushDiagnostics: RequestHandler = (req, res) => {
    const { brandVariation } = parseHeaders(req.headers);

    try {
        const brands = Object.values(BrandVariations) as BrandVariations[];
        const byBrand = brands.map((brand) => describeBrandPushRouting(brand));

        return res.status(200).send({
            requestedBrand: String(brandVariation || ''),
            // Distinct Firebase projects in play. A single entry means every
            // brand shares one project — which is the supported configuration:
            // one project can host many apps, and one service account can
            // address every app inside its own project.
            distinctFirebaseProjects: Array.from(
                new Set(byBrand.map((b) => b.firebaseProjectId).filter(Boolean)),
            ),
            byBrand,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'PUSH_NOTIFICATIONS:DIAGNOSTICS_ERROR' });
    }
};

// POST /v1/notifications/diagnostics/send-test
// Body: { deviceToken, type?, dryRun?, habitName?, partnerName?, streakCount?, fromUserName? }
//
// Builds the real envelope for `type` under the request's brand and either
// validates it against FCM (`dryRun: true`, the default — FCM checks the token
// and credentials without delivering) or actually delivers it.
const sendTestPushNotification: RequestHandler = (req, res) => {
    const { brandVariation, locale } = parseHeaders(req.headers);

    const {
        deviceToken,
        type,
        dryRun,
        fromUserName = 'Diagnostics',
        habitName = 'Morning run',
        partnerName = 'Diagnostics',
        streakCount = 3,
    } = req.body || {};

    // Opt *out* of the dry run explicitly, rather than defaulting the destructure.
    // A default only fills in for `undefined`, so `{"dryRun": null}` — which a
    // client that always serializes the field will send — would fall through to
    // `!!null` and deliver a real push to a real handset from what reads like the
    // safe default call.
    const isDryRun = dryRun !== false;

    if (!deviceToken) {
        return handleHttpError({
            err: new Error('deviceToken is required'),
            res,
            message: 'deviceToken is required',
            statusCode: 400,
        });
    }

    const resolvedType: PushNotifications.Types = type || PushNotifications.Types.newLikeReceived;
    const resolvedBrand = (brandVariation || BrandVariations.THERR) as BrandVariations;

    const message = createMessage(
        resolvedType,
        {
            fromUser: {
                id: '00000000-0000-4000-8000-000000000000',
                userName: fromUserName,
            },
        },
        {
            deviceToken,
            userId: '00000000-0000-4000-8000-000000000000',
            userLocale: (locale as string) || 'en-us',
            fromUserName,
            habitName,
            partnerName,
            streakCount,
        },
        resolvedBrand,
    );

    if (!message) {
        return handleHttpError({
            err: new Error(`createMessage returned false for type "${resolvedType}"`),
            res,
            message: `Unsupported notification type "${resolvedType}". `
                + 'It has no case in createMessage, so nothing would ever be sent for it.',
            statusCode: 400,
        });
    }

    const routing = describeBrandPushRouting(resolvedBrand);

    // Echo the envelope minus the token so the caller can see exactly what was
    // addressed where — particularly `apns.headers['apns-topic']`, the field
    // whose mismatch is invisible everywhere else.
    const envelope = { ...(message as any) };
    delete envelope.token;

    return sendMessageForBrandRaw(resolvedBrand, message, isDryRun)
        .then((result) => {
            logSpan({
                level: result.ok ? 'info' : 'warn',
                messageOrigin: 'API_SERVER',
                messages: ['Push diagnostics test send'],
                traceArgs: {
                    'pushNotification.brandVariation': String(resolvedBrand),
                    'pushNotification.type': String(resolvedType),
                    'pushNotification.dryRun': isDryRun,
                    'pushNotification.ok': result.ok,
                    'error.code': result.errorCode,
                },
            });

            return res.status(result.ok ? 200 : 502).send({
                brandVariation: String(resolvedBrand),
                type: String(resolvedType),
                dryRun: isDryRun,
                result,
                routing,
                envelope,
                // The one thing an FCM success cannot tell you.
                caveat: 'A successful messageId means FCM accepted the message. On iOS it can '
                    + 'still be dropped by APNS without any error if routing.iosApnsTopic is not '
                    + "the receiving build's PRODUCT_BUNDLE_IDENTIFIER.",
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'PUSH_NOTIFICATIONS:DIAGNOSTICS_SEND_ERROR' }));
};

export {
    getPushDiagnostics,
    sendTestPushNotification,
};
