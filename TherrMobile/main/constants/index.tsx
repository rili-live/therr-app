const INITIAL_LATIUDE_DELTA = 0.00122;
const INITIAL_LONGITUDE_DELTA = 0.00051;
const MIN_LOAD_TIMEOUT = 250;
const DEFAULT_MOMENT_PROXIMITY = 25;
const MIN_ZOOM_LEVEL = 5;
const MOMENTS_REFRESH_THROTTLE_MS = 30 * 1000;
const LOCATION_PROCESSING_THROTTLE_MS = 5 * 1000;

// RegEx
const youtubeLinkRegex = /(?:http(?:s?):\/\/)?(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-_]*)(&(amp;)?[\w?‌​=]*)?/mi;


export {
    INITIAL_LATIUDE_DELTA,
    INITIAL_LONGITUDE_DELTA,
    MIN_LOAD_TIMEOUT,
    DEFAULT_MOMENT_PROXIMITY,
    MIN_ZOOM_LEVEL,
    MOMENTS_REFRESH_THROTTLE_MS,
    LOCATION_PROCESSING_THROTTLE_MS,

    // RegEx
    youtubeLinkRegex,
};
