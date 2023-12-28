/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';

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
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Therr App: New Social Sync 🎉',
        dearUser: `Update the geotags on auto-created moments for user, ${templateParams.userId}!`,
        body1: 'A user created an IG Social Sync 🎉',
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    });
};
