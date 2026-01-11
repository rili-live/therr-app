/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';

export interface ISendSSONewUserConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    name: string;
    oneTimePassword: string;
}

// TODO: Localize email
export default (emailParams: ISendSSONewUserConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const linkUrl = isDashboardRegistration
        ? `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`
        : `${globalConfig[process.env.NODE_ENV].hostFull}/login`;
    const htmlConfig = {
        header: `${contextConfig.brandName}: User Account Created`,
        dearUser: `Hi ${templateParams.name},`,
        body1: 'A new user account was successfully created. Click the following link to login, choose a username, and set your password. You can login with SSO or directly with your account password.',
        body2: 'Your temporary, one time password:',
        bodyBold: templateParams.oneTimePassword,
        buttonHref: linkUrl,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${linkUrl}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
