import * as express from 'express';
import {
    createPactMessage,
    getPactChat,
    markPactChatRead,
    reportPactMessage,
    setPactChatMute,
    setPactChatReaction,
} from '../handlers/pactChat';

// Pact chat — see docs/niche-sub-apps/habits/HABITS_PACT_CHAT_DESIGN.md. Mounted at /habits/pacts
// beside pactsRouter; every path is two or more segments deep, so none collides with '/:id'.
const router = express.Router({ mergeParams: true });

router.get('/:pactId/chat', getPactChat);
router.post('/:pactId/chat/messages', createPactMessage);
router.put('/:pactId/chat/read', markPactChatRead);
router.put('/:pactId/chat/reactions', setPactChatReaction);
router.put('/:pactId/chat/messages/:messageId/report', reportPactMessage);
router.put('/:pactId/chat/mute', setPactChatMute);

export default router;
