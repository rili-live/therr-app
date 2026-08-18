import express from 'express';
import { AccessLevels } from 'therr-js-utilities/constants';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import authorize, { AccessCheckType } from '../../middleware/authorize';
import { validate } from '../../validation';
import {
    postLocationChangeValidation,
} from './validation/location';
import {
    sendTestPushNotificationValidation,
} from './validation/diagnostics';

const reactionsServiceRouter = express.Router();

// Push diagnostics (SUPER_ADMIN only).
//
// These are the only externally reachable window into push delivery:
// push-notifications-service is internal to the VPC, and its `/notifications/test`
// route is compiled out when NODE_ENV === 'production' — which is exactly where
// delivery problems live, since they depend on deployed credentials and real
// device tokens. See therr-services/push-notifications-service/src/handlers/diagnostics.ts
// and docs/PUSH_NOTIFICATIONS_DEBUGGING.md.
const superAdminOnly = authorize({
    type: AccessCheckType.ALL,
    levels: [
        AccessLevels.SUPER_ADMIN,
    ],
});

reactionsServiceRouter.get('/notifications/diagnostics', superAdminOnly, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.post(
    '/notifications/diagnostics/send-test',
    superAdminOnly,
    sendTestPushNotificationValidation,
    validate,
    handleServiceRequest({
        basePath: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}`,
        method: 'post',
    }),
);

// Reactions
reactionsServiceRouter.post('/location/process-user-location', postLocationChangeValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/location/process-user-background-location', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}`,
    method: 'post',
}));

export default reactionsServiceRouter;
