/* eslint-disable quotes */
/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendClaimPendingReviewEmailConfig {
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
}

export default (emailParams: ISendClaimPendingReviewEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const dearUser = `${contextConfig.brandGreeting},`;
    const htmlConfig = {
        header: translate(locale, 'emails.claimPendingReview.header'),
        dearUser,
        body1: translate(locale, 'emails.claimPendingReview.body1', { spaceName: templateParams.spaceName }),
        body2: translate(locale, 'emails.claimPendingReview.body2'),
        bodyBold: translate(locale, 'emails.claimPendingReview.bodyBold'),
        postBody1: translate(locale, 'emails.claimPendingReview.postBody1'),
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/login`,
        buttonText: translate(locale, 'emails.claimPendingReview.buttonText'),
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses],
    }, htmlConfig);
};
