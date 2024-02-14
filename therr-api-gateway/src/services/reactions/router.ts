import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import { searchActiveAreasValidation, searchActiveAreasByIdsValidation, searchBookmarkedAreasValidation } from './validation/areaReactions';
import {
    getEventReactionsValidation,
    getEventReactionsByEventIdValidation,
    createOrUpdateEventReactionValidation,
    findEventReactionsDynamicValidation,
} from './validation/eventReactions';
import {
    getMomentReactionsValidation,
    getMomentReactionsByMomentIdValidation,
    createOrUpdateMomentReactionValidation,
    findMomentReactionsDynamicValidation,
} from './validation/momentReactions';
import {
    createOrUpdateSpaceReactionValidation,
    findSpaceReactionsDynamicValidation,
    getSpaceReactionsBySpaceIdValidation,
    getSpaceReactionsValidation,
} from './validation/spaceReactions';
import {
    createOrUpdateThoughtReactionValidation,
    findThoughtReactionsDynamicValidation,
    getThoughtReactionsByThoughtIdValidation,
    getThoughtReactionsValidation,
    searchActiveThoughtsValidation,
    searchBookmarkedThoughtsValidation,
} from './validation/thoughtReactions';

const reactionsServiceRouter = express.Router();

// Event Reactions
reactionsServiceRouter.post('/event-reactions/:eventId', createOrUpdateEventReactionValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.get('/event-reactions', getEventReactionsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.get('/event-reactions/:eventId/ratings', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.get('/event-reactions/:eventId', getEventReactionsByEventIdValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.post('/event-reactions/find/dynamic', findEventReactionsDynamicValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/events/active/search', searchActiveAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/events/active/search/ids', searchActiveAreasByIdsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/events/bookmarked/search', searchBookmarkedAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

// Moment Reactions
reactionsServiceRouter.post('/moment-reactions/:momentId', createOrUpdateMomentReactionValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.get('/moment-reactions', getMomentReactionsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.get('/moment-reactions/:momentId', getMomentReactionsByMomentIdValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.post('/moment-reactions/find/dynamic', findMomentReactionsDynamicValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/moments/active/search', searchActiveAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/moments/active/search/ids', searchActiveAreasByIdsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/moments/bookmarked/search', searchBookmarkedAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

// Space Reactions
reactionsServiceRouter.post('/space-reactions/:spaceId', createOrUpdateSpaceReactionValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.get('/space-reactions', getSpaceReactionsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.get('/space-reactions/:spaceId/ratings', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.get('/space-reactions/:spaceId', getSpaceReactionsBySpaceIdValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.post('/space-reactions/find/dynamic', findSpaceReactionsDynamicValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/spaces/active/search', searchActiveAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/spaces/active/search/ids', searchActiveAreasByIdsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/spaces/bookmarked/search', searchBookmarkedAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

// Thought Reactions
reactionsServiceRouter.post('/thought-reactions/:thoughtId', createOrUpdateThoughtReactionValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.get('/thought-reactions', getThoughtReactionsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.get('/thought-reactions/:thoughtId', getThoughtReactionsByThoughtIdValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.post('/thought-reactions/find/dynamic', findThoughtReactionsDynamicValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/thoughts/active/search', searchActiveThoughtsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/thoughts/bookmarked/search', searchBookmarkedThoughtsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

export default reactionsServiceRouter;
