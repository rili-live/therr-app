/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';
import translate from '../../utilities/translator';

export interface ISendSSONewUserConfig {
    charset?: string;
    locale?: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    name: string;
    oneTimePassword: string;
}

export default (emailParams: ISendSSONewUserConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const brandAppHostFull = contextConfig.emailTemplates.appHostFull;
    let linkUrl: string;
    if (isDashboardRegistration) {
        linkUrl = `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`;
    } else if (brandAppHostFull) {
        linkUrl = `${brandAppHostFull}/login`;
    } else {
        linkUrl = `${globalConfig[process.env.NODE_ENV].hostFull}/login`;
    }
    const htmlConfig = {
        header: translate(locale, 'emails.ssoNewUser.header', { brandName: contextConfig.brandName }),
        dearUser: translate(locale, 'emails.ssoNewUser.dearUser', { name: templateParams.name }),
        body1: translate(locale, 'emails.ssoNewUser.body1'),
        body2: translate(locale, 'emails.ssoNewUser.body2'),
        bodyBold: templateParams.oneTimePassword,
        buttonHref: linkUrl,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: translate(locale, 'emails.ssoNewUser.postBody1', { linkUrl }),
    };

    return sendEmail({
        ...emailParams,
        subject: translate(locale, 'emails.ssoNewUser.subject', { brandShortName: contextConfig.brandShortName }),
    }, htmlConfig);
};
