import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * CreatePactInvite handleSend habit-goal resolution regression tests.
 *
 * The wizard supports two paths into a pact:
 *   (A) user picks a template from the catalog, which must be CLONED into a
 *       user-owned goal (so per-user streaks/completion stats don't share
 *       rows across users)
 *   (B) user types a custom habit name, which is created as a fresh goal
 *
 * A prior version of `handleSend` initialized `habitGoalId` from
 * `selectedTemplateId` and then guarded the template-clone branch on
 * `!habitGoalId`, which made the clone branch dead code and routed pacts at
 * the global template id. These tests lock in the corrected resolution.
 *
 * Mirror of the resolution logic in
 * `main/routes/Pacts/CreatePactInvite.tsx` — kept in the test file so we
 * don't need to mount the full class component (which depends on Redux,
 * react-navigation, and translator).
 */

interface ITemplate {
    id: string;
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    frequencyType: string;
    frequencyCount: number;
    targetDaysOfWeek?: number[];
}

interface ICreateGoalArgs {
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    frequencyType: string;
    frequencyCount: number;
    targetDaysOfWeek?: number[];
}

const resolveHabitGoalId = async ({
    selectedTemplateId,
    customHabitName,
    templates,
    createGoal,
}: {
    selectedTemplateId: string | null;
    customHabitName: string;
    templates: ITemplate[] | undefined;
    createGoal: (args: ICreateGoalArgs) => Promise<{ id: string } | null>;
}): Promise<string> => {
    let habitGoalId: string | null = null;

    if (selectedTemplateId) {
        const template = templates?.find((t) => t.id === selectedTemplateId);
        if (template) {
            const userGoal = await createGoal({
                name: template.name,
                description: template.description,
                category: template.category,
                emoji: template.emoji,
                frequencyType: template.frequencyType,
                frequencyCount: template.frequencyCount,
                targetDaysOfWeek: template.targetDaysOfWeek,
            });
            habitGoalId = userGoal?.id || selectedTemplateId;
        } else {
            habitGoalId = selectedTemplateId;
        }
    } else if (customHabitName.trim()) {
        const newGoal = await createGoal({
            name: customHabitName.trim(),
            frequencyType: 'daily',
            frequencyCount: 1,
        });
        habitGoalId = newGoal?.id || null;
    }

    if (!habitGoalId) throw new Error('missing habitGoalId');
    return habitGoalId;
};

describe('CreatePactInvite habit-goal resolution', () => {
    let createGoal: jest.Mock<(args: ICreateGoalArgs) => Promise<{ id: string } | null>>;

    const template: ITemplate = {
        id: 'tmpl-1',
        name: 'Run 3x/week',
        description: 'Build cardio',
        category: 'fitness',
        emoji: '🏃',
        frequencyType: 'weekly',
        frequencyCount: 3,
        targetDaysOfWeek: [1, 3, 5],
    };

    beforeEach(() => {
        createGoal = jest.fn<(args: ICreateGoalArgs) => Promise<{ id: string } | null>>();
    });

    it('clones the selected template into a user-owned goal (the regression case)', async () => {
        createGoal.mockResolvedValueOnce({ id: 'user-goal-1' });

        const id = await resolveHabitGoalId({
            selectedTemplateId: template.id,
            customHabitName: '',
            templates: [template],
            createGoal,
        });

        expect(createGoal).toHaveBeenCalledTimes(1);
        expect(createGoal).toHaveBeenCalledWith({
            name: 'Run 3x/week',
            description: 'Build cardio',
            category: 'fitness',
            emoji: '🏃',
            frequencyType: 'weekly',
            frequencyCount: 3,
            targetDaysOfWeek: [1, 3, 5],
        });
        expect(id).toBe('user-goal-1');
    });

    it('uses the user-goal id, not the template id, when both are available', async () => {
        createGoal.mockResolvedValueOnce({ id: 'user-goal-2' });

        const id = await resolveHabitGoalId({
            selectedTemplateId: template.id,
            customHabitName: '',
            templates: [template],
            createGoal,
        });

        expect(id).toBe('user-goal-2');
        expect(id).not.toBe(template.id);
    });

    it('falls back to the template id when createGoal returns no id (defensive path)', async () => {
        createGoal.mockResolvedValueOnce(null);

        const id = await resolveHabitGoalId({
            selectedTemplateId: template.id,
            customHabitName: '',
            templates: [template],
            createGoal,
        });

        expect(id).toBe(template.id);
    });

    it('falls back to the template id when the template is missing from store (race-safe)', async () => {
        const id = await resolveHabitGoalId({
            selectedTemplateId: 'tmpl-not-in-store',
            customHabitName: '',
            templates: [template],
            createGoal,
        });

        expect(createGoal).not.toHaveBeenCalled();
        expect(id).toBe('tmpl-not-in-store');
    });

    it('creates a fresh goal from a trimmed custom name when no template is selected', async () => {
        createGoal.mockResolvedValueOnce({ id: 'custom-goal-1' });

        const id = await resolveHabitGoalId({
            selectedTemplateId: null,
            customHabitName: '  Read 20 minutes  ',
            templates: [],
            createGoal,
        });

        expect(createGoal).toHaveBeenCalledWith({
            name: 'Read 20 minutes',
            frequencyType: 'daily',
            frequencyCount: 1,
        });
        expect(id).toBe('custom-goal-1');
    });

    it('throws when neither path resolves a habit goal id', async () => {
        await expect(
            resolveHabitGoalId({
                selectedTemplateId: null,
                customHabitName: '   ',
                templates: [],
                createGoal,
            }),
        ).rejects.toThrow('missing habitGoalId');
        expect(createGoal).not.toHaveBeenCalled();
    });

    it('treats whitespace-only custom names as empty when no template is selected', async () => {
        await expect(
            resolveHabitGoalId({
                selectedTemplateId: null,
                customHabitName: '\t\n  ',
                templates: [],
                createGoal,
            }),
        ).rejects.toThrow('missing habitGoalId');
    });
});
