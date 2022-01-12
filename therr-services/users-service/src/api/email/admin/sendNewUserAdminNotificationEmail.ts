/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';

export interface ISendNewUserAdminNotificationEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    name: string;
}

export default (emailParams: ISendNewUserAdminNotificationEmailConfig, templateParams: ITemplateParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Therr App: New User Registration 🎉',
        dearUser: `Welcome the new user, ${templateParams.name}!`,
        body1: 'A new user signed up for the app 🎉',
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    });
};
