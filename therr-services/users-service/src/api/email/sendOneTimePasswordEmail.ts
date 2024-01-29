/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';

export interface ISendOneTimePasswordConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    name: string;
    oneTimePassword: string;
}

// TODO: Localize email
export default (emailParams: ISendOneTimePasswordConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName);
    const linkUrl = isDashboardRegistration
        ? `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`
        : `${globalConfig[process.env.NODE_ENV].hostFull}/login`;
    const htmlConfig = {
        header: `${contextConfig.brandName}: One-time Password`,
        dearUser: `Hi ${templateParams.name},`,
        body1: 'Looks like you forgot your password and requested a reset. Use this temporary password to access your account. After login, you can reset your password from the user settings page.',
        body2: 'Your temporary, one time password:',
        bodyBold: templateParams.oneTimePassword,
        buttonHref: linkUrl,
        buttonText: 'Go to Login',
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
