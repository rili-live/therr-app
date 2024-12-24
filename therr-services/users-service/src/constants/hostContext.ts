/**
 * See ../getHostContext.ts in therr-client-web-dashboard for similar logic
 */
import * as globalConfig from '../../../../global-config';

interface IBrandConfig {
    host: string;

    // Branding
    brandName: string;
    brandGreeting: string;
    brandGoLinkText: string;
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
        fromEmailTitle: string;
        homepageLinkUri: string;
        logoRelativePath: string;
        logoAltText: string;
        headerImageRelativePath?: string; // 560 x 190
        footerImageRelativePath?: string; // 560 x 190
        unsubscribeUrl?: string;
        legalBusinessName: string;
        businessCopyrightYear: string;
        shouldIncludeSocialIcons?: string;
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
        brandGreeting: 'Hey Therr',
        brandGoLinkText: 'Go Therr',
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
            fromEmail: process.env.AWS_SES_FROM_EMAIL || 'info@therr.com',
            fromEmailTitle: 'Therr App',
            homepageLinkUri: globalConfig[process.env.NODE_ENV].hostFull,
            logoRelativePath: 'assets/images/therr-splash-logo-200.png',
            logoAltText: 'Therr logo',
            unsubscribeUrl: 'https://therr.com/emails/unsubscribe', // TODO: Build an actual route and page for this
            legalBusinessName: 'Therr Inc.',
            businessCopyrightYear: '2021',
            shouldIncludeSocialIcons: 'true',
        },
    },
    'dashboard.therr.com': {
        host: 'dashboard.therr.com',

        // Branding
        brandName: 'Therr for Business',
        brandGreeting: 'Hey Therr',
        brandGoLinkText: 'Go Therr',
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
            fromEmail: process.env.AWS_SES_FROM_EMAIL || 'info@therr.com',
            fromEmailTitle: 'Therr for Business',
            homepageLinkUri: globalConfig[process.env.NODE_ENV].dashboardHostFull,
            logoRelativePath: 'assets/images/therr-splash-logo-200.png',
            logoAltText: 'Therr For Business logo',
            unsubscribeUrl: 'https://dashboard.therr.com/emails/unsubscribe',
            legalBusinessName: 'Therr Inc.',
            businessCopyrightYear: '2021',
        },
    },
    'adsly.app': {
        host: 'adsly.app',

        // Branding
        brandName: 'Adsly Marketing',
        brandGreeting: 'Hello',
        brandGoLinkText: 'Go Adsly',
        websiteName: 'Adsly Marketing',
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
            brandBackgroundHexDark: '#d45d1c',
            brandBackgroundLight: '#ffffff',
            fromEmail: process.env.AWS_SES_FROM_EMAIL || 'info@therr.com',
            fromEmailTitle: 'Adsly',
            homepageLinkUri: globalConfig[process.env.NODE_ENV].dashboardHostFull,
            logoRelativePath: 'assets/images/adsly-logo.png',
            logoAltText: 'Adsly logo',
            unsubscribeUrl: 'https://dashboard.therr.com/emails/unsubscribe',
            legalBusinessName: 'Therr Inc.',
            businessCopyrightYear: '2021',
        },
    },
    'dashboard.appymeal.com': {
        host: 'dashboard.appymeal.com',

        // Branding
        brandName: 'AppyMeal',
        brandGreeting: 'Hey',
        brandGoLinkText: 'Get Appy',
        websiteName: 'AppyMeal Marketing',
        contactEmail: 'team@appymeal.com',
        instagramHandle: 'appy_meal',
        facebookHandle: 'AppyMealApp',
        twitterHandle: 'AppyMealApp',
        parentHomepageName: 'AppyMeal',
        parentHomepageUrl: 'https://appymeal.net',
        parentAboutUrl: 'https://appymeal.net/local-restaurants',
        parentBlogUrl: 'https://appymeal.net/category/news',
        parentBlogName: 'The Official \'AppyMeal\' Blog',
        parentAppUrl: 'https://appymeal.com/',
        parentAppName: 'AppyMeal Delivery',
        parentContactUrl: 'https://appymeal.net/contact',

        // Email Context
        emailTemplates: {
            brandBackgroundHexDark: '#bf1f2e',
            brandBackgroundLight: '#ffffff',
            fromEmail: 'team@appymeal.com',
            fromEmailTitle: 'AppyMeal',
            homepageLinkUri: 'https://dashboard.appymeal.com',
            logoRelativePath: 'assets/images/appymeal-splash-logo-200.png', // TODO
            logoAltText: 'AppyMeal logo',
            unsubscribeUrl: 'https://dashboard.appymeal.com/emails/unsubscribe', // TODO: Build an actual route and page for this
            legalBusinessName: 'AppyMeal LLC',
            businessCopyrightYear: '2021',
        },
    },
};

export const getHostContext = (host: string, brandVariation?: string) => {
    if (!host) {
        return hostContext['therr.com'];
    }

    // For local dev fallback
    if (host === globalConfig[process.env.NODE_ENV].host) {
        return hostContext['therr.com'];
    }

    // For local dev fallback
    if (host === globalConfig[process.env.NODE_ENV].dashboardHost) {
        return hostContext['dashboard.therr.com'];
    }

    // For incorrect or undefined host fallback
    return (hostContext[host] || hostContext['therr.com']);
};

export default hostContext;
