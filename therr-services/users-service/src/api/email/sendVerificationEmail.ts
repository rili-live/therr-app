/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';
import translate from '../../utilities/translator';

export interface ISendVerificationEmailConfig {
    charset?: string;
    locale?: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    name: string;
    verificationCodeToken: string;
}

/**
 * Uses the localhost path in developement or applies the brand context to the various environment
 * paths. Ex.) maintains stage. on stage [stage.<some-host>]
 *
 * When `brandAppHostFull` is set, we serve onboarding on a brand-specific subdomain
 * (e.g. https://habits.therr.com) and skip the host-rewrite dance below.
 */
const getLinkUrl = (
    verificationCodeToken: string,
    host: string,
    isDashboardRegistration: boolean,
    brandAppHostFull?: string,
) => {
    if (brandAppHostFull && !isDashboardRegistration) {
        return `${brandAppHostFull}/verify-account?token=${verificationCodeToken}`;
    }
    const isDevelopment = process.env.NODE_ENV === 'development';
    const basePath = isDashboardRegistration
        ? globalConfig[process.env.NODE_ENV].dashboardHostFull
        : globalConfig[process.env.NODE_ENV].hostFull;
    const basePathWithBranding = isDevelopment ? basePath : basePath.replace(/^(stage\.)(.*?)$/, `$1${host}`);

    return `${basePathWithBranding}/verify-account?token=${verificationCodeToken}`;
};

export default (emailParams: ISendVerificationEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const linkUrl = getLinkUrl(
        templateParams.verificationCodeToken,
        contextConfig.host,
        isDashboardRegistration,
        contextConfig.emailTemplates.appHostFull,
    );
    const htmlConfig = {
        header: translate(locale, 'emails.verification.header', { brandName: contextConfig.brandName }),
        dearUser: translate(locale, 'emails.verification.dearUser', { name: templateParams.name }),
        body1: translate(locale, 'emails.verification.body1'),
        buttonHref: linkUrl,
        buttonText: translate(locale, 'emails.verification.buttonText'),
        postBody1: translate(locale, 'emails.verification.postBody1', { linkUrl }),
    };

    return sendEmail({
        ...emailParams,
        subject: translate(locale, 'emails.verification.subject', { brandShortName: contextConfig.brandShortName }),
    }, htmlConfig);
};
