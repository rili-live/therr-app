/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
// import * as globalConfig from '../../../../../global-config';
import templateString from '../template';

export interface ISendUserFeedbackEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    feedback: string;
    fromUserId: string;
}

// TODO: Localize email
export default (emailParams: ISendUserFeedbackEmailConfig, templateParams: any) => {
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Therr App: New Feedback',
        dearUser: `Hello from userId ${templateParams.fromUserId},`,
        body1: `Feedback: ${templateParams.feedback}`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};
