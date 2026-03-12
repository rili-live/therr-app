/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import translate from '../../../utilities/translator';

export interface ISendDashboardSubscriberUserNotFoundEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
    recipientIdentifiers: {
        id: string;
        accountEmail: string;
    };
}

export interface ITemplateParams {
    productName?: string;
}

export default (emailParams: ISendDashboardSubscriberUserNotFoundEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const linkUrl = `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`;
    const htmlConfig = {
        header: translate(locale, 'emails.dashboardSubscriberUserNotFound.header'),
        dearUser: translate(locale, 'emails.dashboardSubscriberUserNotFound.dearUser'),
        body1: translate(locale, 'emails.dashboardSubscriberUserNotFound.body1'),
        body2: translate(locale, 'emails.dashboardSubscriberUserNotFound.body2'),
        body3: translate(locale, 'emails.dashboardSubscriberUserNotFound.body3'),
        buttonHref: linkUrl,
        buttonText: translate(locale, 'emails.dashboardSubscriberUserNotFound.buttonText'),
        postBody1: translate(locale, 'emails.dashboardSubscriberUserNotFound.postBody1', { linkUrl }),
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
