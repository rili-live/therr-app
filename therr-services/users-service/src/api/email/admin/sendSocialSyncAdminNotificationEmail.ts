/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendSocialSyncAdminNotificationEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    userId: string;
}

export default (emailParams: ISendSocialSyncAdminNotificationEmailConfig, templateParams: ITemplateParams) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const htmlConfig = {
        header: `${contextConfig.brandName}: New Social Sync 🎉`,
        dearUser: `Update the geotags on auto-created moments for user, ${templateParams.userId}!`,
        body1: 'A user created an IG Social Sync 🎉',
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    }, htmlConfig);
};
