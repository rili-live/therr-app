import { produce } from 'immer';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IContentState, ContentActionTypes } from '../../types/redux/content';
import { MapActionTypes } from '../../types';

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

    activeAreasFilters: {
        order: 'DESC',
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
            draft.activeEvents = [...new Set([...action.data, ...draft.activeEvents])];
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
            draft.activeEvents = Object.values(modifiedActiveEventsMap);
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
            draft.media = { ...draft.media, ...action.data.media };
            break;

        // Moments
        case ContentActionTypes.INSERT_ACTIVE_MOMENTS:
            // Add latest moments to start
            draft.activeMoments = action.data.concat([...draft.activeMoments]);
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
            draft.activeMoments = Object.values(modifiedActiveMomentsMap);
            draft.media = { ...draft.media, ...action.data.media };
            break;
        case ContentActionTypes.SEARCH_ACTIVE_MOMENTS:
            // Add next offset of moments to end
            action.data.moments.concat([...draft.activeMoments]).forEach((m) => {
                if (!modifiedActiveMomentsMap[m.id]) {
                    modifiedActiveMomentsMap[m.id] = m;
                }
            });
            draft.activeMoments = Object.values(modifiedActiveMomentsMap);
            draft.media = { ...draft.media, ...action.data.media };
            draft.activeMomentsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.UPDATE_ACTIVE_MOMENTS:
            // Reset moments from scratch
            draft.activeMoments = action.data.moments;
            draft.media = { ...draft.media, ...action.data.media }; // local cache existing media
            draft.activeMomentsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.SEARCH_BOOKMARKED_MOMENTS:
            // TODO: Add next offset of moments to end
            draft.bookmarkedMoments = action.data.moments;
            draft.media = { ...draft.media, ...action.data.media };
            break;
        case ContentActionTypes.SEARCH_MY_DRAFTS:
            // Add next offset of spaces to end
            draft.myDrafts = [...action.data.results];
            draft.myDraftsPagination = { ...action.data.pagination };
            draft.media = { ...draft.media, ...action.data.media };
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
            draft.activeSpaces = [...new Set(action.data.concat([...draft.activeSpaces]))];
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
            draft.activeSpaces = Object.values(modifiedActiveSpacesMap);
            draft.media = { ...draft.media, ...action.data.media };
            break;
        case ContentActionTypes.SEARCH_ACTIVE_SPACES:
            // Add next offset of spaces to end
            action.data.spaces.concat([...draft.activeSpaces]).forEach((m) => {
                if (!modifiedActiveSpacesMap[m.id]) {
                    modifiedActiveSpacesMap[m.id] = m;
                }
            });
            draft.activeSpaces = Object.values(modifiedActiveSpacesMap);
            draft.media = { ...draft.media, ...action.data.media };
            draft.activeSpacesPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.UPDATE_ACTIVE_SPACES:
            // Reset spaces from scratch
            draft.activeSpaces = action.data.spaces;
            draft.media = { ...draft.media, ...action.data.media }; // local cache existing media
            draft.activeSpacesPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.SEARCH_BOOKMARKED_SPACES:
            // Add next offset of spaces to end
            draft.bookmarkedSpaces = action.data.spaces;
            draft.media = { ...draft.media, ...action.data.media };
            break;

        // Thoughts
        case ContentActionTypes.INSERT_ACTIVE_THOUGHTS:
            // Add latest thoughts to start
            draft.activeThoughts = [...new Set([...action.data, ...draft.activeThoughts])];
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
            draft.activeThoughts = Object.values(modifiedActiveThoughtsMap);
            draft.activeThoughtsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.UPDATE_ACTIVE_THOUGHTS:
            // Reset thoughts from scratch
            draft.activeThoughts = action.data.thoughts;
            draft.activeThoughtsPagination = { ...action.data.pagination };
            break;
        case ContentActionTypes.SEARCH_BOOKMARKED_THOUGHTS:
            // Add next offset of thoughts to end
            draft.bookmarkedThoughts = action.data.thoughts;
            draft.media = { ...draft.media, ...action.data.media };
            break;

        // Other
        case ContentActionTypes.FETCH_MEDIA:
            draft.media = { ...draft.media, ...action.data };
            break;
        case ContentActionTypes.SET_ACTIVE_AREAS_FILTERS:
            draft.activeAreasFilters = { ...action.data };
            break;
        case MapActionTypes.GET_EVENT_DETAILS:
        case MapActionTypes.GET_MOMENT_DETAILS:
        case MapActionTypes.GET_SPACE_DETAILS:
            draft.media = { ...draft.media, ...action.data.media };
            break;
        case SocketClientActionTypes.LOGOUT:
            draft.activeMoments = [];
            draft.bookmarkedMoments = [];
            draft.activeSpaces = [];
            draft.bookmarkedSpaces = [];
            draft.activeThoughts = [];
            draft.bookmarkedThoughts = [];
            break;
        default:
            break;
    }
}, initialState);

export default content;
