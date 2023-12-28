/* eslint-disable quotes */
/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';
import * as globalConfig from '../../../../../../global-config';

export interface ISendClaimPendingReviewEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    spaceName: string;
}

export default (emailParams: ISendClaimPendingReviewEmailConfig, templateParams: ITemplateParams) => {
    const template = Handlebars.compile(templateString);
    const dearUser = 'Hey Therr,';
    const htmlConfig = {
        header: 'Business Space Request in Review',
        dearUser,
        body1: `The business location you requested ('${templateParams.spaceName}') is currently being reviewed. If your claim is approved, you should receive a confirmation in the next 24-72 hours.`,
        body2: `Look for a confirmation e-mail in the next few days. If you have any questions, don't hesitate to contact support at info@therr.com.`,
        bodyBold: 'Also, you may edit this campaign at any time during the review process.',
        postBody1: 'Thank you for contributing to Therr app. Users like you make this dream possible!',
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/login`,
        buttonText: 'Login to App',
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses],
    });
};
