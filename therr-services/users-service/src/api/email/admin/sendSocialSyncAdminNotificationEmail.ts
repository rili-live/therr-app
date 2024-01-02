/* eslint-disable max-len */
import sendEmail from '../sendEmail';

export interface ISendSocialSyncAdminNotificationEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    userId: string;
}

export default (emailParams: ISendSocialSyncAdminNotificationEmailConfig, templateParams: ITemplateParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const htmlConfig = {
        header: 'Therr App: New Social Sync 🎉',
        dearUser: `Update the geotags on auto-created moments for user, ${templateParams.userId}!`,
        body1: 'A user created an IG Social Sync 🎉',
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    }, htmlConfig);
};
