import { produce } from 'immer';
import { Location, SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IMapState, MapActionTypes } from '../../types/redux/maps';
import { ContentActionTypes } from '../../types/redux/content';

const initialState: IMapState = {
    activityGeneration: {},
    activities: {},
    cityPulse: {},
    events: {},
    moments: {},
    spaces: {},
    searchPredictions: {},
    radiusOfAwareness: (Location.MAX_RADIUS_OF_AWARENESS - Location.MIN_RADIUS_OF_AWARENESS) / 2,
    radiusOfInfluence: (Location.MAX_RADIUS_OF_INFLUENCE - Location.MIN_RADIUS_OF_INFLUENCE) / 2,
    recentEngagements: {},

    // Filters
    filtersAuthor: [],
    filtersCategory: [],
    filtersVisibility: [],
};

const map = produce((draft: IMapState, action: any) => {
    // Slice to keep total from overflowing
    const slicedEvents: { [key: string]: any } = Object.entries(draft.events).slice(0, 300).reduce((acc: { [key: string]: any }, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedEvents = { ...slicedEvents };
    const slicedMoments: { [key: string]: any } = Object.entries(draft.moments).slice(0, 300).reduce((acc: { [key: string]: any }, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedMoments = { ...slicedMoments };
    const slicedSpaces: { [key: string]: any } = Object.entries(draft.spaces).slice(0, 300).reduce((acc: { [key: string]: any }, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedSpaces = { ...slicedSpaces };

    switch (action.type) {
        case MapActionTypes.GENERATE_ACTIVITY:
            draft.activityGeneration = action.data;
            break;
        case MapActionTypes.GET_EVENTS:
        case MapActionTypes.GET_MY_EVENTS:
            // Convert array to object for faster lookup and de-duping
            draft.events = action.data.results.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: {
                        ...item,
                        reaction: item.reaction || acc[item.id]?.reaction,
                    },
                }), modifiedEvents);
            break;
        case ContentActionTypes.SEARCH_ACTIVE_EVENTS_BY_IDS:
            // Convert array to object for faster lookup and de-duping
            draft.events = action.data.events.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: {
                        ...item,
                        reaction: item.reaction || acc[item.id]?.reaction,
                    },
                }), modifiedEvents);
            break;
        case MapActionTypes.GET_EVENT_DETAILS:
            if (action.data?.event?.id) {
                const existingEvent = modifiedEvents[action.data.event.id];
                if (!existingEvent) {
                    modifiedEvents[action.data.event.id] = action.data.event;
                } else {
                    modifiedEvents[action.data.event.id] = {
                        ...existingEvent,
                        ...action.data.event,
                        reaction: action.data.event.reaction || existingEvent.reaction,
                    };
                }
            }
            draft.events = modifiedEvents;
            break;
        case MapActionTypes.EVENT_CREATED:
            modifiedEvents[action.data?.id] = action.data;
            draft.events = modifiedEvents;
            break;
        case MapActionTypes.EVENT_UPDATED:
            if (!modifiedEvents[action.data.id]) {
                modifiedEvents[action.data.id] = action.data;
            } else {
                modifiedEvents[action.data.id] = {
                    ...modifiedEvents[action.data.id],
                    ...action.data,
                };
            }
            draft.events = modifiedEvents;
            break;
        case MapActionTypes.EVENT_DELETED:
            delete modifiedEvents[action.data.id];
            draft.events = modifiedEvents;
            break;
        case ContentActionTypes.UPDATE_ACTIVE_EVENT_REACTION:
            if (action.data?.eventId && modifiedEvents[action.data.eventId]) {
                modifiedEvents[action.data.eventId] = {
                    ...modifiedEvents[action.data.eventId],
                    reaction: { ...action.data },
                };
                draft.events = modifiedEvents;
            }
            break;
        // // // // // // // // // // // //
        case MapActionTypes.GET_MOMENTS:
        case MapActionTypes.GET_MY_MOMENTS:
            // Convert array to object for faster lookup and de-duping
            draft.moments = action.data.results.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: {
                        ...item,
                        reaction: item.reaction || acc[item.id]?.reaction,
                    },
                }), modifiedMoments);
            break;
        case ContentActionTypes.SEARCH_ACTIVE_MOMENTS_BY_IDS:
            // Convert array to object for faster lookup and de-duping
            draft.moments = action.data.moments.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: {
                        ...item,
                        reaction: item.reaction || acc[item.id]?.reaction,
                    },
                }), modifiedMoments);
            break;
        case MapActionTypes.GET_MOMENT_DETAILS:
            if (action.data?.moment?.id) {
                const existingMoment = modifiedMoments[action.data.moment.id];
                if (!existingMoment) {
                    modifiedMoments[action.data.moment.id] = action.data.moment;
                } else {
                    modifiedMoments[action.data.moment.id] = {
                        ...existingMoment,
                        ...action.data.moment,
                        reaction: action.data.moment.reaction || existingMoment.reaction,
                    };
                }
            }
            draft.moments = modifiedMoments;
            break;
        case MapActionTypes.MOMENT_CREATED:
            modifiedMoments[action.data?.id] = action.data;
            draft.moments = modifiedMoments;
            break;
        case MapActionTypes.MOMENT_UPDATED:
            if (!modifiedMoments[action.data.id]) {
                modifiedMoments[action.data.id] = action.data;
            } else {
                modifiedMoments[action.data.id] = {
                    ...modifiedMoments[action.data.id],
                    ...action.data,
                };
            }
            draft.moments = modifiedMoments;
            break;
        case MapActionTypes.MOMENT_DELETED:
            delete modifiedMoments[action.data.id];
            draft.moments = modifiedMoments;
            break;
        case ContentActionTypes.UPDATE_ACTIVE_MOMENT_REACTION:
            if (action.data?.momentId && modifiedMoments[action.data.momentId]) {
                modifiedMoments[action.data.momentId] = {
                    ...modifiedMoments[action.data.momentId],
                    reaction: { ...action.data },
                };
                draft.moments = modifiedMoments;
            }
            break;
        // // // // // // // // // // // //
        case MapActionTypes.LIST_SPACES:
            draft.spaces = action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: {
                        ...item,
                        reaction: item.reaction || draft.spaces[item.id]?.reaction,
                    },
                }), {});
            break;
        case MapActionTypes.GET_SPACES:
        case MapActionTypes.GET_MY_SPACES:
            draft.spaces = action.data.results.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: {
                        ...item,
                        reaction: item.reaction || acc[item.id]?.reaction,
                    },
                }), modifiedSpaces);
            break;
        case ContentActionTypes.SEARCH_ACTIVE_SPACES_BY_IDS:
            // Convert array to object for faster lookup and de-duping
            draft.spaces = action.data.spaces.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: {
                        ...item,
                        reaction: item.reaction || acc[item.id]?.reaction,
                    },
                }), modifiedSpaces);
            break;
        case MapActionTypes.GET_SPACE_DETAILS:
            if (action.data.space?.id) {
                const existingSpace = modifiedSpaces[action.data.space.id];
                if (!existingSpace) {
                    modifiedSpaces[action.data.space.id] = action.data.space;
                } else {
                    modifiedSpaces[action.data.space.id] = {
                        ...existingSpace,
                        ...action.data.space,
                        reaction: action.data.space.reaction || existingSpace.reaction,
                    };
                }
            }
            draft.spaces = modifiedSpaces;
            break;
        case MapActionTypes.SPACE_CREATED:
            modifiedSpaces[action.data?.id] = action.data;
            draft.spaces = modifiedSpaces;
            break;
        case MapActionTypes.SPACE_UPDATED:
            if (!modifiedSpaces[action.data.space.id]) {
                modifiedSpaces[action.data.space.id] = action.data.space;
            } else {
                modifiedSpaces[action.data.space.id] = {
                    ...modifiedSpaces[action.data.space.id],
                    ...action.data.space,
                };
            }
            draft.spaces = modifiedSpaces;
            break;
        case MapActionTypes.SPACE_DELETED:
            delete modifiedSpaces[action.data.id];
            draft.spaces = modifiedSpaces;
            break;
        case ContentActionTypes.UPDATE_ACTIVE_SPACE_REACTION:
            if (action.data?.spaceId && modifiedSpaces[action.data.spaceId]) {
                modifiedSpaces[action.data.spaceId] = {
                    ...modifiedSpaces[action.data.spaceId],
                    reaction: { ...action.data },
                };
                draft.spaces = modifiedSpaces;
            }
            break;
        case MapActionTypes.UPDATE_RECENT_ENGAGEMENTS:
            draft.recentEngagements = {
                ...draft.recentEngagements,
                [action.data.spaceId]: action.data,
            };
            break;
        case MapActionTypes.GET_CITY_PULSE:
            if (action.data?.city?.slug) {
                draft.cityPulse = {
                    ...draft.cityPulse,
                    [action.data.city.slug]: action.data,
                };
            }
            break;
        // // // // // // // // // // // //
        case MapActionTypes.UPDATE_MAP_VIEW_COORDS:
            draft.prevLongitude = draft.longitude;
            draft.prevLatitude = draft.latitude;
            draft.prevLongitudeDelta = draft.longitudeDelta;
            draft.prevLatitudeDelta = draft.latitudeDelta;
            draft.longitude = action.data.longitude || draft.longitude;
            draft.latitude = action.data.latitude || draft.latitude;
            draft.longitudeDelta = action.data.longitudeDelta || draft.longitudeDelta;
            draft.latitudeDelta = action.data.latitudeDelta || draft.latitudeDelta;
            break;
        case MapActionTypes.UPDATE_USER_RADIUS:
            draft.radiusOfAwareness = action.data.radiusOfAwareness;
            draft.radiusOfInfluence = action.data.radiusOfInfluence;
            break;
        case MapActionTypes.USER_LOCATION_DETERMINED:
            draft.hasUserLocationLoaded = true;
            break;
        case MapActionTypes.AUTOCOMPLETE_SEARCHING:
            draft.searchPredictions.isSearching = true;
            break;
        case MapActionTypes.AUTOCOMPLETE_UPDATE:
            draft.searchPredictions.results = action.data.predictions;
            draft.searchPredictions.isSearching = false;
            break;
        case MapActionTypes.SET_DROPDOWN_VISIBILITY:
            draft.searchPredictions.isSearchDropdownVisible = action.data.isSearchDropdownVisible;
            break;
        case SocketClientActionTypes.LOGOUT:
            draft.searchPredictions = { results: [], isSearchDropdownVisible: false };
            draft.hasUserLocationLoaded = false;
            draft.moments = {};
            draft.spaces = {};
            draft.events = {};
            break;
        // // // // // // // // // // // //
        case MapActionTypes.SET_MAP_FILTERS:
            draft.filtersAuthor = action.data.filtersAuthor || draft.filtersAuthor;
            draft.filtersCategory = action.data.filtersCategory || draft.filtersCategory;
            draft.filtersVisibility = action.data.filtersVisibility || draft.filtersVisibility;
            break;
        default:
            break;
    }
}, initialState);

export default map;
