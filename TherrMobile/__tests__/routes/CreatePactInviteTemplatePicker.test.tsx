import 'react-native';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import {
    it, describe, expect, jest,
} from '@jest/globals';

/**
 * The "Pick a habit" step's category tabs, and the text a template is cloned with.
 *
 * The clone is the case worth guarding. Templates are stored in English and translated on
 * the device, and the user's copy is what the pact card, the partner's screen and every
 * later reminder render. Cloning `template.name` would show a Spanish user "Hacer
 * ejercicio" in the picker and "Work out" everywhere after it.
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
import Toast from 'react-native-toast-message';

const template = (templateKey: string, category: string, usageCount = 0): any => ({
    id: `id-${templateKey}`,
    templateKey,
    name: `stored ${templateKey}`,
    description: `stored description ${templateKey}`,
    category,
    emoji: '⭐',
    goalType: 'build_good',
    frequencyType: 'daily',
    frequencyCount: 1,
    usageCount,
});

const TEMPLATES = [
    template('workOut', 'fitness'),
    template('goForWalk', 'fitness'),
    { ...template('saveGroupTrip', 'money'), goalType: 'savings_goal' },
    template('noSpendDay', 'money'),
    template('meditate', 'mindfulness'),
    template('read15', 'learning'),
    template('laundry', 'home'),
    template('tidy10', 'home'),
];

/**
 * A wizard whose `setState` applies synchronously, so a handler's effect on the next render
 * can be asserted without mounting the whole screen.
 */
const buildWizard = (locale = 'en-us') => {
    const props: any = {
        user: { settings: { locale }, isAuthenticated: true, details: { id: 'me' } },
        habits: {
            templates: TEMPLATES, habitGoals: [], pacts: [], userHabitEligibility: null,
        },
        userConnections: { connections: [] },
        navigation: { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
        getTemplates: jest.fn(),
        createGoal: jest.fn(() => Promise.resolve({ id: 'user-goal-1' })),
        bulkInvitePact: jest.fn(() => Promise.resolve()),
        startUserHabit: jest.fn(() => Promise.resolve()),
        getUserHabitEligibility: jest.fn(() => Promise.resolve(null)),
        searchUsers: jest.fn(),
    };

    const instance = new CreatePactInvite(props);
    instance.setState = ((update: any) => {
        instance.state = { ...instance.state, ...(typeof update === 'function' ? update(instance.state) : update) };
    }) as any;

    return { instance, props };
};

const renderView = (element: any) => {
    let tree: any;
    act(() => {
        tree = renderer.create(element);
    });
    return tree;
};

const renderStep1 = (instance: CreatePactInvite) => renderView(instance.renderPickStep());

const textsOf = (tree: any): string[] => tree.root.findAllByType(Text)
    .map((node: any) => [].concat(node.props.children).join(''));

describe('create-pact wizard — template picker', () => {
    it('opens on Popular, with a tab per category that has templates', () => {
        const { instance } = buildWizard();
        const texts = textsOf(renderStep1(instance));

        expect(texts).toEqual(expect.arrayContaining([
            'Popular', 'Movement & Exercise', 'Money & Savings', 'Mind & Mental Health', 'Learning & Creativity', 'Home & Routine',
        ]));
        expect(texts).not.toContain('Relationships');
        // Featured templates lead Popular while every usage count is zero.
        expect(texts).toContain('Work out');
        expect(texts).not.toContain('Laundry day');
    });

    it('shows only the chosen category', () => {
        const { instance } = buildWizard();
        instance.state = { ...instance.state, templateCategory: 'home' };
        const texts = textsOf(renderStep1(instance));

        expect(texts).toEqual(expect.arrayContaining(['Laundry day', '10-minute tidy']));
        expect(texts).not.toContain('Work out');
    });

    it('renders templates in the user\'s language', () => {
        const { instance } = buildWizard('es');
        const texts = textsOf(renderStep1(instance));

        expect(texts).toEqual(expect.arrayContaining(['Populares', 'Hacer ejercicio']));
    });

    it('clones a template with the text the user saw, not the stored English', async () => {
        const { instance, props } = buildWizard('es');
        instance.state = { ...instance.state, selectedTemplateId: 'id-workOut' };

        await instance.createHabitGoal();

        expect(props.createGoal).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Hacer ejercicio',
            description: '20+ minutos de movimiento, cuando mejor te venga',
            category: 'fitness',
        }));
    });
});

