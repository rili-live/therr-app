import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IContentState, ContentActionTypes } from '../../types/redux/content';
import { MapActionTypes } from '../../types';

// TODO: Rather than using Set to remove duplicates, store this data as a Map keyed on area ID

const initialState: IContentState = Immutable.from({
    activeMoments: Immutable.from([]),
    activeMomentsPagination: Immutable.from({}),
    bookmarkedMoments: Immutable.from([]),
    activeSpaces: Immutable.from([]),
    activeSpacesPagination: Immutable.from({}),
    bookmarkedSpaces: Immutable.from([]),
    activeThoughts: Immutable.from([]),
    activeThoughtsPagination: Immutable.from({}),
    bookmarkedThoughts: Immutable.from([]),
    myDrafts: Immutable.from([]),
    myDraftsPagination: Immutable.from({}),

    activeAreasFilters: Immutable.from({
        order: 'DESC',
    }),
    media: Immutable.from({}),
});

const content = (state: IContentState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    let modifiedActiveMoments = [];
    let modifiedActiveSpaces = [];
    let modifiedActiveThoughts = [];
    let modifiedBookmarkedMoments = [];
    let modifiedBookmarkedSpaces = [];
    let modifiedBookmarkedThoughts = [];
    let modifiedDraftMoments = [];
    let moddedActiveIndex = -1;
    let moddedBookmarkedIndex = -1;
    let moddedDraftIndex = -1;

    // Moments
    if (state.activeMoments) {
        modifiedActiveMoments = JSON.parse(JSON.stringify(state.activeMoments));
        modifiedBookmarkedMoments = JSON.parse(JSON.stringify(state.bookmarkedMoments));
        modifiedDraftMoments = JSON.parse(JSON.stringify(state.myDrafts));
        moddedActiveIndex = modifiedActiveMoments.findIndex((moment) => moment.id === action.data?.momentId);
        moddedBookmarkedIndex = modifiedBookmarkedMoments.findIndex((moment) => moment.id === action.data?.momentId);
        moddedDraftIndex = modifiedDraftMoments.findIndex((moment) => moment.id === action.data?.id);

        if (moddedActiveIndex !== -1) {
            if (action.type === ContentActionTypes.UPDATE_ACTIVE_MOMENT_REACTION) {
                modifiedActiveMoments[moddedActiveIndex].reaction = { ...action.data };
            } else if (action.type === ContentActionTypes.REMOVE_ACTIVE_MOMENTS) {
                modifiedActiveMoments.splice(moddedActiveIndex, 1);
            }
        }

        if (moddedDraftIndex !== -1) {
            if (action.type === ContentActionTypes.MOMENT_DRAFT_DELETED) {
                modifiedDraftMoments.splice(moddedDraftIndex, 1);
            } else if (action.type === MapActionTypes.MOMENT_UPDATED) {
                if (!action.data.isDraft) {
                    modifiedDraftMoments.splice(moddedDraftIndex, 1);
                }
            }
        }

        if (moddedBookmarkedIndex !== -1 && action.type === ContentActionTypes.UPDATE_ACTIVE_MOMENT_REACTION) {
            modifiedBookmarkedMoments[moddedBookmarkedIndex].reaction = { ...action.data };
        }
    }

    // Spaces
    if (state.activeSpaces) {
        modifiedActiveSpaces = JSON.parse(JSON.stringify(state.activeSpaces));
        modifiedBookmarkedSpaces = JSON.parse(JSON.stringify(state.bookmarkedSpaces));
        moddedActiveIndex = modifiedActiveSpaces.findIndex((space) => space.id === action.data?.spaceId);
        moddedBookmarkedIndex = modifiedBookmarkedSpaces.findIndex((space) => space.id === action.data?.spaceId);

        if (moddedActiveIndex !== -1) {
            if (action.type === ContentActionTypes.UPDATE_ACTIVE_SPACE_REACTION) {
                modifiedActiveSpaces[moddedActiveIndex].reaction = { ...action.data };
            } else if (action.type === ContentActionTypes.REMOVE_ACTIVE_SPACES) {
                modifiedActiveSpaces.splice(moddedActiveIndex, 1);
            }
        }

        if (moddedBookmarkedIndex !== -1 && action.type === ContentActionTypes.UPDATE_ACTIVE_SPACE_REACTION) {
            modifiedBookmarkedSpaces[moddedBookmarkedIndex].reaction = { ...action.data };
        }
    }

    // Thoughts
    if (state.activeThoughts) {
        modifiedActiveThoughts = JSON.parse(JSON.stringify(state.activeThoughts));
        modifiedBookmarkedThoughts = JSON.parse(JSON.stringify(state.bookmarkedThoughts));
        moddedActiveIndex = modifiedActiveThoughts.findIndex((thought) => thought.id === action.data?.thoughtId);
        moddedBookmarkedIndex = modifiedBookmarkedThoughts.findIndex((thought) => thought.id === action.data?.thoughtId);

        if (moddedActiveIndex !== -1) {
            if (action.type === ContentActionTypes.UPDATE_ACTIVE_THOUGHT_REACTION) {
                modifiedActiveThoughts[moddedActiveIndex].reaction = { ...action.data };
            } else if (action.type === ContentActionTypes.REMOVE_ACTIVE_THOUGHTS) {
                modifiedActiveThoughts.splice(moddedActiveIndex, 1);
            }
        }

        if (moddedBookmarkedIndex !== -1 && action.type === ContentActionTypes.UPDATE_ACTIVE_THOUGHT_REACTION) {
            modifiedBookmarkedThoughts[moddedBookmarkedIndex].reaction = { ...action.data };
        }
    }

    const modifiedActiveMomentsMap = {};
    const modifiedActiveSpacesMap = {};
    const modifiedActiveThoughtsMap = {};

    // TODO: consider storing as Set to prevent duplicates
    switch (action.type) {
        // Moments
        case ContentActionTypes.INSERT_ACTIVE_MOMENTS:
            // Add latest moments to start
            return state.setIn(['activeMoments'], action.data.concat(modifiedActiveMoments));
        case ContentActionTypes.REMOVE_ACTIVE_MOMENTS:
            // Remove (reported) moments
            return state.setIn(['activeMoments'], modifiedActiveMoments);
        case ContentActionTypes.UPDATE_ACTIVE_MOMENT_REACTION:
            return state.setIn(['activeMoments'], modifiedActiveMoments)
                .setIn(['bookmarkedMoments'], modifiedBookmarkedMoments);
        case ContentActionTypes.SEARCH_ACTIVE_MOMENTS_BY_IDS:
            // Add newly activated moments to the top
            action.data.moments.concat(modifiedActiveMoments).forEach((m) => {
                if (!modifiedActiveMomentsMap[m.id]) {
                    modifiedActiveMomentsMap[m.id] = m;
                }
            });
            return state.setIn(['activeMoments'], Object.values(modifiedActiveMomentsMap))
                .setIn(['media'], { ...state.media, ...action.data.media });
        case ContentActionTypes.SEARCH_ACTIVE_MOMENTS:
            // Add next offset of moments to end
            action.data.moments.concat(modifiedActiveMoments).forEach((m) => {
                if (!modifiedActiveMomentsMap[m.id]) {
                    modifiedActiveMomentsMap[m.id] = m;
                }
            });
            return state.setIn(['activeMoments'], Object.values(modifiedActiveMomentsMap))
                .setIn(['media'], { ...state.media, ...action.data.media })
                .setIn(['activeMomentsPagination'], { ...action.data.pagination });
        case ContentActionTypes.UPDATE_ACTIVE_MOMENTS:
            // Reset moments from scratch
            return state.setIn(['activeMoments'], action.data.moments)
                .setIn(['media'], { ...state.media, ...action.data.media }) // local cache existing media
                .setIn(['activeMomentsPagination'], { ...action.data.pagination });
        case ContentActionTypes.SEARCH_BOOKMARKED_MOMENTS:
            // TODO: Add next offset of moments to end
            return state.setIn(['bookmarkedMoments'], action.data.moments)
                .setIn(['media'], { ...state.media, ...action.data.media });
        case ContentActionTypes.SEARCH_MY_DRAFTS:
            // Add next offset of spaces to end
            return state.setIn(['myDrafts'], [...action.data.results])
                .setIn(['myDraftsPagination'], { ...action.data.pagination })
                .setIn(['media'], { ...state.media, ...action.data.media });
        case ContentActionTypes.MOMENT_DRAFT_CREATED:
            modifiedDraftMoments.unshift(action.data);
            return state.setIn(['myDrafts'], modifiedDraftMoments);
        case ContentActionTypes.MOMENT_DRAFT_DELETED:
            // Remove (deleted draft) moments
            return state.setIn(['myDrafts'], modifiedDraftMoments);
        case MapActionTypes.MOMENT_UPDATED:
            // Remove moment updated from draft to complete
            return state.setIn(['myDrafts'], modifiedDraftMoments);

        // Spaces
        case ContentActionTypes.INSERT_ACTIVE_SPACES:
            // Add latest spaces to start
            return state.setIn(['activeSpaces'], [...new Set(action.data.concat(modifiedActiveSpaces))]);
        case ContentActionTypes.REMOVE_ACTIVE_SPACES:
            // Remove (reported) spaces
            return state.setIn(['activeSpaces'], [...new Set(modifiedActiveSpaces)]);
        case ContentActionTypes.UPDATE_ACTIVE_SPACE_REACTION:
            return state.setIn(['activeSpaces'], [...new Set(modifiedActiveSpaces)])
                .setIn(['bookmarkedSpaces'], modifiedBookmarkedSpaces);
        case ContentActionTypes.SEARCH_ACTIVE_SPACES_BY_IDS:
            // Add newly activated space to the top
            action.data.spaces.concat(modifiedActiveSpaces).forEach((m) => {
                if (!modifiedActiveSpacesMap[m.id]) {
                    modifiedActiveSpacesMap[m.id] = m;
                }
            });
            return state.setIn(['activeSpaces'], Object.values(modifiedActiveSpacesMap))
                .setIn(['media'], { ...state.media, ...action.data.media });
        case ContentActionTypes.SEARCH_ACTIVE_SPACES:
            // Add next offset of spaces to end
            action.data.spaces.concat(modifiedActiveSpaces).forEach((m) => {
                if (!modifiedActiveSpacesMap[m.id]) {
                    modifiedActiveSpacesMap[m.id] = m;
                }
            });
            return state.setIn(['activeSpaces'], Object.values(modifiedActiveSpacesMap))
                .setIn(['media'], { ...state.media, ...action.data.media })
                .setIn(['activeSpacesPagination'], { ...action.data.pagination });
        case ContentActionTypes.UPDATE_ACTIVE_SPACES:
            // Reset spaces from scratch
            return state.setIn(['activeSpaces'], action.data.spaces)
                .setIn(['media'], { ...state.media, ...action.data.media }) // local cache existing media
                .setIn(['activeSpacesPagination'], { ...action.data.pagination });
        case ContentActionTypes.SEARCH_BOOKMARKED_SPACES:
            // Add next offset of spaces to end
            return state.setIn(['bookmarkedSpaces'], action.data.spaces)
                .setIn(['media'], { ...state.media, ...action.data.media });

        // Thoughts
        case ContentActionTypes.INSERT_ACTIVE_THOUGHTS:
            // Add latest thoughts to start
            return state.setIn(['activeThoughts'], [...new Set([...action.data, ...modifiedActiveThoughts])]);
        case ContentActionTypes.REMOVE_ACTIVE_THOUGHTS:
            // Remove (reported) thoughts
            return state.setIn(['activeThoughts'], [...new Set(modifiedActiveThoughts)]);
        case ContentActionTypes.UPDATE_ACTIVE_THOUGHT_REACTION:
            return state.setIn(['activeThoughts'], [...new Set(modifiedActiveThoughts)])
                .setIn(['bookmarkedThoughts'], modifiedBookmarkedThoughts);
        case ContentActionTypes.SEARCH_ACTIVE_THOUGHTS:
            // Add next offset of thoughts to end
            action.data.thoughts.concat(modifiedActiveThoughts).forEach((m) => {
                if (!modifiedActiveThoughtsMap[m.id]) {
                    modifiedActiveThoughtsMap[m.id] = m;
                }
            });
            return state.setIn(['activeThoughts'], Object.values(modifiedActiveThoughtsMap))
                .setIn(['activeThoughtsPagination'], { ...action.data.pagination });
        case ContentActionTypes.UPDATE_ACTIVE_THOUGHTS:
            // Reset thoughts from scratch
            return state.setIn(['activeThoughts'], action.data.thoughts)
                .setIn(['activeThoughtsPagination'], { ...action.data.pagination });
        case ContentActionTypes.SEARCH_BOOKMARKED_THOUGHTS:
            // Add next offset of thoughts to end
            return state.setIn(['bookmarkedThoughts'], action.data.thoughts)
                .setIn(['media'], { ...state.media, ...action.data.media });

        // Other
        case ContentActionTypes.FETCH_MEDIA:
            return state.setIn(['media'], { ...state.media, ...action.data });
        case ContentActionTypes.SET_ACTIVE_AREAS_FILTERS:
            return state.setIn(['activeAreasFilters'], { ...action.data });
        case MapActionTypes.GET_MOMENT_DETAILS:
        case MapActionTypes.GET_SPACE_DETAILS:
            // Reset moments from scratch
            return state.setIn(['media'], { ...state.media, ...action.data.media });
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['activeMoments'], Immutable.from([]))
                .setIn(['bookmarkedMoments'], Immutable.from([]))
                .setIn(['activeSpaces'], Immutable.from([]))
                .setIn(['bookmarkedSpaces'], Immutable.from([]));
        default:
            return state;
    }
};

export default content;
