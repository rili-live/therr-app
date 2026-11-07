import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendPactJoinRequestEmailConfig {
    charset?: string;
    locale?: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface IPactJoinRequestEmailItem {
    requesterUserName: string;
    habitName: string;
}

export interface ITemplateParams {
    toName?: string;
    /** Never empty: the digest only emails about requests it has just claimed. */
    requests: IPactJoinRequestEmailItem[];
}

/**
 * The email fallback for join requests the creator has not answered after a day
 * (handlers/helpers/joinRequestEmailDigest.ts). One email covers every request claimed for that
 * creator in the run, so several people asking at once is one email, not several. It points them
 * into the app, where the pact holds the approve/decline buttons — there is no web surface for it.
 *
 * Usernames only, never real names: the requester is someone outside the creator's contacts.
 */
export default (emailParams: ISendPactJoinRequestEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const appUrl = contextConfig.emailTemplates.appHostFull || contextConfig.parentHomepageUrl;
    const { requests } = templateParams;
    const isSingle = requests.length === 1;
    const [first] = requests;

    const headline = isSingle
        ? translate(locale, 'emails.pactJoinRequest.subjectOne', {
            requesterName: first.requesterUserName,
            habitName: first.habitName,
        })
        : translate(locale, 'emails.pactJoinRequest.subjectMany', { count: requests.length });

    const htmlConfig = {
        header: headline,
        dearUser: translate(locale, 'emails.pactJoinRequest.dearUser', { toName: templateParams.toName || '' }),
        body1: isSingle
            ? translate(locale, 'emails.pactJoinRequest.body1One', {
                requesterName: first.requesterUserName,
                habitName: first.habitName,
            })
            : translate(locale, 'emails.pactJoinRequest.body1Many', {
                count: requests.length,
                requestList: requests.map((request) => `${request.requesterUserName} (${request.habitName})`).join(', '),
            }),
        body2: translate(locale, 'emails.pactJoinRequest.body2', { brandName: contextConfig.brandName }),
        buttonHref: appUrl,
        buttonText: translate(locale, 'emails.pactJoinRequest.buttonText', { brandName: contextConfig.brandName }),
        postBody1: translate(locale, 'emails.pactJoinRequest.postBody1'),
        fromEmailTitle: contextConfig.brandName,
        headerImageVariant: 'social' as const,
    };

    return sendEmail({
        ...emailParams,
        subject: headline,
    }, htmlConfig);
};
