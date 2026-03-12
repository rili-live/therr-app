/* eslint-disable max-len */
import sendEmail from '../sendEmail';
// import * as globalConfig from '../../../../../global-config';
import translate from '../../../utilities/translator';

export interface ISendCoinsReceivedEmailConfig {
    charset?: string;
    locale?: string;
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

export default (emailParams: ISendCoinsReceivedEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    if (!emailParams.recipientIdentifiers.settingsEmailReminders) {
        return Promise.resolve({});
    }

    const locale = emailParams.locale || 'en-us';

    const htmlConfig = {
        header: translate(locale, 'emails.coinsReceived.header'),
        dearUser: translate(locale, 'emails.coinsReceived.dearUser', { userName: templateParams.userName }),
        body1: translate(locale, 'emails.coinsReceived.body1', { coinTotal: templateParams.coinTotal }),
        footerImageRelativePath: 'assets/images/email-header-3.jpg',
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
