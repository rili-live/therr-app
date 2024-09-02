/* eslint-disable max-len */
import sendEmail from '../sendEmail';
// import * as globalConfig from '../../../../../global-config';

export interface ISendCoinsReceivedEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
    recipientIdentifiers: {
        id: string;
        accountEmail: string;
        settingsEmailReminders: boolean;
    };
}

export interface ITemplateParams {
    userName: string;
    coinTotal: string;
}

// TODO: Localize email
export default (emailParams: ISendCoinsReceivedEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    if (!emailParams.recipientIdentifiers.settingsEmailReminders) {
        return Promise.resolve({});
    }

    const htmlConfig = {
        header: 'You earned TherrCoins!',
        dearUser: `Congratulations, ${templateParams.userName}!`,
        body1: `You just claimed ${templateParams.coinTotal} TherrCoin(s) for helping support local businesses! Thanks for being a valuable member of their community.`,
        footerImageRelativePath: 'assets/images/email-header-3.jpg',
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
