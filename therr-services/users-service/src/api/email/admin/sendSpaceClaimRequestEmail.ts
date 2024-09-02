/* eslint-disable max-len */
import sendEmail from '../sendEmail';

export interface ISendSpaceClaimRequestEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
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
    const dearUser = 'Urgent Request!';
    const htmlConfig = {
        header: 'New Business Space Request 🎉',
        dearUser,
        body1: `User ${templateParams.userId} requested to claim a space (${JSON.stringify(templateParams)})`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    }, htmlConfig);
};
