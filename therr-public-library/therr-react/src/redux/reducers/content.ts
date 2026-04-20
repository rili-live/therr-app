import { produce } from 'immer';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IContentState, ContentActionTypes } from '../../types/redux/content';
import { MapActionTypes } from '../../types';

// Caps on merged collections. Without these, repeated searches (e.g. moving
// the map) accumulate results forever, bloating Redux state and causing
// redux-persist writes to exceed AsyncStorage's per-item size limit on
// Android (~2 MB), which silently fails and makes the app feel slower
// until a cold start.
const MAX_ACTIVE_ITEMS = 300;
const MAX_MEDIA_ENTRIES = 500;

const trimTail = <T>(arr: T[], max: number): T[] => (arr.length > max ? arr.slice(0, max) : arr);

// Mutates draftMedia in place: merges incomingMedia and drops oldest keys past `max`.
// Why: the previous spread-based trimMedia allocated a full copy of media
// (~500 keys) on every SEARCH/UPDATE/GET dispatch. With redux-persist throttled,
// the dominant cost on hot paths shifted to this allocation; in-place mutation
// inside an immer draft is safe and avoids it.
const mergeAndTrimMedia = (draftMedia: { [key: string]: any }, incomingMedia: { [key: string]: any } | undefined, max: number): void => {
    if (incomingMedia) {
        Object.assign(draftMedia, incomingMedia);
    }
    const keys = Object.keys(draftMedia);
    const overflow = keys.length - max;
    if (overflow <= 0) { return; }
    // Delete the oldest entries (object key insertion order) so the newest survive.
    // eslint-disable-next-line no-param-reassign
    for (let i = 0; i < overflow; i += 1) { delete draftMedia[keys[i]]; }
};

// TODO: Rather than using Set to remove duplicates, store this data as a Map keyed on area ID

const initialState: IContentState = {
    activeEvents: [],
    activeEventsPagination: {},
    bookmarkedEvents: [],
    activeMoments: [],
    activeMomentsPagination: {},
    bookmarkedMoments: [],
    activeSpaces: [],
    activeSpacesPagination: {},
    bookmarkedSpaces: [],
    activeThoughts: [],
    activeThoughtsPagination: {},
    bookmarkedThoughts: [],
    myDrafts: [],
    myDraftsPagination: {},

    userLists: [],
    activeUserList: null,

    activeAreasFilters: {
        order: 'DESC',
        contentType: 'all',
    },
    media: {},
};

