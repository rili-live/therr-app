/* eslint-disable max-len */
import sendEmail from '../sendEmail';
// import * as globalConfig from '../../../../../global-config';

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
    const htmlConfig = {
        header: 'Therr App: New Feedback',
        dearUser: `Hello from userId ${templateParams.fromUserId},`,
        body1: `Feedback: ${templateParams.feedback}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
