// CAROUSEL Constants
const CAROUSEL_TABS = {
    SOCIAL: 'social',
    HIRE: 'hire',
    EVENTS: 'events',
};

// Area Constants
const DEFAULT_RADIUS = 10;
const DEFAULT_RADIUS_PRIVATE = 50;
const MIN_RADIUS_PRIVATE = 3;
const MAX_RADIUS_PRIVATE = 50;
const MIN_RADIUS_PUBLIC = 3;
const MAX_RADIUS_PUBLIC = 200;


// MAP Constants
const INITIAL_LATITUDE_DELTA = 0.48022;
const INITIAL_LONGITUDE_DELTA = 0.04802;
const PRIMARY_LATITUDE_DELTA = 0.00522;
const PRIMARY_LONGITUDE_DELTA = 0.00102;
const MAX_LOAD_TIMEOUT = 5000;
const MIN_LOAD_TIMEOUT = 350;
const DEFAULT_MOMENT_PROXIMITY = 25;
const MIN_ZOOM_LEVEL = 1; // Setting this too high may break animation to regions that excede the minimum zoom
const MOMENTS_REFRESH_THROTTLE_MS = 30 * 1000;
const LOCATION_PROCESSING_THROTTLE_MS = 5 * 1000;

// RegEx
const youtubeLinkRegex = /(?:http(?:s?):\/\/)?(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-_]*)(&(amp;)?[\w?‌​=]*)?/mi;

// User Constants
const DEFAULT_FIRSTNAME = 'Anonymous';
const DEFAULT_LASTNAME = 'User';

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
    INITIAL_LATITUDE_DELTA,
    INITIAL_LONGITUDE_DELTA,
    PRIMARY_LATITUDE_DELTA,
    PRIMARY_LONGITUDE_DELTA,
    MIN_LOAD_TIMEOUT,
    DEFAULT_MOMENT_PROXIMITY,
    MAX_LOAD_TIMEOUT,
    MIN_ZOOM_LEVEL,
    MOMENTS_REFRESH_THROTTLE_MS,
    LOCATION_PROCESSING_THROTTLE_MS,

    // RegEx
    youtubeLinkRegex,

    // User
    DEFAULT_FIRSTNAME,
    DEFAULT_LASTNAME,
};
