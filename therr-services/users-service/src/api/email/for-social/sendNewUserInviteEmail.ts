/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendNewUserInviteEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    fromName: string;
    fromEmail: string;
    toEmail: string;
    verificationCodeToken: string;
    oneTimePassword: string;
}

export default (emailParams: ISendNewUserInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const linkUrl = `${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}`;

    const htmlConfig = {
        header: translate(locale, 'emails.newUserInvite.header'),
        dearUser: translate(locale, 'emails.newUserInvite.dearUser', { toEmail: templateParams.toEmail }),
        body1: translate(locale, 'emails.newUserInvite.body1', { fromName: templateParams.fromName, fromEmail: templateParams.fromEmail }),
        body2: translate(locale, 'emails.newUserInvite.body2'),
        bodyBold: templateParams.oneTimePassword,
        buttonHref: linkUrl,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: translate(locale, 'emails.newUserInvite.postBody1', { linkUrl }),
        fromEmailTitle: `${templateParams.fromName}, ${contextConfig.brandName}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
