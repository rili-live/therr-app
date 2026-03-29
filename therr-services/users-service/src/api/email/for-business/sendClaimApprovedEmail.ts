/* eslint-disable quotes */
/* eslint-disable max-len */
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
}

export default (emailParams: ISendClaimApprovedEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const dearUser = `${contextConfig.brandGreeting},`;
    const htmlConfig = {
        header: translate(locale, 'emails.claimApproved.header'),
        dearUser,
        body1: translate(locale, 'emails.claimApproved.body1', { spaceName: templateParams.spaceName, brandName: contextConfig.brandName }),
        body2: translate(locale, 'emails.claimApproved.body2'),
        postBody1: translate(locale, 'emails.claimApproved.postBody1', { brandName: contextConfig.brandName }),
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/spaces/${templateParams.spaceId}`,
        buttonText: contextConfig.brandGoLinkText,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses],
    }, htmlConfig);
};
