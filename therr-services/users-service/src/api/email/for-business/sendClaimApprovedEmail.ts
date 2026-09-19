import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendClaimApprovedEmailConfig {
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
    spaceName: string;
    spaceId: string;
    /**
     * Which approval this is. A `claim` (a business claiming or creating its own space)
     * is told its business page is live; a `request` (a consumer's "Request a Space"
     * suggestion, published as unclaimed inventory) is thanked for the suggestion and
     * told the owner can claim it — it does not own anything.
     */
    variant?: 'claim' | 'request';
}

export default (emailParams: ISendClaimApprovedEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const keyPrefix = templateParams.variant === 'request' ? 'emails.spaceRequestPublished' : 'emails.claimApproved';

    const dearUser = `${contextConfig.brandGreeting},`;
    const htmlConfig = {
        header: translate(locale, `${keyPrefix}.header`),
        dearUser,
        body1: translate(locale, `${keyPrefix}.body1`, { spaceName: templateParams.spaceName, brandName: contextConfig.brandName }),
        body2: translate(locale, `${keyPrefix}.body2`),
        postBody1: translate(locale, `${keyPrefix}.postBody1`, { brandName: contextConfig.brandName }),
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/spaces/${templateParams.spaceId}`,
        buttonText: contextConfig.brandGoLinkText,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses],
    }, htmlConfig);
};
