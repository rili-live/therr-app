/* eslint-disable quotes */
/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import translate from '../../../utilities/translator';

export interface ISendUnclaimedSpaceEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    spaceName: string;
    spaceId: string;
    missingFields?: string[];
}

export default (emailParams: ISendUnclaimedSpaceEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';

    const spaceUrl = `${globalConfig[process.env.NODE_ENV].hostFull}/spaces/${templateParams.spaceId}?claim=true`;
    let body3: string | undefined;
    if (templateParams.missingFields?.length) {
        const intro = translate(locale, 'emails.unclaimedSpace.missingFieldsIntro');
        const fieldLabels = templateParams.missingFields.map(
            (field) => translate(locale, `emails.unclaimedSpace.missingFieldLabels.${field}`) || field,
        );
        body3 = `${intro} ${fieldLabels.join(', ')}.`;
    }

    const htmlConfig: any = {
        header: translate(locale, 'emails.unclaimedSpace.header'),
        preheaderText: translate(locale, 'emails.unclaimedSpace.preheaderText'),
        dearUser: translate(locale, 'emails.unclaimedSpace.dearUser', { spaceName: templateParams.spaceName }),
        body1: translate(locale, 'emails.unclaimedSpace.body1', { spaceName: templateParams.spaceName }),
        body2: translate(locale, 'emails.unclaimedSpace.body2'),
        body3,
        bodyBold: translate(locale, 'emails.unclaimedSpace.bodyBold'),
        postBody1: translate(locale, 'emails.unclaimedSpace.postBody1'),
        buttonHref: spaceUrl,
        buttonText: translate(locale, 'emails.unclaimedSpace.buttonText'),
    };

    return sendEmail({
        ...emailParams,
        subject: emailParams.subject || translate(locale, 'emails.unclaimedSpace.subject', { spaceName: templateParams.spaceName }),
    }, htmlConfig);
};
