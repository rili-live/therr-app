/* eslint-disable quotes */
/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendCampaignApprovedEmailConfig {
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
    campaignName: string;
    integrationTargets: string[];
}

export default (emailParams: ISendCampaignApprovedEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const dearUser = `${contextConfig.brandGreeting},`;
    const htmlConfig = {
        header: translate(locale, 'emails.campaignApproved.header'),
        dearUser,
        body1: translate(locale, 'emails.campaignApproved.body1', { campaignName: templateParams.campaignName, integrationTargets: templateParams.integrationTargets.join(', ') }),
        body2: translate(locale, 'emails.campaignApproved.body2'),
        body3: translate(locale, 'emails.campaignApproved.body3'),
        buttonHref: `${globalConfig[process.env.NODE_ENV].dashboardHostFull}`,
        buttonText: contextConfig.brandGoLinkText,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses],
    }, htmlConfig);
};
