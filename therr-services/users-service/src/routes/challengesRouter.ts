import * as express from 'express';
import {
    createChallenge,
    getMyChallenges,
    getChallengeByToken,
    joinChallenge,
    leaveChallenge,
    cancelChallenge,
} from '../handlers/challenges';

const router = express.Router();

// CREATE
router.post('/', createChallenge);

// READ — literal paths before any `:id` sibling.
router.get('/mine', getMyChallenges);
router.get('/by-token/:token', getChallengeByToken);

// UPDATE
router.post('/by-token/:token/join', joinChallenge);
router.post('/:id/leave', leaveChallenge);
router.post('/:id/cancel', cancelChallenge);

export default router;
