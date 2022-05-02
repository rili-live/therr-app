module.exports = {
    project: {
        ios: {},
        android: {}, // grouped into "project"
    },
    assets: ['./resources/fonts/'], // stays the same
    dependencies: {
        '@logrocket/react-native': {
            platforms: {
                // android: null, // current version was not working on android. TODO: try again after update
            },
        },
    },
};
