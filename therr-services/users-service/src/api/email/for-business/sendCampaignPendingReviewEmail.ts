/* eslint-disable quotes */
/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendCampaignPendingReviewEmailConfig {
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
    isPastSchedule: boolean;
    isBeforeSchedule: boolean;
}

export default (emailParams: ISendCampaignPendingReviewEmailConfig, templateParams: ITemplateParams) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const dearUser = `${contextConfig.brandGreeting},`;
    const htmlConfig = {
        header: 'Campaign in Review',
        dearUser,
        body1: `Your campaign ('${templateParams.campaignName}') is currently being reviewed. Ads will be published to target providers after successful review.`,
        body2: `Look for a confirmation e-mail in the next few days and/or check the dashboard for insights/metrics. If you have any questions, don't hesitate to contact support at info@therr.com.`,
        bodyWarning: templateParams.isPastSchedule ? 'This campaign is past the scheduled end date. Please update your campaign schedule to continue running ads.' : undefined,
        bodyBold: 'Also, you may edit this campaign at any time during the review process.',
        postBody1: 'Thank you for using Therr for Business! We hope to simplify, streamline, and optimize ads & marketing for our customers! Reach out for feedback while we continue to improve the service offering with weekly updates.',
        buttonHref: `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`,
        buttonText: 'Go to Dashboard',
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses],
    }, htmlConfig);
};
