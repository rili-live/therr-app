jest.mock('../../../services/HabitCheckinsService', () => ({
    __esModule: true,
    default: {
        share: jest.fn(),
    },
}));

// eslint-disable-next-line import/first
import HabitCheckinsService from '../../../services/HabitCheckinsService';
// eslint-disable-next-line import/first
import HabitActions from '../Habits';
// eslint-disable-next-line import/first
import { HabitsActionTypes } from '../../../types/redux/habits';
// eslint-disable-next-line import/first
import { ContentActionTypes } from '../../../types/redux/content';

/**
 * The feed is driven by the distributor, which activates posts for a viewer on its own
 * schedule. An author's own share has to be in their stream the moment the request
 * succeeds — anything else reads as "the share didn't work". The server activates it for
 * them too; this is the client half, and it must not double-insert on a repeat share.
 */
const sharedThought = {
    id: 'thought-1',
    fromUserId: 'user-1',
    fromUserName: 'runner',
    message: 'Day 12 done',
    reaction: { userHasActivated: true },
    likeCount: 0,
    replies: [],
};

describe('HabitActions.shareCheckin — own post in the active stream', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('inserts the returned post at the head of the active thoughts on a first share', async () => {
        (HabitCheckinsService.share as jest.Mock).mockResolvedValue({
            data: { thought: sharedThought, sharedThoughtId: 'thought-1' },
        });
        const dispatch = jest.fn();

        await HabitActions.shareCheckin('checkin-1', 'Day 12 done')(dispatch);

        expect(dispatch).toHaveBeenCalledWith({
            type: HabitsActionTypes.SHARE_CHECKIN,
            data: { id: 'checkin-1', sharedThoughtId: 'thought-1' },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: ContentActionTypes.INSERT_ACTIVE_THOUGHTS,
            data: [sharedThought],
        });
    });

    it('does not re-insert on a repeat share, which returns only the existing link', async () => {
        (HabitCheckinsService.share as jest.Mock).mockResolvedValue({
            data: { sharedThoughtId: 'thought-1', alreadyShared: true },
        });
        const dispatch = jest.fn();

        await HabitActions.shareCheckin('checkin-1')(dispatch);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch.mock.calls[0][0].type).toBe(HabitsActionTypes.SHARE_CHECKIN);
    });

    it('still records the link when the server could not hydrate the post', async () => {
        (HabitCheckinsService.share as jest.Mock).mockResolvedValue({
            data: { sharedThoughtId: 'thought-1' },
        });
        const dispatch = jest.fn();

        const result = await HabitActions.shareCheckin('checkin-1')(dispatch);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(result.sharedThoughtId).toBe('thought-1');
    });
});
