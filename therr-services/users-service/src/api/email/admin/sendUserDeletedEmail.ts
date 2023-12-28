/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';

export interface ISendUserDeletedEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    userId: string;
    userName: string;
}

export default (emailParams: ISendUserDeletedEmailConfig, templateParams: ITemplateParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Therr App: Account Deleted',
        dearUser: `User, ${templateParams.userName}, with id ${templateParams.userId} has deleted their account.`,
        body1: 'This use deleted their account. Ensure that any user content was also deleted.',
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    });
};
