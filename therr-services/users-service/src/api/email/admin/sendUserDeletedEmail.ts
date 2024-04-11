/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendUserDeletedEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    userDetails: {
        userId: string;
        userName: string;
    }
}

export default (emailParams: ISendUserDeletedEmailConfig, templateParams: ITemplateParams) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName);

    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const htmlConfig = {
        header: `${contextConfig.brandName}: Account Deleted`,
        dearUser: `User, ${templateParams.userDetails.userName}, with id ${templateParams.userDetails.id} has deleted their account.`,
        body1: `This use deleted their account. Ensure that any user content was also deleted. Details: ${JSON.stringify(templateParams.userDetails)}`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    }, htmlConfig);
};
