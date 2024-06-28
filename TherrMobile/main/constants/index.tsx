import { AndroidChannel, AndroidImportance } from "@notifee/react-native";

// CAROUSEL Constants
const CAROUSEL_TABS = {
    DISCOVERIES: 'discoveries',
    EVENTS: 'events',
    THOUGHTS: 'thoughts',
    NEWS: 'news',
};
const GROUP_CAROUSEL_TABS = {
    CHAT: 'chat',
    EVENTS: 'events',
    MEMBERS: 'members',
};
const GROUPS_CAROUSEL_TABS = {
    GROUPS: 'groups',
};
const PEOPLE_CAROUSEL_TABS = {
    PEOPLE: 'people',
    MESSAGES: 'messages',
    CONNECTIONS: 'connections',
};
const PROFILE_CAROUSEL_TABS = {
    THOUGHTS: 'people',
    MEDIA: 'groups',
    MOMENTS: 'moments',
};

const HAPTIC_FEEDBACK_TYPE = 'soft';

// Area Constants
const DEFAULT_RADIUS = 10;
const DEFAULT_RADIUS_MEDIUM = 10;
const MIN_RADIUS_PRIVATE = 3;
const MAX_RADIUS_PRIVATE = 50;
const MIN_RADIUS_PUBLIC = 3;
const MAX_RADIUS_PUBLIC = 50;
const MIN_TIME_BTW_CHECK_INS_MS = 1000 * 60 * 30; // 30 MINUTES
const MIN_TIME_BTW_MOMENTS_MS = 1000 * 60 * 30; // 30 MINUTES

// MAP Constants
const ANIMATE_TO_REGION_DURATION = 750;
const ANIMATE_TO_REGION_DURATION_SLOW = 1500;
const ANIMATE_TO_REGION_DURATION_FAST = 500;
const ANIMATE_TO_REGION_DURATION_VERY_FAST = 350;
const ANIMATE_TO_REGION_DURATION_RAPID = 200;
const DEFAULT_LONGITUDE = -99.458829; // U.S. TEXAS
const DEFAULT_LATITUDE = 39.7629981; // U.S. TEXAS
const INITIAL_LATITUDE_DELTA = 42;
const INITIAL_LONGITUDE_DELTA = 42;
const PRIMARY_LATITUDE_DELTA = 0.017;
const PRIMARY_LONGITUDE_DELTA = 0.006;
const SECONDARY_LATITUDE_DELTA = 0.01;
const SECONDARY_LONGITUDE_DELTA = 0.01;
const MAX_ANIMATION_LATITUDE_DELTA = 0.6;
const MAX_ANIMATION_LONGITUDE_DELTA = 0.4;
const MAX_LOAD_TIMEOUT = 5000;
const MIN_LOAD_TIMEOUT = 350;
const DEFAULT_MOMENT_PROXIMITY = 25;
const MIN_ZOOM_LEVEL = 1; // Setting this too high may break animation to regions that excede the minimum zoom
const MOMENTS_REFRESH_THROTTLE_MS = 30 * 1000;
const LOCATION_PROCESSING_THROTTLE_MS = 5 * 1000;
const MAX_DISTANCE_TO_NEARBY_SPACE = 120; // Distance in meters (roughly 400 feet)
const EST_US_RADIUS_METERS = 6250000;

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
    GROUP_CAROUSEL_TABS,
    GROUPS_CAROUSEL_TABS,
    PEOPLE_CAROUSEL_TABS,
    PROFILE_CAROUSEL_TABS,

    HAPTIC_FEEDBACK_TYPE,

    // Area
    DEFAULT_RADIUS,
    DEFAULT_RADIUS_MEDIUM,
    MIN_RADIUS_PRIVATE,
    MAX_RADIUS_PRIVATE,
    MIN_RADIUS_PUBLIC,
    MAX_RADIUS_PUBLIC,
    MIN_TIME_BTW_CHECK_INS_MS,
    MIN_TIME_BTW_MOMENTS_MS,

    // Map
    ANIMATE_TO_REGION_DURATION,
    ANIMATE_TO_REGION_DURATION_SLOW,
    ANIMATE_TO_REGION_DURATION_FAST,
    ANIMATE_TO_REGION_DURATION_RAPID,
    ANIMATE_TO_REGION_DURATION_VERY_FAST,
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
    EST_US_RADIUS_METERS,

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
