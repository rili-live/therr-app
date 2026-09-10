import { RequestHandler } from 'express';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import {
    createMessage,
    describeBrandPushRouting,
    predictAndSendNotification,
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
// Body: { deviceToken, type?, dryRun?, viaProductionPath?, habitName?, partnerName?,
//         streakCount?, fromUserName? }
//
// Builds the real envelope for `type` under the request's brand and either
// validates it against FCM (`dryRun: true`, the default — FCM checks the token
// and credentials without delivering) or actually delivers it.
//
// Two send paths, and the difference matters more than it looks:
//
//   - `viaProductionPath: false` (default) — `sendMessageForBrandRaw`. Echoes the
//     envelope, works for types production would refuse, and is the right tool
//     when you are debugging one handset.
//   - `viaProductionPath: true` — `predictAndSendNotification`, the function every
//     real notification goes through. Applies the SENDABLE_NOTIFICATION_TYPES gate
//     and is fed the same wide `data`/`config` shape the send route builds, so a
//     regression in either is visible here.
//
// The default stays on the raw path so the documented runbook flow is unchanged.
// Automated post-deploy checks should pass `viaProductionPath: true`: the raw path
// reported success throughout the August 2026 outage because it validated an
// envelope production never sends. See docs/PUSH_NOTIFICATIONS_DEBUGGING.md
// § Known sharp edges.
const sendTestPushNotification: RequestHandler = (req, res) => {
    const { brandVariation, locale } = parseHeaders(req.headers);

    const {
        deviceToken,
        type,
        dryRun,
        viaProductionPath,
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

    const useProductionPath = viaProductionPath === true;

    const resolvedType: PushNotifications.Types = type || PushNotifications.Types.newLikeReceived;
    const resolvedBrand = (brandVariation || BrandVariations.THERR) as BrandVariations;

    const syntheticUserId = '00000000-0000-4000-8000-000000000000';

    const notificationData = {
        fromUser: {
            id: syntheticUserId,
            userName: fromUserName,
        },
        // Present-but-undefined on the production path only, mirroring what
        // `predictAndSendPushNotification` builds from a request body whose
        // optional fields were omitted. These keys reaching `createMessage` as
        // `undefined` is precisely the condition that broke every real push in
        // August 2026 while the raw path — which never sets them — stayed green.
        ...(useProductionPath
            ? {
                area: undefined,
                groupId: undefined,
                postType: undefined,
                thought: undefined,
            }
            : {}),
    };

    const messageConfig = {
        deviceToken,
        userId: syntheticUserId,
        userLocale: (locale as string) || 'en-us',
        fromUserName,
        habitName,
        partnerName,
        streakCount,
        ...(useProductionPath
            ? {
                achievementsCount: undefined,
                likeCount: undefined,
                notificationsCount: undefined,
                totalAreasActivated: undefined,
                viewCount: undefined,
                groupName: undefined,
                groupMembersList: undefined,
                previousRecordDays: undefined,
                pactId: undefined,
                pactName: undefined,
                habitId: undefined,
                daysRemaining: undefined,
                freezesRemaining: undefined,
                freezeDaysUsed: undefined,
                dayCount: undefined,
                consistencyPercent: undefined,
                bestStreakCount: undefined,
                rank: undefined,
            }
            : {}),
    };

    const message = createMessage(
        resolvedType,
        notificationData,
        messageConfig,
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

    const send = useProductionPath
        ? predictAndSendNotification(
            resolvedType,
            notificationData,
            messageConfig,
            undefined,
            resolvedBrand,
            req.headers as any,
            { dryRun: isDryRun },
        )
        : sendMessageForBrandRaw(resolvedBrand, message, isDryRun);

    const apnsCaveat = 'A successful messageId means FCM accepted the message. On iOS it can '
        + 'still be dropped by APNS without any error if routing.iosApnsTopic is not '
        + "the receiving build's PRODUCT_BUNDLE_IDENTIFIER.";

    return send
        .then((result) => {
            logSpan({
                level: result.ok ? 'info' : 'warn',
                messageOrigin: 'API_SERVER',
                messages: ['Push diagnostics test send'],
                traceArgs: {
                    'pushNotification.brandVariation': String(resolvedBrand),
                    'pushNotification.type': String(resolvedType),
                    'pushNotification.dryRun': isDryRun,
                    'pushNotification.sendPath': useProductionPath ? 'production' : 'raw',
                    'pushNotification.ok': result.ok,
                    'error.code': result.errorCode,
                },
            });

            return res.status(result.ok ? 200 : 502).send({
                brandVariation: String(resolvedBrand),
                type: String(resolvedType),
                dryRun: isDryRun,
                // Reported on every response, not just when opted in, so a caller
                // reading a green result can see which path produced it.
                sendPath: useProductionPath ? 'production' : 'raw',
                result,
                routing,
                envelope,
                caveat: useProductionPath
                    ? apnsCaveat
                    : `${apnsCaveat} This run used the raw path, which bypasses `
                        + 'predictAndSendNotification: it skips the SENDABLE_NOTIFICATION_TYPES gate '
                        + 'and builds a narrower data map than production does. Pass '
                        + '"viaProductionPath": true to validate the envelope production actually sends.',
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'PUSH_NOTIFICATIONS:DIAGNOSTICS_SEND_ERROR' }));
};

export {
    getPushDiagnostics,
    sendTestPushNotification,
};
