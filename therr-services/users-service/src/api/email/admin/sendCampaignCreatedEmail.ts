/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';

export interface ISendCampaignCreatedEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    userId: string;
    campaignDetails: any;
}

export default (emailParams: ISendCampaignCreatedEmailConfig, templateParams: ITemplateParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const template = Handlebars.compile(templateString);
    const dearUser = 'New Campaign!';
    const htmlConfig = {
        header: 'New Campaign Request 🎉',
        dearUser,
        body1: `User ${templateParams.userId} requested to create a campaign (${JSON.stringify(templateParams.campaignDetails)})`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    });
};
