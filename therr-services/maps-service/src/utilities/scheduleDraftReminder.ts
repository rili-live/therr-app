import { PushNotifications } from 'therr-js-utilities/constants';
import { internalRestRequest } from 'therr-js-utilities/internal-rest-request';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../../global-config';
import Store from '../store';

const DRAFT_REMINDER_DELAY_MS = 60 * 60 * 1000;

interface IScheduleDraftReminderParams {
    authorization: string;
    brandVariation: string;
    locale: string;
    momentId: string;
    platform: string;
    userDeviceToken: string;
    userId: string;
    whiteLabelOrigin: string;
}

const sendDraftReminder = ({
    authorization,
    brandVariation,
    locale,
    momentId,
    platform,
    userDeviceToken,
    userId,
    whiteLabelOrigin,
}: IScheduleDraftReminderParams) => {
    if (!userDeviceToken) {
        return Promise.resolve();
    }

    const internalHeaders = {
        authorization,
        'x-brand-variation': brandVariation,
        'x-localecode': locale,
        'x-platform': platform,
        'x-therr-origin-host': whiteLabelOrigin,
        'x-userid': userId,
    };

    return Store.moments.findMoments(internalHeaders, [momentId], { fromUserId: userId })
        .then(({ moments }) => {
            const moment = moments?.[0];
            if (!moment || !moment.isDraft) {
                return undefined;
            }

            return internalRestRequest({
                headers: internalHeaders,
            }, {
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}/notifications/send`,
                headers: {
                    authorization,
                    'x-brand-variation': brandVariation,
                    'x-localecode': locale,
                    'x-therr-origin-host': whiteLabelOrigin,
                    'x-userid': userId,
                },
                data: {
                    area: { id: momentId },
                    postType: 'moments',
                    toUserDeviceToken: userDeviceToken,
                    type: PushNotifications.Types.completeDraftReminder,
                },
            });
        })
        .catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to send draft reminder push notification'],
                traceArgs: {
                    'error.message': err?.message,
                    'error.response': err?.response?.data,
                    'moment.id': momentId,
                    'user.id': userId,
                },
            });
        });
};

const scheduleDraftReminder = (params: IScheduleDraftReminderParams) => {
    if (!params.userDeviceToken || !params.momentId) {
        return;
    }

    const timer = setTimeout(() => {
        sendDraftReminder(params);
    }, DRAFT_REMINDER_DELAY_MS);

    // unref so a pending reminder doesn't keep the process alive during shutdown
    if (typeof timer?.unref === 'function') {
        timer.unref();
    }
};

export default scheduleDraftReminder;
