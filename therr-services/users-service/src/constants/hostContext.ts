/**
 * See ../getHostContext.ts in therr-client-web-dashboard for similar logic
 */
import * as globalConfig from '../../../../global-config';

interface IBrandConfig {
    host: string;

    // Branding
    brandName: string;
    websiteName: string;
    contactEmail: string;
    instagramHandle: string;
    facebookHandle: string;
    twitterHandle: string;
    parentHomepageName: string;
    parentHomepageUrl: string;
    parentAboutUrl: string;
    parentBlogUrl: string;
    parentBlogName: string;
    parentAppUrl: string;
    parentAppName: string;
    parentContactUrl: string;

    // Email Context
    emailTemplates: {
        brandBackgroundHexDark: string;
        brandBackgroundLight: string;
        fromEmail: string;
        homepageLinkUri: string;
        logoRelativePath: string;
        logoAltText: string;
        headerImageRelativePath?: string; // 560 x 190
        footerImageRelativePath?: string; // 560 x 190
        unsubscribeUrl: string;
        legalBusinessName: string;
        businessCopyrightYear: string;
    }
}

interface IBrandConfigs {
    [key: string]: IBrandConfig
}

const hostContext: IBrandConfigs = {
    'therr.com': {
        host: 'therr.com',

        // Branding
        brandName: 'Therr App',
        websiteName: 'Therr App',
        contactEmail: 'info@therr.com',
        instagramHandle: 'therr.app',
        facebookHandle: 'therrapp',
        twitterHandle: 'therr_app',
        parentHomepageName: 'Therr App',
        parentHomepageUrl: 'https://www.therr.app',
        parentAboutUrl: 'https://www.therr.app/why.html',
        parentBlogUrl: 'https://therr.app/blog',
        parentBlogName: 'The Official \'Therr\' Blog',
        parentAppUrl: 'https://www.therr.app/',
        parentAppName: 'Therr App',
        parentContactUrl: 'https://www.therr.app/#footer',

        // Email Context
        emailTemplates: {
            brandBackgroundHexDark: '#1C7F8A',
            brandBackgroundLight: '#ffffff',
            fromEmail: process.env.AWS_SES_FROM_EMAIL || '"Therr App" <info@therr.com>',
            homepageLinkUri: globalConfig[process.env.NODE_ENV].hostFull,
            logoRelativePath: 'assets/images/therr-splash-logo-200.png',
            logoAltText: 'Therr logo',
            unsubscribeUrl: 'https://therr.com/emails/unsubscribe', // TODO: Build an actual route and page for this
            legalBusinessName: 'Therr Inc.',
            businessCopyrightYear: '2021',
        },
    },
    'dashboard.therr.com': {
        host: 'dashboard.therr.com',

        // Branding
        brandName: 'Therr for Business',
        websiteName: 'Therr for Business',
        contactEmail: 'info@therr.com',
        instagramHandle: 'therr.for.business',
        facebookHandle: 'therr.for.business',
        twitterHandle: 'therr_app',
        parentHomepageName: 'Therr for Business',
        parentHomepageUrl: 'https://business.therr.com',
        parentAboutUrl: 'https://business.therr.com/about',
        parentBlogUrl: 'https://business.therr.com/blog',
        parentBlogName: 'The Official \'Therr For Business\' Blog',
        parentAppUrl: 'https://www.therr.app/',
        parentAppName: 'Therr App',
        parentContactUrl: 'https://business.therr.com/contact',

        // Email Context
        emailTemplates: {
            brandBackgroundHexDark: '#1C7F8A',
            brandBackgroundLight: '#ffffff',
            fromEmail: process.env.AWS_SES_FROM_EMAIL || '"Therr App" <info@therr.com>',
            homepageLinkUri: globalConfig[process.env.NODE_ENV].dashboardHostFull,
            logoRelativePath: 'assets/images/therr-splash-logo-200.png',
            logoAltText: 'Therr For Business logo',
            unsubscribeUrl: 'https://therr.com/emails/unsubscribe', // TODO: Build an actual route and page for this
            legalBusinessName: 'Therr Inc.',
            businessCopyrightYear: '2021',
        },
    },
};

export const getHostContext = (host: string) => {
    // For local dev fallback
    if (host === globalConfig[process.env.NODE_ENV].host) {
        return hostContext['therr.com'];
    }

    // For local dev fallback
    if (host === globalConfig[process.env.NODE_ENV].dashboardHost) {
        return hostContext['dashboard.therr.com'];
    }

    // For incorrect or undefined host fallback
    return (hostContext[host || ''] || hostContext['therr.com']);
};

export default hostContext;