const content = produce((draft: IContentState, action: any) => {
    const modifiedActiveEventsMap: { [key: string]: any } = {};
    const modifiedActiveMomentsMap: { [key: string]: any } = {};
    const modifiedActiveSpacesMap: { [key: string]: any } = {};
    const modifiedActiveThoughtsMap: { [key: string]: any } = {};

    // TODO: consider storing as Set to prevent duplicates
    switch (action.type) {
        // Events
        case ContentActionTypes.INSERT_ACTIVE_EVENTS:
            // Add latest events to start
            draft.activeEvents = trimTail([...new Set([...action.data, ...draft.activeEvents])], MAX_ACTIVE_ITEMS);
            break;
        case ContentActionTypes.REMOVE_ACTIVE_EVENTS: {
            // Remove (reported) events
            const idx = draft.activeEvents.findIndex((e) => e.id === action.data?.eventId);
            if (idx !== -1) draft.activeEvents.splice(idx, 1);
            draft.activeEvents = [...new Set(draft.activeEvents)];
            break;
        }
        case ContentActionTypes.UPDATE_ACTIVE_EVENT_REACTION: {
            const activeIdx = draft.activeEvents.findIndex((e) => e.id === action.data?.eventId);
            if (activeIdx !== -1) {
                draft.activeEvents[activeIdx].reaction = { ...action.data };
            }
            draft.activeEvents = [...new Set(draft.activeEvents)];
            const bookmarkIdx = draft.bookmarkedEvents.findIndex((e) => e.id === action.data?.eventId);
            if (bookmarkIdx !== -1) {
                draft.bookmarkedEvents[bookmarkIdx].reaction = { ...action.data };
            }
            break;
        }
        case ContentActionTypes.SEARCH_ACTIVE_EVENTS:
            // Add next offset of events to end
            action.data.events.concat([...draft.activeEvents]).forEach((m) => {
                if (!modifiedActiveEventsMap[m.id]) {
                    modifiedActiveEventsMap[m.id] = m;
                }
            });
            draft.activeEvents = trimTail(Object.values(modifiedActiveEventsMap), MAX_ACTIVE_ITEMS);
            draft.activeEventsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.UPDATE_ACTIVE_EVENTS:
            // Reset events from scratch
            draft.activeEvents = action.data.events;
            draft.activeEventsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.SEARCH_BOOKMARKED_EVENTS:
            // Add next offset of events to end
            draft.bookmarkedEvents = action.data.events;
            if (action.data.media) Object.assign(draft.media, action.data.media);
            break;

        // Moments
        case ContentActionTypes.INSERT_ACTIVE_MOMENTS:
            // Add latest moments to start
            draft.activeMoments = trimTail(action.data.concat([...draft.activeMoments]), MAX_ACTIVE_ITEMS);
            break;
        case ContentActionTypes.REMOVE_ACTIVE_MOMENTS: {
            // Remove (reported) moments
            const idx = draft.activeMoments.findIndex((m) => m.id === action.data?.momentId);
            if (idx !== -1) draft.activeMoments.splice(idx, 1);
            break;
        }
        case ContentActionTypes.UPDATE_ACTIVE_MOMENT_REACTION: {
            const activeIdx = draft.activeMoments.findIndex((m) => m.id === action.data?.momentId);
            if (activeIdx !== -1) {
                draft.activeMoments[activeIdx].reaction = { ...action.data };
            }
            const bookmarkIdx = draft.bookmarkedMoments.findIndex((m) => m.id === action.data?.momentId);
            if (bookmarkIdx !== -1) {
                draft.bookmarkedMoments[bookmarkIdx].reaction = { ...action.data };
            }
            break;
        }
        case ContentActionTypes.SEARCH_ACTIVE_MOMENTS_BY_IDS:
            // Add newly activated moments to the top
            action.data.moments.concat([...draft.activeMoments]).forEach((m) => {
                if (!modifiedActiveMomentsMap[m.id]) {
                    modifiedActiveMomentsMap[m.id] = m;
                }
            });
            draft.activeMoments = trimTail(Object.values(modifiedActiveMomentsMap), MAX_ACTIVE_ITEMS);
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            break;
        case ContentActionTypes.SEARCH_ACTIVE_MOMENTS:
            // Add next offset of moments to end
            action.data.moments.concat([...draft.activeMoments]).forEach((m) => {
                if (!modifiedActiveMomentsMap[m.id]) {
                    modifiedActiveMomentsMap[m.id] = m;
                }
            });
            draft.activeMoments = trimTail(Object.values(modifiedActiveMomentsMap), MAX_ACTIVE_ITEMS);
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            draft.activeMomentsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.UPDATE_ACTIVE_MOMENTS:
            // Reset moments from scratch
            draft.activeMoments = trimTail(action.data.moments, MAX_ACTIVE_ITEMS);
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES); // local cache existing media
            draft.activeMomentsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.SEARCH_BOOKMARKED_MOMENTS:
            // TODO: Add next offset of moments to end
            draft.bookmarkedMoments = action.data.moments;
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            break;
        case ContentActionTypes.SEARCH_MY_DRAFTS:
            // Add next offset of spaces to end
            draft.myDrafts = [...action.data.results];
            draft.myDraftsPagination = { ...action.data.pagination };
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            break;
        case ContentActionTypes.MOMENT_DRAFT_CREATED:
            draft.myDrafts.unshift(action.data);
            break;
        case ContentActionTypes.MOMENT_DRAFT_DELETED: {
            // Remove (deleted draft) moments
            const idx = draft.myDrafts.findIndex((m) => m.id === action.data?.id);
            if (idx !== -1) draft.myDrafts.splice(idx, 1);
            break;
        }
        case MapActionTypes.MOMENT_UPDATED: {
            // Remove moment updated from draft to complete
            const idx = draft.myDrafts.findIndex((m) => m.id === action.data?.id);
            if (idx !== -1 && !action.data.isDraft) {
                draft.myDrafts.splice(idx, 1);
            }
            break;
        }

        // Spaces
        case ContentActionTypes.INSERT_ACTIVE_SPACES:
            // Add latest spaces to start
            draft.activeSpaces = trimTail([...new Set(action.data.concat([...draft.activeSpaces]))], MAX_ACTIVE_ITEMS);
            break;
        case ContentActionTypes.REMOVE_ACTIVE_SPACES: {
            // Remove (reported) spaces
            const idx = draft.activeSpaces.findIndex((s) => s.id === action.data?.spaceId);
            if (idx !== -1) draft.activeSpaces.splice(idx, 1);
            draft.activeSpaces = [...new Set(draft.activeSpaces)];
            break;
        }
        case ContentActionTypes.UPDATE_ACTIVE_SPACE_REACTION: {
            const activeIdx = draft.activeSpaces.findIndex((s) => s.id === action.data?.spaceId);
            if (activeIdx !== -1) {
                draft.activeSpaces[activeIdx].reaction = { ...action.data };
            }
            draft.activeSpaces = [...new Set(draft.activeSpaces)];
            const bookmarkIdx = draft.bookmarkedSpaces.findIndex((s) => s.id === action.data?.spaceId);
            if (bookmarkIdx !== -1) {
                draft.bookmarkedSpaces[bookmarkIdx].reaction = { ...action.data };
            }
            break;
        }
        case ContentActionTypes.SEARCH_ACTIVE_SPACES_BY_IDS:
            // Add newly activated space to the top
            action.data.spaces.concat([...draft.activeSpaces]).forEach((m) => {
                if (!modifiedActiveSpacesMap[m.id]) {
                    modifiedActiveSpacesMap[m.id] = m;
                }
            });
            draft.activeSpaces = trimTail(Object.values(modifiedActiveSpacesMap), MAX_ACTIVE_ITEMS);
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            break;
        case ContentActionTypes.SEARCH_ACTIVE_SPACES:
            // Add next offset of spaces to end
            action.data.spaces.concat([...draft.activeSpaces]).forEach((m) => {
                if (!modifiedActiveSpacesMap[m.id]) {
                    modifiedActiveSpacesMap[m.id] = m;
                }
            });
            draft.activeSpaces = trimTail(Object.values(modifiedActiveSpacesMap), MAX_ACTIVE_ITEMS);
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            draft.activeSpacesPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.UPDATE_ACTIVE_SPACES:
            // Reset spaces from scratch
            draft.activeSpaces = trimTail(action.data.spaces, MAX_ACTIVE_ITEMS);
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES); // local cache existing media
            draft.activeSpacesPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.SEARCH_BOOKMARKED_SPACES:
            // Add next offset of spaces to end
            draft.bookmarkedSpaces = action.data.spaces;
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            break;

        // Thoughts
        case ContentActionTypes.INSERT_ACTIVE_THOUGHTS:
            // Add latest thoughts to start
            draft.activeThoughts = trimTail([...new Set([...action.data, ...draft.activeThoughts])], MAX_ACTIVE_ITEMS);
            break;
        case ContentActionTypes.REMOVE_ACTIVE_THOUGHTS: {
            // Remove (reported) thoughts
            const idx = draft.activeThoughts.findIndex((t) => t.id === action.data?.thoughtId);
            if (idx !== -1) draft.activeThoughts.splice(idx, 1);
            draft.activeThoughts = [...new Set(draft.activeThoughts)];
            break;
        }
        case ContentActionTypes.UPDATE_ACTIVE_THOUGHT_REACTION: {
            const activeIdx = draft.activeThoughts.findIndex((t) => t.id === action.data?.thoughtId);
            if (activeIdx !== -1) {
                draft.activeThoughts[activeIdx].reaction = { ...action.data };
            }
            draft.activeThoughts = [...new Set(draft.activeThoughts)];
            const bookmarkIdx = draft.bookmarkedThoughts.findIndex((t) => t.id === action.data?.thoughtId);
            if (bookmarkIdx !== -1) {
                draft.bookmarkedThoughts[bookmarkIdx].reaction = { ...action.data };
            }
            break;
        }
        case ContentActionTypes.SEARCH_ACTIVE_THOUGHTS:
            // Add next offset of thoughts to end
            action.data.thoughts.concat([...draft.activeThoughts]).forEach((m) => {
                if (!modifiedActiveThoughtsMap[m.id]) {
                    modifiedActiveThoughtsMap[m.id] = m;
                }
            });
            draft.activeThoughts = trimTail(Object.values(modifiedActiveThoughtsMap), MAX_ACTIVE_ITEMS);
            draft.activeThoughtsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.UPDATE_ACTIVE_THOUGHTS:
            // Reset thoughts from scratch
            draft.activeThoughts = trimTail(action.data.thoughts, MAX_ACTIVE_ITEMS);
            draft.activeThoughtsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.SEARCH_BOOKMARKED_THOUGHTS:
            // Add next offset of thoughts to end
            draft.bookmarkedThoughts = action.data.thoughts;
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            break;

        // Other
        case ContentActionTypes.FETCH_MEDIA:
            mergeAndTrimMedia(draft.media, action.data, MAX_MEDIA_ENTRIES);
            break;
        case ContentActionTypes.SET_ACTIVE_AREAS_FILTERS:
            draft.activeAreasFilters = { ...draft.activeAreasFilters, ...action.data };
            break;
        case MapActionTypes.GET_EVENT_DETAILS:
        case MapActionTypes.GET_MOMENT_DETAILS:
        case MapActionTypes.GET_SPACE_DETAILS:
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            break;
        // User Lists
        case ContentActionTypes.FETCH_USER_LISTS:
            draft.userLists = action.data.lists || [];
            break;
        case ContentActionTypes.FETCH_USER_LIST_DETAILS:
            draft.activeUserList = action.data.list || null;
            mergeAndTrimMedia(draft.media, action.data.media, MAX_MEDIA_ENTRIES);
            break;
        case ContentActionTypes.CREATE_USER_LIST:
            // Prepend newly created list
            draft.userLists = [action.data, ...draft.userLists.filter((l) => l.id !== action.data.id)];
            break;
        case ContentActionTypes.UPDATE_USER_LIST: {
            const idx = draft.userLists.findIndex((l) => l.id === action.data.id);
            if (idx !== -1) {
                draft.userLists[idx] = { ...draft.userLists[idx], ...action.data };
            }
            if (draft.activeUserList && draft.activeUserList.id === action.data.id) {
                draft.activeUserList = { ...draft.activeUserList, ...action.data };
            }
            break;
        }
        case ContentActionTypes.DELETE_USER_LIST: {
            draft.userLists = draft.userLists.filter((l) => l.id !== action.data.id);
            if (draft.activeUserList && draft.activeUserList.id === action.data.id) {
                draft.activeUserList = null;
            }
            break;
        }
        case ContentActionTypes.UPDATE_USER_LIST_MEMBERSHIP: {
            // action.data = { list: {...updated list with new itemCount} }
            if (action.data?.list) {
                const idx = draft.userLists.findIndex((l) => l.id === action.data.list.id);
                if (idx !== -1) {
                    draft.userLists[idx] = { ...draft.userLists[idx], ...action.data.list };
                } else {
                    draft.userLists.unshift(action.data.list);
                }
            }
            break;
        }

        case SocketClientActionTypes.LOGOUT:
            draft.activeMoments = [];
            draft.bookmarkedMoments = [];
            draft.activeSpaces = [];
            draft.bookmarkedSpaces = [];
            draft.activeThoughts = [];
            draft.bookmarkedThoughts = [];
            draft.userLists = [];
            draft.activeUserList = null;
            break;
        default:
            break;
    }
}, initialState);

export default content;
