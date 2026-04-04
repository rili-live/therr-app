/* eslint-disable quotes */
/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendCampaignPendingReviewEmailConfig {
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
    isPastSchedule: boolean;
    isBeforeSchedule: boolean;
}

export default (emailParams: ISendCampaignPendingReviewEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const dearUser = `${contextConfig.brandGreeting},`;
    const htmlConfig = {
        header: translate(locale, 'emails.campaignPendingReview.header'),
        dearUser,
        body1: translate(locale, 'emails.campaignPendingReview.body1', { campaignName: templateParams.campaignName }),
        body2: translate(locale, 'emails.campaignPendingReview.body2'),
        bodyWarning: templateParams.isPastSchedule ? translate(locale, 'emails.campaignPendingReview.bodyWarning') : undefined,
        bodyBold: translate(locale, 'emails.campaignPendingReview.bodyBold'),
        postBody1: translate(locale, 'emails.campaignPendingReview.postBody1'),
        buttonHref: `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`,
        buttonText: translate(locale, 'emails.campaignPendingReview.buttonText'),
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses],
    }, htmlConfig);
};
