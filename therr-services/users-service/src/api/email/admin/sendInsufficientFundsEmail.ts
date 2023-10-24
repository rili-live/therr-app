/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
// import * as globalConfig from '../../../../../global-config';
import templateString from '../template';

export interface ISendInsufficientFundsEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    userName: string;
    coinTotal: string;
    email: string;
    spaceName: string;
}

// TODO: Localize email
export default (emailParams: ISendInsufficientFundsEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Insufficient Funds for Rewards Transfer',
        dearUser: 'Dear Admin',
        body1: `Space ${templateParams.spaceName} owned by user, ${templateParams.email}, need more funds. Send them an email to update their campaign. Coin total request, ${templateParams.coinTotal}`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};
