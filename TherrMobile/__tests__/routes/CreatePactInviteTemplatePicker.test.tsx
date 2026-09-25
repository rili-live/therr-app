import 'react-native';
import { Text } from 'react-native';
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
    template('saveGroupTrip', 'money'),
    template('noSpendDay', 'money'),
    template('meditate', 'mindfulness'),
    template('read15', 'learning'),
    template('laundry', 'home'),
    template('tidy10', 'home'),
];

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

    return { instance: new CreatePactInvite(props), props };
};

const renderStep1 = (instance: CreatePactInvite) => {
    let tree: any;
    act(() => {
        tree = renderer.create(instance.renderStep1());
    });
    return tree;
};

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
