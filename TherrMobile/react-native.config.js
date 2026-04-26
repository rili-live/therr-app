// HABITS does not use location features. Skip autolinking the
// background-geolocation native module so its license check never runs and
// no permissions prompts fire.
// Hardcoded on this niche branch — RN CLI loads this file via Node, which
// cannot resolve the CURRENT_BRAND_VARIATION TS import at config-load time
// without ts-node.
const isBackgroundGeolocationDisabled = true;

const dependencies = {
    '@logrocket/react-native': {
        platforms: {
            // android: null, // current version was not working on android. TODO: try again after update
        },
    },
};

if (isBackgroundGeolocationDisabled) {
    dependencies['react-native-background-geolocation'] = {
        platforms: {
            ios: null,
            android: null,
        },
    };
}

module.exports = {
    project: {
        ios: {},
        android: {}, // grouped into "project"
    },
    assets: ['./resources/fonts/'], // stays the same
    dependencies,
};
