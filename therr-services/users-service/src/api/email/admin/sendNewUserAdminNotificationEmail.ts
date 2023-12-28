/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';

export interface ISendNewUserAdminNotificationEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
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
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const template = Handlebars.compile(templateString);
    const dearUser = templateParams.inviterEmail
        ? `Welcome the new user, ${templateParams.name}, invited by ${templateParams.inviterEmail}!`
        : `Welcome the new user, ${templateParams.name}!`;
    const htmlConfig = {
        header: 'Therr App: New User Registration 🎉',
        dearUser,
        body1: `A new user signed up for the app 🎉 (${JSON.stringify(accountTypeParams)})`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    });
};
