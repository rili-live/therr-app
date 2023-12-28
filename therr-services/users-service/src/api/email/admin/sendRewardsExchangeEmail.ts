/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
// import * as globalConfig from '../../../../../global-config';
import templateString from '../template';

export interface ISendRewardsExchangeEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    amount: number;
    provider: string;
    email: string;
    userId: string;
    userName: string;
}

// TODO: Localize email
export default (emailParams: ISendRewardsExchangeEmailConfig, templateParams: any) => {
    const adminEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Therr App: Rewards Exchange Request',
        dearUser: 'Hello admin,',
        body1: `UserName, ${templateParams.userName}, requested to exchange ${templateParams.amount} coins at rate of $${templateParams.exchangeRate} from ${templateParams.provider}.`,
        body2: `User Email: ${templateParams.userEmail}`,
        bodyBold: `UserId: ${templateParams.userId}`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        toAddresses: adminEmails,
        html,
    });
};
