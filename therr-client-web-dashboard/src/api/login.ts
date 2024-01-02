import * as globalConfig from '../../../global-config';

const popupWindowFeatures = (screen = { height: 900, width: 1600 }, w = 540, h = 680) => {
    const left = (screen.width / 2) - (w / 2);
    const top = (screen.height / 2) - (h / 2);
    // eslint-disable-next-line max-len
    return `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${w}, height=${h}, top=${top}, left=${left}`;
};

const onFBLoginPress = (requestId: string, target = '_self') => {
    // TODO: Use scopes needed for meta ads/campaigns
    const scopes = [
        'email',
        'public_profile',
        'instagram_basic',
        'business_management',
        //
        'ads_read',
        'ads_management',
        'pages_show_list',
        'pages_read_engagement',
        //
        'pages_manage_ads',
        // 'page_events', // Note there is a type in the docs (page should be singular)
        // 'pages_user_locale',
        // 'pages_user_timezone',
        //
        'read_insights',
        // 'instagram_manage_insights',
        // 'instagram_graph_user_profile',
    ];
    const dashboardHostFull = process.env.NODE_ENV === 'development'
        ? globalConfig.production.dashboardHostFull // localhost does not work in development
        : globalConfig[process.env.NODE_ENV].dashboardHostFull;
    const redirectUri = `${dashboardHostFull}/oauth2/facebook-instagram`;
    const responseType = 'code';
    const appId = '1384683965734062';
    // https://developers.facebook.com/docs/facebook-login/facebook-login-for-business#configurations
    const configId = '903585274566915';
    // eslint-disable-next-line max-len
    // const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scopes.join(',')}&state=${requestId}`;
    // eslint-disable-next-line max-len
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&response_type=${responseType}&config_id=${configId}&state=${requestId}`;
    const handle = window?.open(authUrl, target, target === 'mozillaWindow' ? popupWindowFeatures() : undefined);
    if (!handle) {
        window?.open(authUrl, '_self');
    }
};

interface IRenderLoginProps {
    user: {
        isAuthenticated: boolean;
        details: {
            accessLevels: string[];
        };
    };
}

const shouldRenderLoginForm = (props: IRenderLoginProps) => !props.user
    || !props.user.isAuthenticated
    || !props.user.details.accessLevels
    || !props.user.details.accessLevels.length;

export {
    onFBLoginPress,
    shouldRenderLoginForm,
};
