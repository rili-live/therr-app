/**
 * See ../getHostContext.ts in therr-client-web-dashboard for similar logic
 */
import * as globalConfig from '../../../../global-config';

const hostContext = {
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
            brandBackgroundDark: '#1C7F8A',
            brandBackgroundLight: '#ffffff',
            fromEmail: process.env.AWS_SES_FROM_EMAIL,
            hostFull: globalConfig[process.env.NODE_ENV].hostFull,
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
            brandBackgroundDark: '#1C7F8A',
            brandBackgroundLight: '#ffffff',
            fromEmail: process.env.AWS_SES_FROM_EMAIL,
            hostFull: globalConfig[process.env.NODE_ENV].hostFull,
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
