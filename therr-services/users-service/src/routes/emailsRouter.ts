import * as express from 'express';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { sendVerificationEmail } from '../api/email';
import Store from '../store';
// import {
//     verifyEmail,
// } from '../handlers/email';

const router = express.Router();

// For dev testing only
// router.get('/', (req, res) => {
//     sendVerificationEmail({
//         toAddresses: ['ughxyihcuvcyc@gmail.com'],
//         agencyDomainName: 'therr.com',
//     }, {
//         name: 'Zack',
//         verificationCodeToken: 'foo',
//     })
//         .then(() => res.status(200).send({ message: 'New verification E-mail sent' }));
// });

router.post('/bounced', (req, res) => {
    const {
        Message,
    } = req.body;

    const {
        notificationType,
        bounce,
        complaint,
    } = JSON.parse(Message?.replace('\\"', '') || '{}');

    let promise: Promise<any[]> = Promise.resolve([]);

    if ((notificationType === 'Bounce' || notificationType === 'Complaint') && bounce?.bouncedRecipients?.[0]?.emailAddress) {
        if (bounce?.bounceType === 'Permanent' || bounce?.bounceSubType === 'MailboxFull' || complaint?.complaintFeedbackType === 'abuse') {
            const userEmail = bounce?.bouncedRecipients?.[0]?.emailAddress;
            promise = Store.users.getUserByEmail(userEmail).then(([user]) => {
                if (user) {
                    return Store.users.updateUser({
                        settingsEmailLikes: false,
                        settingsEmailInvites: false,
                        settingsEmailMentions: false,
                        settingsEmailMessages: false,
                        settingsEmailReminders: false,
                        settingsEmailBackground: false,
                        settingsEmailMarketing: false,
                        settingsEmailBusMarketing: false,
                    }, {
                        id: user.id,
                    });
                }

                return [];
            });
        }
    }

    return promise
        .then(([user]) => res.status(200).send({
            message: 'Successfully handled bounced email alert',
            userId: user?.id,
        }))
        .catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Failed handle bounced email'],
                traceArgs: {
                    notificationType,
                    bounceType: bounce?.bounceType,
                    bounceSubType: bounce?.bounceSubType,
                },
            });
            return [];
        });
});

export default router;
