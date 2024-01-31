import Handlebars from 'handlebars';
// eslint-disable-next-line import/extensions
import emailValidator from 'therr-js-utilities/email-validator';
import logSpan from 'therr-js-utilities/log-or-update-span'; // eslint-disable-line import/order
import { awsSES } from '../aws';
import Store from '../../store';
import { getHostContext } from '../../constants/hostContext';
import templateString from './template';
import { createUserEmailToken } from '../../utilities/userHelpers';

type IMessageCategories = 'marketing';

const defaultTherrEmailTemplate = Handlebars.compile(templateString);

export interface ISendEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    recipientIdentifiers?: {
        id: string;
        accountEmail: string;
    };
}

export interface ISendEmailHtmlConfig {
    header: string;
    dearUser?: string;
    body1: string;
    body2?: string;
    body3?: string;
    bodyBold?: string;
    bodyWarning?: string;
    buttonHref?: string;
    buttonText?: string; // Should be defined if buttonHref is defined
    headerImageName?: string;
    postBody1?: string;
    messageCategory?: IMessageCategories;

    // Brand/Agency Specific Params
    brandBackgroundHexDark?: string;
    homepageLinkUri?: string;
    logoAltText?: string;
    logoRelativePath?: string;
    footerImageRelativePath?: string;
    unsubscribeUrl?: string;
    legalBusinessName?: string;
    businessCopyrightYear?: string;

    // E-mail Appearance in Inbox
    fromEmailTitle?: string;
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

export default (
    emailConfig: ISendEmailConfig,
    htmlConfig: ISendEmailHtmlConfig,
    template: Handlebars.TemplateDelegate = defaultTherrEmailTemplate,
) => new Promise((resolve, reject) => {
    const contextConfig = getHostContext(emailConfig.agencyDomainName);
    let unsubscribeUrl = htmlConfig.unsubscribeUrl || contextConfig.emailTemplates.unsubscribeUrl;
    // TODO: Generate user email token based on host context
    const unsubscribeUrlToken = unsubscribeUrl && emailConfig.recipientIdentifiers
        ? createUserEmailToken({
            id: emailConfig.recipientIdentifiers?.id,
            email: emailConfig.recipientIdentifiers?.accountEmail,
        })
        : '';
    // TODO: User better query string param logic
    if (unsubscribeUrlToken && !unsubscribeUrl?.includes('?emailToken')) {
        unsubscribeUrl = `${unsubscribeUrl}?emailToken=${unsubscribeUrlToken}`;
    }

    const sanitizedHtmlConfig: ISendEmailHtmlConfig = {
        ...htmlConfig,
        messageCategory: htmlConfig.messageCategory || 'marketing',
        brandBackgroundHexDark: htmlConfig.brandBackgroundHexDark || contextConfig.emailTemplates.brandBackgroundHexDark,
        homepageLinkUri: htmlConfig.homepageLinkUri || contextConfig.emailTemplates.homepageLinkUri,
        logoAltText: htmlConfig.logoAltText || contextConfig.emailTemplates.logoAltText,
        logoRelativePath: htmlConfig.logoRelativePath || contextConfig.emailTemplates.logoRelativePath,
        footerImageRelativePath: htmlConfig.footerImageRelativePath || contextConfig.emailTemplates.footerImageRelativePath,
        unsubscribeUrl,
        legalBusinessName: htmlConfig.legalBusinessName || contextConfig.emailTemplates.legalBusinessName,
        businessCopyrightYear: htmlConfig.businessCopyrightYear || contextConfig.emailTemplates.businessCopyrightYear,
    };
    const renderedHtml = template(sanitizedHtmlConfig);
    const params = {
        Content: {
            Simple: {
                Body: {
                    Html: {
                        Data: renderedHtml,
                        Charset: emailConfig.charset || 'UTF-8',
                    },
                },
                Subject: {
                    Data: emailConfig.subject,
                    Charset: emailConfig.charset || 'UTF-8',
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
            ToAddresses: emailConfig.toAddresses,
        },
        FromEmailAddress: `"${htmlConfig.fromEmailTitle || contextConfig.emailTemplates.fromEmailTitle}" <${contextConfig.emailTemplates.fromEmail}>`,
    };

    if (!emailConfig.toAddresses?.length) {
        resolve({});
        return;
    }

    // TODO: Validate email before sending
    failsafeBlackListRequest(emailConfig.toAddresses[0]).then(([blacklistedEmails, userDetails]) => {
        // Skip if email is on bounce list or complaint list
        // Also skip if user account is unclaimed
        const emailIsBlacklisted = blacklistedEmails?.length || userDetails?.isUnclaimed;
        if (emailValidator.validate(emailConfig.toAddresses[0]) && !emailIsBlacklisted) {
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

        console.warn(`Email is blacklisted/invalid or account is unclaimed: ${emailConfig.toAddresses[0]}`);

        return resolve({});
    });
});
