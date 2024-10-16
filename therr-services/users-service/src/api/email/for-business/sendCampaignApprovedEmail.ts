/* eslint-disable quotes */
/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendCampaignApprovedEmailConfig {
    charset?: string;
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
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const dearUser = `${contextConfig.brandGreeting},`;
    const htmlConfig = {
        header: 'Approved! Your ads campaign request was reviewed and accepted',
        dearUser,
        body1: `Your campaign, '${templateParams.campaignName}' will beginning running on the target platforms (${templateParams.integrationTargets.join(', ')}) on the scheduled time and date.`,
        body2: 'Visit the dashboard for a real-time summary of campaign performance.',
        body3: `If you have any questions, don't hesitate to contact support at info@therr.com.`,
        buttonHref: `${globalConfig[process.env.NODE_ENV].dashboardHostFull}`,
        buttonText: contextConfig.brandGoLinkText,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses],
    }, htmlConfig);
};
