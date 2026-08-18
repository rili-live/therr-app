/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate, { translateOptional } from '../../../utilities/translator';

export interface ISendContactInviteEmailConfig {
    charset?: string;
    locale?: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    fromName: string;
    fromEmail: string;
    toEmail: string;
    inviteToken?: string;
}

export default (emailParams: ISendContactInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    // Prefer the brand's own host so a niche app's invite does not bounce the recipient to
    // therr.com — same fallback ladder as `sendOneTimePasswordEmail`. Not `parentHomepageUrl`:
    // for Therr that is the marketing site, which does not serve `/invite/link/:token`.
    const hostFull = contextConfig.emailTemplates.appHostFull
        || `${globalConfig[process.env.NODE_ENV].hostFull}`;
    // Magic invite link: pre-fills the invitee's known email and skips the
    // email-verification round-trip on signup. Falls back to the homepage if
    // no token is supplied (e.g. legacy callers).
    const linkUrl = templateParams.inviteToken ? `${hostFull}/invite/link/${templateParams.inviteToken}` : hostFull;

    const htmlConfig = {
        header: translate(locale, 'emails.contactInvite.header', { fromName: templateParams.fromName }),
        dearUser: translate(locale, 'emails.contactInvite.dearUser', { toEmail: templateParams.toEmail }),
        body1: translate(locale, 'emails.contactInvite.body1', { fromName: templateParams.fromName, fromEmail: templateParams.fromEmail, brandName: contextConfig.brandName }),
        // The default pitch — "start exploring your local community" — describes Therr. It is
        // not what a Friends with Habits invite is offering, so brands may override it; those
        // without an override fall back to the shared line.
        body2: translateOptional(locale, `emails.contactInvite.body2ByBrand.${emailParams.brandVariation}`)
            ?? translate(locale, 'emails.contactInvite.body2'),
        buttonHref: linkUrl,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: translate(locale, 'emails.contactInvite.postBody1', { linkUrl }),
        fromEmailTitle: `${templateParams.fromName}, ${contextConfig.brandName}`,
    };

    return sendEmail({
        ...emailParams,
        // Built here rather than taken from the caller, which passed a hard-coded English
        // "... invited you to Therr app" regardless of locale or brand. Every sibling email
        // (verification, one-time password) localizes its own subject the same way.
        subject: translate(locale, 'emails.contactInvite.subject', {
            fromName: templateParams.fromName,
            brandShortName: contextConfig.brandShortName,
        }),
    }, htmlConfig);
};
