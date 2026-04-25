// HABITS variant does not ship the react-native-background-geolocation native
// module (excluded via react-native.config.js + gated in android/app/build.gradle).
// Metro aliases the package import to this file for HABITS builds (see metro.config.js)
// so Layout.tsx can stay byte-identical to the general branch.
const noopSubscription = { remove: () => {} };

const stub = {
    DESIRED_ACCURACY_MEDIUM: 10,
    LOG_LEVEL_ERROR: 2,
    NOTIFICATION_PRIORITY_MIN: -2,
    onLocation: () => noopSubscription,
    onProviderChange: () => noopSubscription,
    onMotionChange: () => noopSubscription,
    onActivityChange: () => noopSubscription,
    ready: () => Promise.resolve({ enabled: false }),
    start: () => Promise.resolve({ enabled: false }),
    stop: () => Promise.resolve({ enabled: false }),
};

export default stub;
