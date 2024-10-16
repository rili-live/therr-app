/* eslint-disable quotes */
/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendClaimApprovedEmailConfig {
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
    spaceName: string;
    spaceId: string;
}

export default (emailParams: ISendClaimApprovedEmailConfig, templateParams: ITemplateParams) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const dearUser = `${contextConfig.brandGreeting},`;
    const htmlConfig = {
        header: 'Approved! Business space request was reviewed and accepted',
        dearUser,
        body1: `The business location you requested ('${templateParams.spaceName}') is now available on Therr app.`,
        body2: `If you have any questions, don't hesitate to contact support at info@therr.com.`,
        postBody1: 'Thank you for contributing to Therr app. Users like you make this dream possible!',
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/spaces/${templateParams.spaceId}`,
        buttonText: contextConfig.brandGoLinkText,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses],
    }, htmlConfig);
};
