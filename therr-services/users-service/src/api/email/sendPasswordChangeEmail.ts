/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';
import translate from '../../utilities/translator';

export interface ISendPasswordChangeEmailConfig {
    charset?: string;
    locale?: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    email: string;
    userName: string;
}

export default (emailParams: ISendPasswordChangeEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const htmlConfig = {
        header: translate(locale, 'emails.passwordChange.header', { brandName: contextConfig.brandName }),
        dearUser: translate(locale, 'emails.passwordChange.dearUser', { userName: templateParams.userName }),
        body1: translate(locale, 'emails.passwordChange.body1'),
        body2: translate(locale, 'emails.passwordChange.body2'),
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/login`,
        buttonText: translate(locale, 'emails.passwordChange.buttonText'),
    };

    return sendEmail({
        ...emailParams,
        subject: translate(locale, 'emails.passwordChange.subject', { brandShortName: contextConfig.brandShortName }),
    }, htmlConfig);
};
