/* eslint-disable max-len */
import sendEmail from '../sendEmail';

export interface ISendCampaignCreatedEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    userId: string;
    campaignDetails: any;
}

export default (emailParams: ISendCampaignCreatedEmailConfig, templateParams: ITemplateParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const dearUser = 'New Campaign!';
    const htmlConfig = {
        header: 'New Campaign Request 🎉',
        dearUser,
        body1: `User ${templateParams.userId} requested to create a campaign (${JSON.stringify(templateParams.campaignDetails)})`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    }, htmlConfig);
};
