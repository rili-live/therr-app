/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendDashboardSubscriberIntroEmailConfig {
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

export default (emailParams: ISendDashboardSubscriberIntroEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const linkUrl = `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`;
    const productPlanName = templateParams.productName || 'Business Marketing & Customer Metrics';
    const htmlConfig = {
        header: translate(locale, 'emails.dashboardSubscriberIntro.header', { brandName: contextConfig.brandName }),
        dearUser: translate(locale, 'emails.dashboardSubscriberIntro.dearUser'),
        body1: translate(locale, 'emails.dashboardSubscriberIntro.body1', { productPlanName }),
        body2: translate(locale, 'emails.dashboardSubscriberIntro.body2'),
        body3: translate(locale, 'emails.dashboardSubscriberIntro.body3', { feedbackEmail: process.env.AWS_FEEDBACK_EMAIL_ADDRESS }),
        bodyBold: translate(locale, 'emails.dashboardSubscriberIntro.bodyBold'),
        buttonHref: linkUrl,
        buttonText: translate(locale, 'emails.dashboardSubscriberIntro.buttonText'),
        postBody1: translate(locale, 'emails.dashboardSubscriberIntro.postBody1', { linkUrl }),
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
