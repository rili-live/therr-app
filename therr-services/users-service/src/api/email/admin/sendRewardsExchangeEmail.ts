/* eslint-disable max-len */
import sendEmail from '../sendEmail';
// import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendRewardsExchangeEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    amount: number;
    provider: string;
    email: string;
    userId: string;
    userName: string;
}

// TODO: Localize email
export default (emailParams: ISendRewardsExchangeEmailConfig, templateParams: any) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const adminEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const htmlConfig = {
        header: `${contextConfig.brandName}: Rewards Exchange Request`,
        dearUser: 'Hello admin,',
        body1: `UserName, ${templateParams.userName}, requested to exchange ${templateParams.amount} coins at rate of $${templateParams.exchangeRate} from ${templateParams.provider}.`,
        body2: `User Email: ${templateParams.userEmail}`,
        bodyBold: `UserId: ${templateParams.userId}`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: adminEmails,
    }, htmlConfig);
};
