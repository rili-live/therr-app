import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';

/**
 * Keyboard avoidance in the create-pact wizard.
 *
 * "Or create your own" is the escape hatch for anyone whose habit is not one of
 * the templates, and it sits at the very bottom of step 1, directly above the
 * action bar. The app runs edge-to-edge, so the Android window does not resize
 * when the IME opens: a plain `ScrollView` plus a `position: absolute` footer
 * left both the input and the Next button underneath the keyboard, and the user
 * could not see what they were typing.
 *
 * The fix is structural rather than cosmetic, so these tests assert the
 * structure: the wizard scrolls inside a `KeyboardAwareScrollView` that is told
 * to keep the focused input clear of the footer, and the footer rides on top of
 * the keyboard inside a `KeyboardStickyView`.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn() },
}));

jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import { CreatePactInvite } from '../../main/routes/Pacts/CreatePactInvite';

const BOTTOM_INSET = 24;

/** Collects every element in a rendered React tree, depth-first. */
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

/**
 * Both the body and the footer read the safe-area inset through a render-prop
 * consumer, so the tree stops at the consumer until its child is called.
 */
const resolveInsetConsumers = (node: any): any[] => flattenElements(node)
    .filter((el: any) => el.type === SafeAreaInsetsContext.Consumer)
    .map((el: any) => el.props.children({ top: 0, bottom: BOTTOM_INSET, left: 0, right: 0 }));

const buildWizard = () => {
    const props: any = {
        user: { settings: {}, isAuthenticated: true, details: { id: 'me' } },
        habits: { templates: [], habitGoals: [], pacts: [] },
        userConnections: { connections: [] },
        navigation: { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
        getTemplates: jest.fn(),
        createGoal: jest.fn(),
        bulkInvitePact: jest.fn(),
        startUserHabit: jest.fn(),
        getUserHabitEligibility: jest.fn(),
        searchUsers: jest.fn(),
    };

    const instance = new CreatePactInvite(props);
    instance.setState = jest.fn() as any;

    return instance;
};

describe('create-pact wizard keyboard avoidance', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('scrolls the wizard body in a keyboard-aware scroll view', () => {
        const scrollViews = resolveInsetConsumers(buildWizard().render())
            .filter((el: any) => el?.type === KeyboardAwareScrollView);

        expect(scrollViews).toHaveLength(1);
    });

    it('keeps the focused input clear of the footer, not just of the keyboard', () => {
        // A bottomOffset of 0 scrolls the input flush with the top of the
        // keyboard, which on this screen means flush underneath the action bar.
        const [scrollView] = resolveInsetConsumers(buildWizard().render())
            .filter((el: any) => el?.type === KeyboardAwareScrollView);

        expect(scrollView.props.bottomOffset).toBeGreaterThan(0);
    });

    it('leaves room to scroll past the footer', () => {
        const [scrollView] = resolveInsetConsumers(buildWizard().render())
            .filter((el: any) => el?.type === KeyboardAwareScrollView);
        const { paddingBottom } = scrollView.props.contentContainerStyle;

        expect(paddingBottom).toBeGreaterThan(scrollView.props.bottomOffset + BOTTOM_INSET);
    });

    it('sticks the action bar to the top of the keyboard', () => {
        const [footer] = resolveInsetConsumers(buildWizard().renderFooter());
        // The footer is its own function component so it can subscribe to
        // keyboard state; call it to reach the sticky wrapper it renders.
        const rendered = footer.type(footer.props);

        expect(rendered.type).toBe(KeyboardStickyView);
        expect(rendered.props.style).toMatchObject({ position: 'absolute', bottom: 0 });
    });

    it('reports the footer height so the scroll view can offset by it', () => {
        const instance = buildWizard();
        const [footer] = resolveInsetConsumers(instance.renderFooter());
        const measured = footer.type(footer.props).props.children;

        measured.props.onLayout({ nativeEvent: { layout: { height: 123 } } });

        expect(instance.setState).toHaveBeenCalledWith({ footerHeight: 123 });
    });
});