/**
 * The pick view and the configure view, split.
 *
 * They were one screen, and the cadence and savings controls sat under the template list —
 * below the fold on every phone, so most people chose a habit and tapped Next without
 * learning the schedule could be changed. These tests pin the split: picking is only
 * picking, and the tap that picks opens the options.
 */
describe('create-pact wizard — pick, then configure', () => {
    it('keeps the options off the pick view', () => {
        const { instance } = buildWizard();
        const tree = renderStep1(instance);
        const texts = textsOf(tree);

        expect(texts).not.toContain('How often?');
        expect(texts).not.toContain('Savings goal');
        // The custom habit is a row that opens the configure view, not a text field here.
        expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
        expect(texts).toEqual(expect.arrayContaining(['Create your own']));
    });

    it('opens the configure view as soon as a template is tapped, on the template\'s cadence', () => {
        const { instance } = buildWizard();
        const weekly = { ...template('run', 'fitness'), frequencyType: 'weekly', frequencyCount: 3 };
        (instance.props.habits as any).templates = [...TEMPLATES, weekly];

        instance.selectTemplate('id-run');

        expect(instance.state.step).toBe('configure');
        expect(instance.state.cadence).toEqual({ kind: 'weeklyCount', count: 3 });
        expect(instance.props.navigation.setOptions).toHaveBeenLastCalledWith({ title: 'Make it yours' });
    });

    it('shows the chosen habit and how often on the configure view', () => {
        const { instance } = buildWizard();
        instance.selectTemplate('id-workOut');
        const texts = textsOf(renderView(instance.renderConfigureStep()));

        expect(texts).toEqual(expect.arrayContaining(['Work out', 'How often?', 'Change']));
        // Not a savings template, so no savings block.
        expect(texts).not.toContain('Savings goal');
    });

    it('keeps edits when the same template is chosen again after going back', () => {
        const { instance } = buildWizard();
        instance.selectTemplate('id-workOut');
        instance.setCadence({ kind: 'weeklyCount', count: 4 });
        instance.handleBack();

        expect(instance.state.step).toBe('pick');

        instance.selectTemplate('id-workOut');

        expect(instance.state.step).toBe('configure');
        expect(instance.state.cadence).toEqual({ kind: 'weeklyCount', count: 4 });
    });

    it('shows the savings target, with drawn radios, for a savings template', () => {
        const { instance } = buildWizard();
        instance.selectTemplate('id-saveGroupTrip');
        const tree = renderView(instance.renderConfigureStep());
        const texts = textsOf(tree);
        const radios = tree.root.findAll((node: any) => node.props?.accessibilityRole === 'radio'
            && typeof node.type !== 'string' && node.props.onPress);

        expect(texts).toEqual(expect.arrayContaining(['Savings goal', 'Each person saves this', 'We save this together']));
        // The emoji radios rendered in the platform's grey on every brand.
        expect(texts).not.toContain('🔘');
        expect(texts).not.toContain('⚪');
        expect(radios.length).toBeGreaterThanOrEqual(2);
    });

    it('asks for a name, not a habit, when a custom habit has none', () => {
        const { instance } = buildWizard();
        instance.startCustomHabit();

        expect(instance.state.step).toBe('configure');
        expect(renderView(instance.renderConfigureStep()).root.findAllByType(TextInput)).toHaveLength(1);

        instance.handleNext();

        expect(instance.state.step).toBe('configure');
        expect(Toast.show).toHaveBeenLastCalledWith({ type: 'info', text1: 'Give your habit a name to continue' });
    });

    it('does not leave the pick view with nothing chosen', () => {
        const { instance } = buildWizard();
        instance.handleNext();

        expect(instance.state.step).toBe('pick');
        expect(Toast.show).toHaveBeenLastCalledWith({ type: 'info', text1: 'Pick a habit to continue' });
    });

    it('walks Android back from the configure view to the habit list, not out of the wizard', () => {
        const { instance, props } = buildWizard();
        props.navigation.isFocused = jest.fn(() => true);
        instance.selectTemplate('id-workOut');

        expect(instance.onHardwareBackPress()).toBe(true);
        expect(instance.state.step).toBe('pick');
        expect(props.navigation.goBack).not.toHaveBeenCalled();

        // On the list, back is the system's again: it leaves the wizard.
        expect(instance.onHardwareBackPress()).toBe(false);
    });

    it('leaves Android back alone while another screen sits on top of the wizard', () => {
        const { instance, props } = buildWizard();
        props.navigation.isFocused = jest.fn(() => false);
        instance.selectTemplate('id-workOut');

        expect(instance.onHardwareBackPress()).toBe(false);
        expect(instance.state.step).toBe('configure');
    });
});
