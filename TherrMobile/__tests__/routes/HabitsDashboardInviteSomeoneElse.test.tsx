import {
    it, describe, expect, jest,
} from '@jest/globals';

/**
 * The Sent-tab invite card's "Invite Someone Else" recovery path.
 *
 * It was wired to the dashboard's `handleCreatePact`, which opens the create-pact
 * wizard with no params. A creator whose invite went unanswered and tapped it to
 * bring in a different partner was dropped into a brand-new pact instead, and
 * the pact they meant was left still waiting on the partner who never replied.
 *
 * These tests drive the real handler on the exported class and lock in that it
 * adds people to the card's own pact.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn() },
}));

// Reaches for permissions/native modules at import time.
jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

// Pulled in transitively via MainButtonMenu -> constants; throws under Jest
// because it resolves its native module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {},
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
    AndroidChannel: {},
}));

// Pulled in transitively via components/Habits -> CheckinProofSheet; resolves
// its native module at import time.
jest.mock('react-native-image-crop-picker', () => ({
    __esModule: true,
    default: { openPicker: jest.fn(), openCamera: jest.fn() },
}));

// Constructs a NativeEventEmitter at import time, which throws under Jest.
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), wrap: jest.fn() },
}));

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-permissions', () => ({
    __esModule: true,
    requestMultiple: jest.fn(() => Promise.resolve({})),
    checkMultiple: jest.fn(() => Promise.resolve({})),
    check: jest.fn(() => Promise.resolve('granted')),
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

// Imported after the mocks above deliberately: the screen pulls in a chain of
// native modules at import time, and jest.mock factories must be registered
// before that chain is required.
import { HabitsDashboard } from '../../main/routes/Habits/Dashboard';

const buildInstance = () => {
    const navigate = jest.fn();
    const props: any = {
        user: { settings: {}, details: { id: 'me' } },
        habits: { pacts: [], activePacts: [], pendingInvites: [] },
        navigation: { navigate, addListener: jest.fn() },
        route: { params: {} },
    };

    return { instance: new HabitsDashboard(props), navigate };
};

const SENT_PACT: any = {
    id: 'pact-1',
    creatorUserId: 'me',
    status: 'pending',
    habitGoalName: 'Morning run',
    activeMemberCount: 1,
    members: [
        { userId: 'me', status: 'active' },
        { userId: 'quiet-friend', status: 'pending' },
        { userId: 'old-friend', status: 'left' },
    ],
};

describe('habits dashboard "invite someone else"', () => {
    it('adds people to the pact on the card rather than starting a new one', () => {
        const { instance, navigate } = buildInstance();

        instance.handleInviteSomeoneElse(SENT_PACT);

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('AddPactMembers', {
            pactId: 'pact-1',
            habitName: 'Morning run',
            // The unanswered invitee is still on the pact, so the picker must not
            // offer them again; someone who left may be re-invited.
            existingMemberIds: ['me', 'quiet-friend'],
        });
    });

    it('falls back to the wizard when the service does not support adding members', () => {
        const { instance, navigate } = buildInstance();
        instance.handleInviteSomeoneElse({ ...SENT_PACT, activeMemberCount: undefined });

        expect(navigate).toHaveBeenCalledWith('CreatePactInvite');
    });
});
