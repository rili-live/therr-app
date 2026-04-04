/* eslint-disable max-len */
import sendEmail from './sendEmail';
// import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';
import translate from '../../utilities/translator';

export interface ISendSubscriberVerificationEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

interface ITemplateParams {
    [key: string]: any;
}

// export interface ITemplateParams {}

export default (emailParams: ISendSubscriberVerificationEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const htmlConfig = {
        header: translate(locale, 'emails.subscriberVerification.header', { brandName: contextConfig.brandName }),
        dearUser: translate(locale, 'emails.subscriberVerification.dearUser'),
        body1: translate(locale, 'emails.subscriberVerification.body1', { brandName: contextConfig.brandName }),
        fromEmailTitle: `${contextConfig.brandName} Newsletter`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
