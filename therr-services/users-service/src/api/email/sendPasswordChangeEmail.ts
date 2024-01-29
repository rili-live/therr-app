/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';

export interface ISendPasswordChangeEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    email: string;
    userName: string;
}

// TODO: Localize email
export default (emailParams: ISendPasswordChangeEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName);

    const htmlConfig = {
        header: `${contextConfig.brandName}: Password Changed`,
        dearUser: `Hi ${templateParams.userName},`,
        body1: 'Your password has been successfully updated. If you initiated this change, please disregard this e-mail.',
        body2: 'If you did not initiate this change, please contact us immediately to resolve the issue.',
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/login`,
        buttonText: 'Go to Login',
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
