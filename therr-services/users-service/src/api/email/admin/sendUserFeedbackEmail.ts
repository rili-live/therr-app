/* eslint-disable max-len */
import sendEmail from '../sendEmail';
// import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';

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
    const therrAdminEmails = (process.env.AWS_NOTIFY_ADMIN_EMAIL_ADDRESSES || '').split(',').filter((email) => !!email);
    const contextConfig = getHostContext(emailParams.agencyDomainName);

    const htmlConfig = {
        header: `${contextConfig.brandName}: New Feedback`,
        dearUser: `Hello from userId ${templateParams.fromUserId},`,
        body1: `Feedback: ${templateParams.feedback}`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...therrAdminEmails],
    }, htmlConfig);
};
