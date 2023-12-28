/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from './sendEmail';
// import * as globalConfig from '../../../../../global-config';
import templateString from './template';

export interface ISendCoinsReceivedEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    userName: string;
    coinTotal: string;
}

// TODO: Localize email
export default (emailParams: ISendCoinsReceivedEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'You earned TherrCoins!',
        dearUser: `Congratulations, ${templateParams.userName}!`,
        body1: `You just claimed ${templateParams.coinTotal} TherrCoin(s) for helping support local businesses! Thanks for being a valuable member of their community.`,
        footerImageName: 'email-header-3.jpg',
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};
