import * as ReactNative from 'react-native';

// Polyfill deprecated prop types for libraries that still use them
const deprecatedProps = {
    ColorPropType: require('deprecated-react-native-prop-types/DeprecatedColorPropType'),
    EdgeInsetsPropType: require('deprecated-react-native-prop-types/DeprecatedEdgeInsetsPropType'),
    ImagePropTypes: require('deprecated-react-native-prop-types/DeprecatedImagePropType'),
    PointPropType: require('deprecated-react-native-prop-types/DeprecatedPointPropType'),
    TextPropTypes: require('deprecated-react-native-prop-types/DeprecatedTextPropTypes'),
    ViewPropTypes: require('deprecated-react-native-prop-types/DeprecatedViewPropTypes'),
};

// Proxy to intercept property access and provide deprecated prop types
module.exports = new Proxy(ReactNative, {
    get(target, prop) {
        if (prop in deprecatedProps) {
            return deprecatedProps[prop];
        }
        return Reflect.get(target, prop);
    },
});
