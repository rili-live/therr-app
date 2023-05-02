import { AndroidChannel, AndroidImportance } from "@notifee/react-native";

// CAROUSEL Constants
const CAROUSEL_TABS = {
    DISCOVERIES: 'discoveries',
    THOUGHTS: 'thoughts',
    EVENTS: 'events',
    NEWS: 'news',
};

// Area Constants
const DEFAULT_RADIUS = 10;
const DEFAULT_RADIUS_PRIVATE = 50;
const MIN_RADIUS_PRIVATE = 3;
const MAX_RADIUS_PRIVATE = 50;
const MIN_RADIUS_PUBLIC = 3;
const MAX_RADIUS_PUBLIC = 200;


// MAP Constants
const ANIMATE_TO_REGION_DURATION = 750;
const ANIMATE_TO_REGION_DURATION_SLOW = 1500;
const ANIMATE_TO_REGION_DURATION_FAST = 500;
const ANIMATE_TO_REGION_DURATION_RAPID = 350;
const DEFAULT_LONGITUDE = -99.458829;
const DEFAULT_LATITUDE = 39.7629981;
const INITIAL_LATITUDE_DELTA = 42;
const INITIAL_LONGITUDE_DELTA = 42;
const PRIMARY_LATITUDE_DELTA = 0.014;
const PRIMARY_LONGITUDE_DELTA = 0.005;
const SECONDARY_LATITUDE_DELTA = 0.01;
const SECONDARY_LONGITUDE_DELTA = 0.01;
const MAX_ANIMATION_LATITUDE_DELTA = 0.28;
const MAX_ANIMATION_LONGITUDE_DELTA = 0.19;
const MAX_LOAD_TIMEOUT = 5000;
const MIN_LOAD_TIMEOUT = 350;
const DEFAULT_MOMENT_PROXIMITY = 25;
const MIN_ZOOM_LEVEL = 1; // Setting this too high may break animation to regions that excede the minimum zoom
const MOMENTS_REFRESH_THROTTLE_MS = 30 * 1000;
const LOCATION_PROCESSING_THROTTLE_MS = 5 * 1000;
const MAX_DISTANCE_TO_NEARBY_SPACE = 120; // Distance in meters (roughly 400 feet)

// RegEx
const youtubeLinkRegex = /(?:http(?:s?):\/\/)?(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-_]*)(&(amp;)?[\w?‌​=]*)?/mi;

// User Constants
const DEFAULT_FIRSTNAME = 'Anonymous';
const DEFAULT_LASTNAME = 'User';

enum PressActionIds {
    default = 'default',
    discovered = 'discovered',
    drafts = 'drafts',
    exchange = 'exchange-coins',
    markAsRead = 'mark-as-read',
}

enum AndroidChannelIds {
    default = 'default',
    contentDiscovery = 'contentDiscovery',
    rewardUpdates = 'rewardUpdates',
    reminders = 'reminders'
}

const AndroidChannels = {
    default: {
        id: 'default',
        name: 'Miscellaneous',
        importance: AndroidImportance.DEFAULT,
    },
    contentDiscovery: {
        id: 'contentDiscovery',
        name: 'Content Discovery',
        importance: AndroidImportance.DEFAULT,
    },
    rewardUpdates: {
        id: 'rewardUpdates',
        name: 'Reward Updates',
        importance: AndroidImportance.HIGH,
    },
};

const getAndroidChannel = (channelId: AndroidChannelIds, vibration = true): AndroidChannel => ({
    ...AndroidChannels[channelId],
    vibration,
});

export {
    // Carousel
    CAROUSEL_TABS,

    // Area
    DEFAULT_RADIUS,
    DEFAULT_RADIUS_PRIVATE,
    MIN_RADIUS_PRIVATE,
    MAX_RADIUS_PRIVATE,
    MIN_RADIUS_PUBLIC,
    MAX_RADIUS_PUBLIC,

    // Map
    ANIMATE_TO_REGION_DURATION,
    ANIMATE_TO_REGION_DURATION_SLOW,
    ANIMATE_TO_REGION_DURATION_FAST,
    ANIMATE_TO_REGION_DURATION_RAPID,
    DEFAULT_LONGITUDE,
    DEFAULT_LATITUDE,
    INITIAL_LATITUDE_DELTA,
    INITIAL_LONGITUDE_DELTA,
    PRIMARY_LATITUDE_DELTA,
    PRIMARY_LONGITUDE_DELTA,
    SECONDARY_LATITUDE_DELTA,
    SECONDARY_LONGITUDE_DELTA,
    MAX_ANIMATION_LATITUDE_DELTA,
    MAX_ANIMATION_LONGITUDE_DELTA,
    MIN_LOAD_TIMEOUT,
    DEFAULT_MOMENT_PROXIMITY,
    MAX_LOAD_TIMEOUT,
    MIN_ZOOM_LEVEL,
    MOMENTS_REFRESH_THROTTLE_MS,
    LOCATION_PROCESSING_THROTTLE_MS,
    MAX_DISTANCE_TO_NEARBY_SPACE,

    // RegEx
    youtubeLinkRegex,

    // Push Notifications
    AndroidChannels,
    AndroidChannelIds,
    getAndroidChannel,
    PressActionIds,

    // User
    DEFAULT_FIRSTNAME,
    DEFAULT_LASTNAME,
};
