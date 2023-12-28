/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';

export interface ISendSpaceClaimRequestEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    address: string;
    latitude: string;
    longitude: string;
    title: string;
    description: string;
    userId: string;
}

export default (emailParams: ISendSpaceClaimRequestEmailConfig, templateParams: ITemplateParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const template = Handlebars.compile(templateString);
    const dearUser = 'Urgent Request!';
    const htmlConfig = {
        header: 'New Business Space Request 🎉',
        dearUser,
        body1: `User ${templateParams.userId} requested to claim a space (${JSON.stringify(templateParams)})`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    });
};
