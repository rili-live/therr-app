/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendContactInviteEmailConfig {
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
}

export default (emailParams: ISendContactInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const linkUrl = `${globalConfig[process.env.NODE_ENV].hostFull}`;

    const htmlConfig = {
        header: translate(locale, 'emails.contactInvite.header', { fromName: templateParams.fromName }),
        dearUser: translate(locale, 'emails.contactInvite.dearUser', { toEmail: templateParams.toEmail }),
        body1: translate(locale, 'emails.contactInvite.body1', { fromName: templateParams.fromName, fromEmail: templateParams.fromEmail, brandName: contextConfig.brandName }),
        body2: translate(locale, 'emails.contactInvite.body2'),
        buttonHref: linkUrl,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: translate(locale, 'emails.contactInvite.postBody1', { linkUrl }),
        fromEmailTitle: `${templateParams.fromName}, ${contextConfig.brandName}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
