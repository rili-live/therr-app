import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';
import { Pressable } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

/**
 * Posting an open pact from the create wizard with nobody invited.
 *
 * Opening a pact to the public used to be possible only from a switch at the foot of the review
 * step, shown after choosing a friend. Someone with no friends on the app, the person an open pact
 * exists for, could only start a solo habit, which creates no pact and so nothing to open. The
 * partner step now offers "post an open pact" near the top, and the review it leads to creates a
 * pact with no invitee, open to join requests.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn() },
}));

jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

jest.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import { CreatePactInvite } from '../../main/routes/Pacts/CreatePactInvite';

const flattenElements = (node: any, collected: any[] = []): any[] => {
    if (Array.isArray(node)) {
        node.forEach((child) => flattenElements(child, collected));
        return collected;
    }
    if (!node || typeof node !== 'object') {
        return collected;
    }
    collected.push(node);
    flattenElements(node.props?.children, collected);
    return collected;
};

const buildWizard = (state: Record<string, any> = {}) => {
    const props: any = {
        user: { settings: {}, isAuthenticated: true, details: { id: 'me' } },
        habits: { templates: [], habitGoals: [], pacts: [] },
        userConnections: { connections: [] },
        navigation: {
            navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(),
        },
        route: { params: {} },
        getTemplates: jest.fn(),
        createGoal: jest.fn(),
        bulkInvitePact: jest.fn(),
        createPact: jest.fn(() => Promise.resolve({ id: 'pact-1' })),
        startUserHabit: jest.fn(),
        getUserHabitEligibility: jest.fn(),
        searchUsers: jest.fn(),
    };

    const instance = new CreatePactInvite(props);
    instance.state = { ...instance.state, ...state };
    instance.setState = jest.fn((update: any, callback?: () => void) => {
        instance.state = { ...instance.state, ...(typeof update === 'function' ? update(instance.state) : update) };
        callback?.();
    }) as any;

    return { instance, props };
};

const findPostOpenOption = (tree: any, instance: any) => flattenElements(tree).find((el: any) => (
    el.type === Pressable && el.props.accessibilityLabel === instance.translate('pages.pacts.openPact.wizardOptionTitle')
));

const renderFooterButton = (instance: any) => {
    const [footer] = flattenElements(instance.renderFooter())
        .filter((el: any) => el.type === SafeAreaInsetsContext.Consumer)
        .map((el: any) => el.props.children({ top: 0, bottom: 0, left: 0, right: 0 }));

    return flattenElements(footer).find((el: any) => typeof el.props?.title === 'string');
};

describe('posting an open pact from the create wizard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('offers the open pact on the partner step once the server supports it', () => {
        const { instance: unsupported } = buildWizard({ step: 'partners', isOpenPactSupported: false });
        expect(findPostOpenOption(unsupported.renderStep2(), unsupported)).toBeUndefined();

        const { instance } = buildWizard({ step: 'partners', isOpenPactSupported: true });
        expect(findPostOpenOption(instance.renderStep2(), instance)).toBeDefined();
    });

    it('goes straight to the review of an open pact, without the solo unlock', () => {
        const { instance } = buildWizard({ step: 'partners', isOpenPactSupported: true });

        findPostOpenOption(instance.renderStep2(), instance).props.onPress();

        expect(instance.state.isOpenPact).toBe(true);
        expect(instance.state.step).toBe('review');
        expect(renderFooterButton(instance).props.title).toBe(instance.translate('pages.pacts.openPact.postCta'));
    });

    it('creates an open pact with nobody invited and opens it', async () => {
        const { instance, props } = buildWizard({
            step: 'review', isOpenPactSupported: true, isOpenPact: true,
        });
        instance.confirmHabitCapacity = jest.fn(() => Promise.resolve(true)) as any;
        instance.resolveHabitGoalId = jest.fn(() => Promise.resolve('goal-1')) as any;

        await renderFooterButton(instance).props.onPress();

        expect(props.createPact).toHaveBeenCalledWith(expect.objectContaining({ habitGoalId: 'goal-1', isOpen: true }));
        expect(props.createPact.mock.calls[0][0]).not.toHaveProperty('partnerUserId');
        expect(props.bulkInvitePact).not.toHaveBeenCalled();
        expect(props.startUserHabit).not.toHaveBeenCalled();
        expect(props.navigation.replace).toHaveBeenCalledWith('PactDetail', { pactId: 'pact-1' });
    });

    it('drops the open-pact choice on back, so the partner step is where it is made again', () => {
        const { instance } = buildWizard({
            step: 'review', isOpenPactSupported: true, isOpenPact: true,
        });

        instance.handleBack();

        expect(instance.state.isOpenPact).toBe(false);
        expect(instance.state.step).toBe('partners');
    });

    it('still sends invites when partners are chosen and the pact is open', () => {
        const { instance } = buildWizard({
            step: 'review', isOpenPactSupported: true, isOpenPact: true, selectedPartnerIds: ['friend'],
        });

        expect(renderFooterButton(instance).props.onPress).toBe(instance.handleSend);
    });
});
