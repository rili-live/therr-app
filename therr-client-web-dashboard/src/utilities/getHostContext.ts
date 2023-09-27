interface IBrandConfig {
    brandName: string;
    websiteName: string;
    host: string;
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
    faviconFileName: string;
    metaImageFileName: string;
    mobileLogoFileName: string;
}

interface IBrandConfigs {
    [key: string]: IBrandConfig
}

const brandConfigs: IBrandConfigs = {
    'dashboard.therr.com': {
        brandName: 'Therr for Business',
        websiteName: 'Therr for Business',
        host: 'dashboard.therr.com',
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
        faviconFileName: 'favicon.ico',
        metaImageFileName: 'therr-for-business-logo.png',
        mobileLogoFileName: 'therr-logo.svg',
    },
    'dashboard.appymeal.com': {
        brandName: 'AppyMeal',
        websiteName: 'AppyMeal Marketing',
        host: 'dashboard.appmeal.com',
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
        faviconFileName: 'favicon-appymeal.ico',
        metaImageFileName: 'meta-image-appymeal.png',
        mobileLogoFileName: 'appymeal-logo.svg',
    },
    'adsorchestra.com': {
        brandName: 'Ads Orchestra',
        websiteName: 'Ads Orchestra AI',
        host: 'adsorchestra.com',
        contactEmail: 'info@therr.com',
        instagramHandle: 'therr.for.business',
        facebookHandle: 'therr.for.business',
        twitterHandle: 'therr_app',
        parentHomepageName: 'Ads Orchestra',
        parentHomepageUrl: 'https://business.therr.com',
        parentAboutUrl: 'https://business.therr.com/about',
        parentBlogUrl: 'https://business.therr.com/blog',
        parentBlogName: 'The Official \'Therr For Business\' Blog',
        parentAppUrl: 'https://www.therr.app/',
        parentAppName: 'Therr App',
        parentContactUrl: 'https://business.therr.com/contact',
        faviconFileName: 'favicon.ico',
        metaImageFileName: 'therr-for-business-logo.png',
        mobileLogoFileName: 'therr-logo.svg',
    },
    'adsorchestrator.com': {
        brandName: 'Ads Orchestrator',
        websiteName: 'Ads Orchestrator AI',
        host: 'adsorchestrator.com',
        contactEmail: 'info@therr.com',
        instagramHandle: 'therr.for.business',
        facebookHandle: 'therr.for.business',
        twitterHandle: 'therr_app',
        parentHomepageName: 'Ads Orchestrator',
        parentHomepageUrl: 'https://business.therr.com',
        parentAboutUrl: 'https://business.therr.com/about',
        parentBlogUrl: 'https://business.therr.com/blog',
        parentBlogName: 'The Official \'Therr For Business\' Blog',
        parentAppUrl: 'https://www.therr.app/',
        parentAppName: 'Therr App',
        parentContactUrl: 'https://business.therr.com/contact',
        faviconFileName: 'favicon.ico',
        metaImageFileName: 'therr-for-business-logo.png',
        mobileLogoFileName: 'therr-logo.svg',
    },
};

const getWebsiteName = () => {
    if (typeof (window) !== 'undefined') {
        if (window?.location?.hostname === 'dashboard.appymeal.com') {
            return brandConfigs['dashboard.appymeal.com'].websiteName;
        }
        if (window?.location?.hostname === 'adsorchestra.com') {
            return brandConfigs['adsorchestra.com'].websiteName;
        }
        if (window?.location?.hostname === 'adsorchestrator.com') {
            return brandConfigs['adsorchestrator.com'].websiteName;
        }
    }

    return brandConfigs['dashboard.therr.com'].websiteName;
};

const getBrandContext = (hostname?: string): IBrandConfig => {
    const windowHostName = window?.location?.hostname || 'dashboard.therr.com';
    const sanitizedHostName = (hostname || windowHostName).replace('www.', '');

    return brandConfigs[sanitizedHostName] || brandConfigs['dashboard.therr.com'];
};

export {
    getBrandContext,
    getWebsiteName,
};
