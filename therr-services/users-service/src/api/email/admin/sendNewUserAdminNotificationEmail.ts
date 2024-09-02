/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendNewUserAdminNotificationEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    name: string;
    inviterEmail?: string;
}

export interface IAccountTypeParams {
    isBusinessAccount: boolean | undefined;
    isCreatorAccount?: boolean | undefined;
    isDashboardRegistration: boolean | undefined;

}

export default (emailParams: ISendNewUserAdminNotificationEmailConfig, templateParams: ITemplateParams, accountTypeParams: IAccountTypeParams) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',').filter((email) => !!email);
    const therrAdminEmails = (process.env.AWS_NOTIFY_ADMIN_EMAIL_ADDRESSES || '').split(',').filter((email) => !!email);
    const dearUser = templateParams.inviterEmail
        ? `Welcome the new user, ${templateParams.name}, invited by ${templateParams.inviterEmail}!`
        : `Welcome the new user, ${templateParams.name}!`;
    const htmlConfig = {
        header: `${contextConfig.brandName}: New User Registration 🎉`,
        dearUser,
        body1: `A new user signed up for the app 🎉 (${JSON.stringify(accountTypeParams)})`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails, ...therrAdminEmails],
    }, htmlConfig);
};
