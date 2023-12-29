// eslint-disable-next-line import/extensions
import emailValidator from 'therr-js-utilities/email-validator';
import logSpan from 'therr-js-utilities/log-or-update-span'; // eslint-disable-line import/order
import { awsSES } from '../aws';
import Store from '../../store';
import { getHostContext } from '../../constants/hostContext';

export interface ISendEmailConfig {
    charset?: string;
    html: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

const failsafeBlackListRequest = (email) => Promise.all([
    Store.blacklistedEmails.get({
        email,
    }),
    Store.users.getUserByEmail(email).then((results) => results?.[0]),
]).catch((err) => {
    console.log(err);
    return [];
});

export default (config: ISendEmailConfig) => new Promise((resolve, reject) => {
    const contextConfig = getHostContext(config.agencyDomainName);
    const params = {
        Content: {
            Simple: {
                Body: {
                    Html: {
                        Data: config.html,
                        Charset: config.charset || 'UTF-8',
                    },
                },
                Subject: {
                    Data: config.subject,
                    Charset: config.charset || 'UTF-8',
                },
            },
        },
        Destination: {
            // BccAddresses: [
            //     'STRING_VALUE',
            // ],
            // CcAddresses: [
            //     'STRING_VALUE',
            // ],
            ToAddresses: config.toAddresses,
        },
        FromEmailAddress: contextConfig.emailTemplates.fromEmail,
    };

    if (!config.toAddresses?.length) {
        resolve({});
        return;
    }

    // TODO: Validate email before sending
    failsafeBlackListRequest(config.toAddresses[0]).then(([blacklistedEmails, userDetails]) => {
        // Skip if email is on bounce list or complaint list
        // Also skip if user account is unclaimed
        const emailIsBlacklisted = blacklistedEmails?.length || userDetails?.isUnclaimed;
        if (emailValidator.validate(config.toAddresses[0]) && !emailIsBlacklisted) {
            return awsSES.sendEmail(params, (err, data) => {
                if (err) {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error sending email', err?.message],
                        traceArgs: {
                            'email.messageId': data?.MessageId,
                        },
                    });
                    // NOTE: Always resolve, even if there is an error to prevent the API from failing
                    return resolve(data);
                }
                resolve(data);
            });
        }

        console.warn(`Email is blacklisted/invalid or account is unclaimed: ${config.toAddresses[0]}`);

        return resolve({});
    });
});
