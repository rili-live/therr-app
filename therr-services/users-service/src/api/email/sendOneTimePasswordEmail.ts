/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';
import translate from '../../utilities/translator';

export interface ISendOneTimePasswordConfig {
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

export default (emailParams: ISendOneTimePasswordConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const linkUrl = isDashboardRegistration
        ? `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`
        : `${globalConfig[process.env.NODE_ENV].hostFull}/login`;
    const htmlConfig = {
        header: translate(locale, 'emails.oneTimePassword.header', { brandName: contextConfig.brandName }),
        dearUser: translate(locale, 'emails.oneTimePassword.dearUser', { name: templateParams.name }),
        body1: translate(locale, 'emails.oneTimePassword.body1'),
        body2: translate(locale, 'emails.oneTimePassword.body2'),
        bodyBold: templateParams.oneTimePassword,
        buttonHref: linkUrl,
        buttonText: translate(locale, 'emails.oneTimePassword.buttonText'),
    };

    return sendEmail({
        ...emailParams,
        subject: translate(locale, 'emails.oneTimePassword.subject', { brandShortName: contextConfig.brandShortName }),
    }, htmlConfig);
};
